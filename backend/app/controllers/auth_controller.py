from bson import ObjectId
from fastapi import HTTPException, status
from pymongo.errors import DuplicateKeyError

from app.database import get_db
from app.models.user import ChangePassword, LoginRequest, ProfileUpdate, RegisterRequest, Role
from app.utils.helpers import now_utc, serialize
from app.utils.security import create_access_token, hash_password, verify_password


def _auth_response(user: dict) -> dict:
    user = serialize(user)
    return {
        "access_token": create_access_token(user["id"], user["role"]),
        "token_type": "bearer",
        "user": user,
    }


async def register(data: RegisterRequest) -> dict:
    db = get_db()
    email = data.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status.HTTP_409_CONFLICT, "Email is already registered")

    user_doc = {
        "name": data.name.strip(),
        "email": email,
        "phone": data.phone,
        "role": data.role.value,
        "password_hash": hash_password(data.password),
        "is_active": True,
        "created_at": now_utc(),
    }
    if data.role == Role.CUSTOMER:
        user_doc["address"] = data.address.model_dump()
    if data.role == Role.DELIVERY:
        user_doc["vehicle"] = {"type": data.vehicle.type.value, "number": data.vehicle.number.strip().upper()}
        user_doc["city"] = (data.city or "").strip()
        user_doc["is_online"] = False
        user_doc["active_order_id"] = None
        user_doc["location"] = None

    try:
        result = await db.users.insert_one(user_doc)
    except DuplicateKeyError:
        raise HTTPException(status.HTTP_409_CONFLICT, "Email is already registered")
    user_doc["_id"] = result.inserted_id

    if data.role == Role.ADMIN:
        store_doc = {
            **data.store.model_dump(),
            "owner_id": result.inserted_id,
            "is_open": True,
            "created_at": now_utc(),
        }
        store_res = await db.stores.insert_one(store_doc)
        await db.users.update_one({"_id": result.inserted_id}, {"$set": {"store_id": store_res.inserted_id}})
        user_doc["store_id"] = store_res.inserted_id

    return _auth_response(user_doc)


async def login(data: LoginRequest) -> dict:
    user = await get_db().users.find_one({"email": data.email.lower()})
    if not user or not user.get("password_hash") or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    if not user.get("is_active", True):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Your account is disabled")
    if user.get("status", "active") != "active":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Your account is waiting for approval")
    return _auth_response(user)


async def update_profile(user: dict, data: ProfileUpdate) -> dict:
    updates = data.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Nothing to update")
    db = get_db()
    await db.users.update_one({"_id": ObjectId(user["id"])}, {"$set": updates})
    return serialize(await db.users.find_one({"_id": ObjectId(user["id"])}))


async def change_password(user: dict, data: ChangePassword) -> dict:
    db = get_db()
    doc = await db.users.find_one({"_id": ObjectId(user["id"])})
    if not verify_password(data.current_password, doc["password_hash"]):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Current password is wrong")
    await db.users.update_one(
        {"_id": doc["_id"]}, {"$set": {"password_hash": hash_password(data.new_password)}}
    )
    return {"message": "Password updated"}
