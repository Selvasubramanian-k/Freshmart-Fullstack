from pydantic import BaseModel, Field


class OnlineToggle(BaseModel):
    is_online: bool


class LocationUpdate(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    heading: float | None = Field(default=None, ge=0, le=360)
    speed: float | None = Field(default=None, ge=0, le=200)   # km/h


class DeliverRequest(BaseModel):
    code: str = Field(..., pattern=r"^\d{4}$")
    cash_collected: bool = False
