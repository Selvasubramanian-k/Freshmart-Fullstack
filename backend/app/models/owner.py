"""FreshMart owner (super admin) panel."""
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field

from app.models.user import PHONE_PATTERN


class OwnerStoreCreate(BaseModel):
    owner_name: str = Field(..., min_length=2, max_length=80)
    phone: str = Field(..., pattern=PHONE_PATTERN)
    store_name: str = Field(..., min_length=2, max_length=100)
    line1: str = Field(..., min_length=3, max_length=200)
    area: str = Field(..., min_length=2, max_length=60)
    city: str = Field(default="Chennai", min_length=2, max_length=60)
    pincode: str = Field(..., pattern=r"^\d{6}$")
    gst_number: str | None = Field(default=None, max_length=15)
    commission_pct: float | None = Field(default=None, ge=0, le=50)


class OwnerStoreUpdate(BaseModel):
    commission_pct: float | None = Field(default=None, ge=0, le=50)
    enabled: bool | None = None      # turn a store off / on
    approve: bool | None = None      # old pending request: true = approve, false = reject


class AreasUpdate(BaseModel):
    areas_off: list[str] = Field(default_factory=list, max_length=200)


class CouponKind(str, Enum):
    FLAT = "flat"   # ₹ off
    PCT = "pct"     # % off (optional cap)


class CouponCreate(BaseModel):
    code: str = Field(..., pattern=r"^[A-Za-z0-9]{3,15}$")
    title: str = Field(..., min_length=3, max_length=80)
    kind: CouponKind = CouponKind.FLAT
    value: float = Field(..., gt=0, le=5000)
    max_off: float | None = Field(default=None, gt=0, le=5000)
    min_order: float = Field(default=0, ge=0, le=100000)
    ends_at: datetime | None = None


class CouponUpdate(BaseModel):
    active: bool | None = None
    title: str | None = Field(default=None, min_length=3, max_length=80)
    value: float | None = Field(default=None, gt=0, le=5000)
    min_order: float | None = Field(default=None, ge=0, le=100000)


class UserActive(BaseModel):
    is_active: bool


class AgentCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=80)
    phone: str = Field(..., pattern=PHONE_PATTERN)
