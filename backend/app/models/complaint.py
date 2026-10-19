from enum import Enum

from pydantic import BaseModel, Field


class ComplaintType(str, Enum):
    RETURN = "return"
    REFUND = "refund"
    DAMAGED = "damaged"
    MISSING_ITEM = "missing_item"
    QUALITY = "quality"
    LATE_DELIVERY = "late_delivery"
    OTHER = "other"


class ComplaintStatus(str, Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    REJECTED = "rejected"


class ComplaintCreate(BaseModel):
    order_id: str
    type: ComplaintType
    description: str = Field(..., min_length=5, max_length=1000)


class ComplaintRespond(BaseModel):
    status: ComplaintStatus
    response: str = Field(..., min_length=2, max_length=1000)
