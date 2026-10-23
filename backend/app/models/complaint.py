from enum import Enum

from pydantic import BaseModel, Field


class ComplaintType(str, Enum):
    RETURN = "return"
    REFUND = "refund"
    DAMAGED = "damaged"
    MISSING_ITEM = "missing_item"
    WRONG_ITEM = "wrong_item"
    QUALITY = "quality"
    EXPIRED = "expired"
    LATE_DELIVERY = "late_delivery"
    OTHER = "other"


class ComplaintStatus(str, Enum):
    OPEN = "open"                 # store is reviewing
    IN_PROGRESS = "in_progress"   # approved, exchange on the way
    RESOLVED = "resolved"         # money back / new item delivered
    REJECTED = "rejected"
    CANCELLED = "cancelled"       # customer withdrew it


class Resolution(str, Enum):
    REFUND = "refund"
    EXCHANGE = "exchange"


class RefundTo(str, Enum):
    CASH = "cash"       # FreshMart Cash wallet, instant
    SOURCE = "source"   # back to the original online payment


class ComplaintItem(BaseModel):
    pid: int
    quantity: int = Field(1, ge=1, le=50)


class ComplaintCreate(BaseModel):
    order_id: str
    type: ComplaintType
    description: str = Field(..., min_length=5, max_length=1000)
    # item problems on a delivered order (refund or exchange)
    items: list[ComplaintItem] = Field(default_factory=list, max_length=50)
    resolution: Resolution | None = None
    refund_to: RefundTo = RefundTo.CASH
    photos: list[str] = Field(default_factory=list, max_length=3)


class ComplaintRespond(BaseModel):
    # item requests: in_progress = approve, resolved = exchange delivered, rejected = no
    status: ComplaintStatus
    response: str = Field(..., min_length=2, max_length=1000)
