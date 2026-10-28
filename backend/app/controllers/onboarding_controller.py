"""Mobile OTP login for every role + sign-up for new numbers.

Flow:  send OTP -> verify OTP
  - number belongs to an active account  -> logged in (token), frontend opens that role's welcome page
  - store owner / rider still waiting     -> status "pending" (no token)
  - new number                            -> signup_token; frontend asks the name (customer)
                                             or the store / rider form, then calls a signup endpoint
Store owners and delivery partners start as "pending" until approved.
"""
import hashlib
import hmac
import secrets
from datetime import timedelta, timezone

from bson import ObjectId
from fastapi import HTTPException, UploadFile, status

from app.config import settings
from app.database import get_db
from app.models.onboarding import CustomerSignup, OtpSend, OtpVerify, RiderSignup, StoreSignup
from app.utils import sms
from app.utils.helpers import now_utc, serialize, to_object_id
from app.utils.security import create_access_token, create_signup_token, decode_signup_token
from app.utils.uploads import save_image

ROLE_PRIORITY = {"admin": 0, "delivery": 1, "customer": 2}   # one number on many accounts -> staff account wins


def _hash(phone: str, code: str) -> str:
    return hmac.new(settings.JWT_SECRET.encode(), f"{phone}:{code}".encode(), hashlib.sha256).hexdigest()


def _aware(d):
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


def _auth(user: dict, is_new: bool = False) -> dict:
    u = serialize(user)
    return {"status": "ok", "is_new": is_new, "access_token": create_access_token(u["id"], u["role"]),
            "token_type": "bearer", "user": u}


async def _user_by_phone(phone: str) -> dict | None:
    users = await get_db().users.find({"phone": phone}).to_list(None)
    if not users:
        return None
    return sorted(users, key=lambda u: ROLE_PRIORITY.get(u.get("role"), 9))[0]


def otp_config() -> dict:
    return {"dev_mode": settings.OTP_DEV_MODE, "resend_seconds": settings.OTP_RESEND_SECONDS}


# ---------------- OTP ----------------
async def send_otp(data: OtpSend) -> dict:
    db = get_db()
    now = now_utc()
    doc = await db.otp_codes.find_one({"phone": data.phone})
    if doc:
        wait = settings.OTP_RESEND_SECONDS - int((now - _aware(doc["sent_at"])).total_seconds())
        if wait > 0:
            raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, f"Please wait {wait}s before asking for a new code")
        window = _aware(doc.get("window_start", doc["sent_at"]))
        count = doc.get("sent_count", 0) if now - window < timedelta(hours=1) else 0
        if count >= settings.OTP_MAX_PER_HOUR:
            raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many codes. Try again in an hour.")
        window = window if count else now
    else:
        count, window = 0, now

    code = f"{secrets.randbelow(1_000_000):06d}"
    await db.otp_codes.update_one({"phone": data.phone}, {"$set": {
        "code_hash": _hash(data.phone, code), "sent_at": now, "window_start": window, "sent_count": count + 1,
        "expires_at": now + timedelta(seconds=settings.OTP_TTL_SECONDS), "attempts": 0,
    }}, upsert=True)
    try:
        sms.send_otp(data.phone, code)
    except Exception as exc:  # provider down: don't leave a code nobody can receive
        await db.otp_codes.delete_one({"phone": data.phone})
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Couldn't send the SMS. Please try again.") from exc

    out = {"sent": True, "resend_seconds": settings.OTP_RESEND_SECONDS}
    if settings.OTP_DEV_MODE:
        out["dev_code"] = code
    return out


async def verify_otp(data: OtpVerify) -> dict:
    db = get_db()
    doc = await db.otp_codes.find_one({"phone": data.phone})
    if not doc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Ask for a code first")
    if now_utc() > _aware(doc["expires_at"]):
        await db.otp_codes.delete_one({"_id": doc["_id"]})
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This code has expired. Ask for a new one.")
    if doc.get("attempts", 0) >= settings.OTP_MAX_ATTEMPTS:
        await db.otp_codes.delete_one({"_id": doc["_id"]})
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many wrong tries. Ask for a new code.")
    if not hmac.compare_digest(doc["code_hash"], _hash(data.phone, data.code)):
        await db.otp_codes.update_one({"_id": doc["_id"]}, {"$inc": {"attempts": 1}})
        left = settings.OTP_MAX_ATTEMPTS - doc.get("attempts", 0) - 1
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Wrong code. {left} tries left." if left else "Wrong code.")
    await db.otp_codes.delete_one({"_id": doc["_id"]})

    user = await _user_by_phone(data.phone)
    if not user:
        return {"status": "new", "signup_token": create_signup_token(data.phone)}
    st = user.get("status", "active")
    if st == "pending":
        return {"status": "pending", "role": user["role"], "name": user.get("name", "")}
    if st == "rejected":
        return {"status": "rejected", "role": user["role"], "name": user.get("name", ""),
                "note": user.get("review_note") or ""}
    if not user.get("is_active", True):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account is disabled. Please contact the store.")
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"last_login_at": now_utc()}})
    return _auth(user)


