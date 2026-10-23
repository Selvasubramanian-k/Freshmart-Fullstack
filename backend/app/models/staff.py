from enum import Enum

from pydantic import BaseModel, EmailStr, Field

from app.models.user import PHONE_PATTERN


class StaffRole(str, Enum):
    MANAGER = "manager"
    PICKER = "picker"
    PACKER = "packer"
    CASHIER = "cashier"
    DELIVERY = "delivery"   # store's own delivery staff: gets a login for the delivery partner app


class StaffCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=80)
    phone: str = Field(..., pattern=PHONE_PATTERN)
    email: EmailStr | None = None
    role: StaffRole
    shift: str = Field(default="Morning", max_length=30)
    # only for role=delivery (login for the delivery partner app)
    password: str | None = Field(default=None, min_length=6, max_length=64)
    vehicle_number: str | None = Field(default=None, max_length=20)


class StaffUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=80)
    phone: str | None = Field(default=None, pattern=PHONE_PATTERN)
    email: EmailStr | None = None
    role: StaffRole | None = None
    shift: str | None = Field(default=None, max_length=30)
    is_active: bool | None = None
