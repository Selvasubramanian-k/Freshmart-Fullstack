from bson import ObjectId
from fastapi import HTTPException, status

from app.database import get_db
from app.models.user import ChangePassword, LoginRequest, ProfileUpdate
from app.utils.helpers import serialize
from app.utils.security import create_access_token, hash_password, verify_password


def _auth_response(user: dict) -> dict:
    user = serialize(user)
    return {
        "access_token": create_access_token(user["id"], user["role"]),
        "token_type": "bearer",
        "user": user,
    }


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