# ---------------- Sign-up (after OTP) ----------------
async def _verified_phone(token: str) -> str:
    phone = decode_signup_token(token)
    if not phone:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Your OTP check expired. Please verify your number again.")
    if await _user_by_phone(phone):
        raise HTTPException(status.HTTP_409_CONFLICT, "This number already has an account. Please log in.")
    return phone


async def _email_free(email: str | None) -> str | None:
    if not email:
        return None
    email = email.lower()
    if await get_db().users.find_one({"email": email}):
        raise HTTPException(status.HTTP_409_CONFLICT, "This email is already used by another account")
    return email


def _base_user(phone: str, name: str, email: str | None, role: str, st: str) -> dict:
    doc = {"name": " ".join(name.split()), "phone": phone, "role": role, "is_active": True,
           "status": st, "login": "otp", "created_at": now_utc()}
    if email:                       # leave the key out when empty (email index is unique + sparse)
        doc["email"] = email
    return doc


async def signup_customer(data: CustomerSignup) -> dict:
    phone = await _verified_phone(data.signup_token)
    doc = _base_user(phone, data.name, await _email_free(data.email), "customer", "active")
    res = await get_db().users.insert_one(doc)
    doc["_id"] = res.inserted_id
    return _auth(doc, is_new=True)


async def signup_store(data: StoreSignup) -> dict:
    phone = await _verified_phone(data.signup_token)
    db = get_db()
    doc = _base_user(phone, data.name, await _email_free(data.email), "admin", "pending")
    res = await db.users.insert_one(doc)
    store = {**data.store.model_dump(), "owner_id": res.inserted_id, "is_open": False,
             "status": "pending", "created_at": now_utc()}
    s = await db.stores.insert_one(store)
    await db.users.update_one({"_id": res.inserted_id}, {"$set": {"store_id": s.inserted_id}})
    return {"status": "pending", "role": "admin", "name": doc["name"]}


async def signup_rider(data: RiderSignup) -> dict:
    phone = await _verified_phone(data.signup_token)
    v = data.vehicle
    if v.type.value != "cycle":
        if len(v.number.strip()) < 4:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Please enter your vehicle number")
        if not (data.licence_number or "").strip():
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Please enter your driving licence number")
    if data.licence_photo and not data.licence_photo.startswith("/uploads/"):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Upload the licence photo again")
    doc = _base_user(phone, data.name, None, "delivery", "pending")
    doc.update({
        "vehicle": {"type": v.type.value, "number": v.number.strip().upper()},
        "licence": {"number": (data.licence_number or "").strip().upper() or None, "photo": data.licence_photo},
        "city": data.area.strip(), "area": data.area.strip(),
        "is_online": False, "active_order_id": None, "location": None,
    })
    await get_db().users.insert_one(doc)
    return {"status": "pending", "role": "delivery", "name": doc["name"]}


async def signup_upload(token: str, file: UploadFile) -> dict:
    if not decode_signup_token(token or ""):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Verify your number first")
    return {"image_url": await save_image(file, max_bytes=3 * 1024 * 1024)}


# ---------------- Rider requests (store admin) ----------------
def _request_out(u: dict) -> dict:
    return {
        "id": str(u["_id"]), "name": u.get("name"), "phone": u.get("phone"), "status": u.get("status", "active"),
        "vehicle": u.get("vehicle"), "licence": u.get("licence"), "area": u.get("area") or u.get("city"),
        "created_at": u.get("created_at"), "reviewed_at": u.get("reviewed_at"), "review_note": u.get("review_note"),
    }


async def rider_requests(include_done: bool = False) -> list[dict]:
    q: dict = {"role": "delivery", "status": "pending"}
    if include_done:
        q = {"role": "delivery", "status": {"$in": ["pending", "rejected"]}}
    docs = await get_db().users.find(q).sort("created_at", -1).to_list(200)
    return serialize([_request_out(d) for d in docs])


async def decide_rider(admin: dict, rider_id: str, approve: bool, note: str | None = None) -> dict:
    db = get_db()
    rider = await db.users.find_one({"_id": to_object_id(rider_id, "rider id"), "role": "delivery"})
    if not rider:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Request not found")
    if rider.get("status") not in ("pending", "rejected"):
        raise HTTPException(status.HTTP_409_CONFLICT, "This partner is already approved")
    new = "active" if approve else "rejected"
    await db.users.update_one({"_id": rider["_id"]}, {"$set": {
        "status": new, "reviewed_at": now_utc(), "reviewed_by": ObjectId(admin["id"]), "review_note": note or None,
    }})
    sms.send_text(rider["phone"], "FreshMart: you're approved! Log in with your number to start delivering."
                  if approve else "FreshMart: sorry, your delivery partner request was not accepted.")
    return _request_out(await db.users.find_one({"_id": rider["_id"]}))
