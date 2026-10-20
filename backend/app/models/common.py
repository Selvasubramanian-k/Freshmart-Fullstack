from pydantic import BaseModel, Field


class Address(BaseModel):
    line1: str = Field(..., min_length=3, max_length=200)
    line2: str | None = Field(default=None, max_length=200)
    city: str = Field(..., min_length=2, max_length=60)
    state: str = Field(default="Tamil Nadu", max_length=60)
    pincode: str = Field(..., pattern=r"^\d{6}$")
    landmark: str | None = Field(default=None, max_length=100)
    # map location (optional): filled by "use my current location" or geocoding
    lat: float | None = Field(default=None, ge=-90, le=90)
    lng: float | None = Field(default=None, ge=-180, le=180)
