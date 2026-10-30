"""Mobile OTP login for every role.

Flow:  send OTP -> verify OTP
  - number belongs to an active account -> logged in, frontend opens that role's welcome page
  - new number                          -> a customer account is made right away (no questions);
                                           name + address are asked at checkout
Store owners and delivery partners never sign up from the app:
  - delivery partners are added by the store admin (Staff -> Add staff -> Delivery)
  - store owners are added by the FreshMart owner (owner panel -> Stores -> Add store)
  - pickers by the store admin (Staff), support agents by the owner (Support team)
  - the owner = numbers in SUPER_ADMIN_PHONES
"pending" / "rejected" is only for old requests made before this change.
"""
import hashlib
import hmac
import secrets
from datetime import timedelta, timezone

from bson import ObjectId
from fastapi import HTTPException, status

from app.config import settings
from app.database import get_db
from app.models.onboarding import OtpSend, OtpVerify
from app.utils import sms
from app.utils.helpers import now_utc, serialize, to_object_id
from app.utils.security import create_access_token

ROLE_PRIORITY = {"superadmin": 0, "admin": 1, "support": 2, "picker": 3, "delivery": 4, "customer": 5}   # one number on many accounts -> staff account wins


def _hash(phone: str, code: str) -> str:
    return hmac.new(settings.JWT_SECRET.encode(), f"{phone}:{code}".encode(), hashlib.sha256).hexdigest()


def _aware(d):
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


def _auth(user: dict, is_new: bool = False) -> dict:
    u = serialize(user)
    return {"status": "ok", "is_new": is_new, "access_token": create_access_token(u["id"], u["role"]),
            "token_type": "bearer", "user": u}


async def _user_by_phone(phone: str, owner_ok: bool = False) -> dict | None:
    """Owner (superadmin) account counts only while its number is still in SUPER_ADMIN_PHONES."""
    q: dict = {"phone": phone} if owner_ok else {"phone": phone, "role": {"$ne": "superadmin"}}
    users = await get_db().users.find(q).to_list(None)
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

    if data.phone in settings.super_admin_phones:   # FreshMart owner number (from .env)
        if not await db.users.find_one({"phone": data.phone, "role": "superadmin"}):
            await db.users.insert_one({"name": "FreshMart owner", "phone": data.phone, "role": "superadmin",
                                       "is_active": True, "status": "active", "login": "otp", "created_at": now_utc()})
    user = await _user_by_phone(data.phone, owner_ok=data.phone in settings.super_admin_phones)
    if not user:   # new number -> customer account, straight to the shop
        doc = {"name": "", "phone": data.phone, "role": "customer", "is_active": True, "status": "active",
               "login": "otp", "created_at": now_utc(), "last_login_at": now_utc()}
        res = await db.users.insert_one(doc)
        doc["_id"] = res.inserted_id
        return _auth(doc, is_new=True)
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


# ---------------- Old rider requests (made before invite-only) ----------------
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
