"""JWT authentication + role-based access dependencies."""
from bson import ObjectId
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import settings
from app.database import get_db
from app.utils.helpers import serialize
from app.utils.security import decode_access_token

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict:
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    payload = decode_access_token(creds.credentials)
    if not payload or not ObjectId.is_valid(payload.get("sub", "")):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")

    user = await get_db().users.find_one({"_id": ObjectId(payload["sub"])})
    if not user or not user.get("is_active", True):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found or disabled")
    if user.get("status", "active") != "active":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Your account is waiting for approval")
    if user.get("role") == "superadmin" and user.get("phone") not in settings.super_admin_phones:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This number is no longer a FreshMart owner")
    return serialize(user)


def require_role(*roles: str):
    """Usage: Depends(require_role("admin"))"""

    async def checker(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "You don't have access to this resource")
        return user

    return checker


require_customer = require_role("customer")
require_admin = require_role("admin")
require_superadmin = require_role("superadmin")
require_support = require_role("support", "superadmin")
require_picker = require_role("picker")
