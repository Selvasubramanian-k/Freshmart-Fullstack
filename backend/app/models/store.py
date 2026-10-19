from pydantic import BaseModel, Field

from app.models.common import Address

TIME_PATTERN = r"^([01]\d|2[0-3]):[0-5]\d$"


class StoreCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    address: Address
    gst_number: str | None = Field(default=None, max_length=15)
    category: str = Field(default="Grocery", max_length=50)
    open_time: str = Field(default="08:00", pattern=TIME_PATTERN)
    close_time: str = Field(default="22:00", pattern=TIME_PATTERN)
    delivery_radius_km: float = Field(default=5, gt=0, le=50)


class StoreUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=100)
    address: Address | None = None
    gst_number: str | None = Field(default=None, max_length=15)
    category: str | None = Field(default=None, max_length=50)
    open_time: str | None = Field(default=None, pattern=TIME_PATTERN)
    close_time: str | None = Field(default=None, pattern=TIME_PATTERN)
    delivery_radius_km: float | None = Field(default=None, gt=0, le=50)


class StoreAvailability(BaseModel):
    is_open: bool
