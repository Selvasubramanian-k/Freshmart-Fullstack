"""Mobile OTP login (every role)."""
from pydantic import BaseModel, Field

from app.models.user import PHONE_PATTERN

OTP_PATTERN = r"^\d{6}$"


class OtpSend(BaseModel):
    phone: str = Field(..., pattern=PHONE_PATTERN)


class OtpVerify(BaseModel):
    phone: str = Field(..., pattern=PHONE_PATTERN)
    code: str = Field(..., pattern=OTP_PATTERN)


class RequestDecision(BaseModel):
    note: str | None = Field(default=None, max_length=200)
