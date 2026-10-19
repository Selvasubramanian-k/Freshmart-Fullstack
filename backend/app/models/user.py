from enum import Enum

from pydantic import BaseModel, EmailStr, Field, model_validator

from app.models.common import Address
from app.models.store import StoreCreate

PHONE_PATTERN = r"^[6-9]\d{9}$"


class Role(str, Enum):
    CUSTOMER = "customer"
    ADMIN = "admin"  # Shop Owner / Store Admin
    # Future roles: delivery, super_admin, picker, support


class RegisterRequest(BaseModel):
    role: Role
    name: str = Field(..., min_length=2, max_length=80)
    email: EmailStr
    phone: str = Field(..., pattern=PHONE_PATTERN)
    password: str = Field(..., min_length=6, max_length=72)
    # customer only
    address: Address | None = None
    # admin only
    store: StoreCreate | None = None

    @model_validator(mode="after")
    def check_role_details(self):
        if self.role == Role.CUSTOMER and self.address is None:
            raise ValueError("Address is required for customer registration")
        if self.role == Role.ADMIN and self.store is None:
            raise ValueError("Store details are required for admin registration")
        return self


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1)


class ProfileUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=80)
    phone: str | None = Field(default=None, pattern=PHONE_PATTERN)
    address: Address | None = None


class ChangePassword(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=6, max_length=72)
