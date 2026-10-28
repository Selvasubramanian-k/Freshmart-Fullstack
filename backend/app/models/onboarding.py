"""Mobile OTP login + sign-up (customer, store owner, delivery partner)."""
from pydantic import BaseModel, EmailStr, Field

from app.models.store import StoreCreate
from app.models.user import PHONE_PATTERN, Vehicle

OTP_PATTERN = r"^\d{6}$"


class OtpSend(BaseModel):
    phone: str = Field(..., pattern=PHONE_PATTERN)


class OtpVerify(BaseModel):
    phone: str = Field(..., pattern=PHONE_PATTERN)
    code: str = Field(..., pattern=OTP_PATTERN)


class CustomerSignup(BaseModel):
    signup_token: str = Field(..., min_length=10)
    name: str = Field(..., min_length=2, max_length=80)
    email: EmailStr | None = None


class StoreSignup(BaseModel):
    signup_token: str = Field(..., min_length=10)
    name: str = Field(..., min_length=2, max_length=80)          # owner name
    email: EmailStr | None = None
    store: StoreCreate


class RiderSignup(BaseModel):
    signup_token: str = Field(..., min_length=10)
    name: str = Field(..., min_length=2, max_length=80)
    vehicle: Vehicle
    licence_number: str | None = Field(default=None, max_length=30)
    licence_photo: str | None = Field(default=None, max_length=300)   # "/uploads/x.jpg"
    area: str = Field(..., min_length=2, max_length=80)


class RequestDecision(BaseModel):
    note: str | None = Field(default=None, max_length=200)
