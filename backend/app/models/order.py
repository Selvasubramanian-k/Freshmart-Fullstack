from enum import Enum

from pydantic import BaseModel, Field


class PaymentMethod(str, Enum):
    GPAY = "gpay"
    PHONEPE = "phonepe"
    PAYTM = "paytm"
    BHIM = "bhim"
    CARD = "card"
    NET_BANKING = "nb"
    COD = "cod"


class PaymentStatus(str, Enum):
    PENDING = "pending"
    PAID = "paid"
    REFUNDED = "refunded"


class OrderStatus(str, Enum):
    PLACED = "placed"
    CONFIRMED = "confirmed"
    PACKED = "packed"
    OUT_FOR_DELIVERY = "out_for_delivery"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"
    RETURN_REQUESTED = "return_requested"
    RETURNED = "returned"


# Store admin can move an order only along these steps
ALLOWED_TRANSITIONS: dict[str, list[str]] = {
    "placed": ["confirmed", "cancelled"],
    "confirmed": ["packed", "cancelled"],
    "packed": ["out_for_delivery", "cancelled"],
    "out_for_delivery": ["delivered"],
    "delivered": [],
    "cancelled": [],
    "return_requested": [],  # decided through the complaint
    "returned": [],
}

CUSTOMER_CANCELLABLE = {"placed", "confirmed"}


class OrderItemIn(BaseModel):
    pid: int = Field(..., ge=1)            # numeric product id (same id the frontend cart uses)
    quantity: int = Field(..., ge=1, le=50)


class DeliveryAddress(BaseModel):
    label: str = Field(default="Home", max_length=20)
    text: str = Field(..., min_length=5, max_length=300)
    lat: float | None = Field(default=None, ge=-90, le=90)
    lng: float | None = Field(default=None, ge=-180, le=180)


class CardInfo(BaseModel):
    last4: str = Field(..., pattern=r"^\d{4}$")
    name: str = Field(..., max_length=80)


class OrderCreate(BaseModel):
    items: list[OrderItemIn] = Field(..., min_length=1, max_length=100)
    address: DeliveryAddress
    instructions: list[str] = Field(default_factory=list, max_length=6)
    slot: str = Field(default="now", pattern=r"^(now|hour|night|morn)$")
    tip: float = Field(default=0, ge=0, le=500)
    payment_method: PaymentMethod
    coupon_code: str | None = Field(default=None, max_length=20)
    bank: str | None = Field(default=None, max_length=60)   # for net banking
    card: CardInfo | None = None                            # mock: only last 4 digits stored


class OrderStatusUpdate(BaseModel):
    status: OrderStatus
    note: str | None = Field(default=None, max_length=200)


class RateRequest(BaseModel):
    stars: int = Field(..., ge=1, le=5)


class CancelRequest(BaseModel):
    reason: str | None = Field(default=None, max_length=200)
    message: str | None = Field(default=None, max_length=300)   # optional note for the store
