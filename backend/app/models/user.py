from enum import Enum

from pydantic import BaseModel, EmailStr, Field, model_validator

from app.models.common import Address
from app.models.store import StoreCreate

PHONE_PATTERN = r"^[6-9]\d{9}$"


class Role(str, Enum):
    CUSTOMER = "customer"
    ADMIN = "admin"        # Shop Owner / Store Admin
    DELIVERY = "delivery"  # Delivery Partner
    # Future roles: super_admin, picker, support


class VehicleType(str, Enum):
    BIKE = "bike"
    SCOOTER = "scooter"
    CYCLE = "cycle"


class Vehicle(BaseModel):
    type: VehicleType = VehicleType.SCOOTER
    number: str = Field(default="", max_length=15)   # cycle: can be empty


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
    # delivery partner only
    vehicle: Vehicle | None = None
    city: str | None = Field(default=None, max_length=60)

    @model_validator(mode="after")
    def check_role_details(self):
        if self.role == Role.CUSTOMER and self.address is None:
            raise ValueError("Address is required for customer registration")
        if self.role == Role.ADMIN and self.store is None:
            raise ValueError("Store details are required for admin registration")
        if self.role == Role.DELIVERY:
            if self.vehicle is None:
                raise ValueError("Vehicle details are required for delivery partners")
            if self.vehicle.type != VehicleType.CYCLE and len(self.vehicle.number.strip()) < 4:
                raise ValueError("Please enter your vehicle number")
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
