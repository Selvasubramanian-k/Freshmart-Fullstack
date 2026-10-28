from datetime import timedelta

import bcrypt
import jwt

from app.config import settings
from app.utils.helpers import now_utc


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        return False


def create_access_token(user_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "exp": now_utc() + timedelta(minutes=settings.JWT_EXPIRE_MINUTES),
        "iat": now_utc(),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except jwt.PyJWTError:
        return None


SIGNUP_TOKEN_MINUTES = 20


def create_signup_token(phone: str) -> str:
    """Short-lived proof that this phone number passed the OTP check (used to finish sign-up)."""
    payload = {"sub": phone, "purpose": "signup", "iat": now_utc(),
               "exp": now_utc() + timedelta(minutes=SIGNUP_TOKEN_MINUTES)}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_signup_token(token: str) -> str | None:
    """Returns the verified phone number, or None."""
    data = decode_access_token(token)
    if not data or data.get("purpose") != "signup":
        return None
    return data.get("sub")
