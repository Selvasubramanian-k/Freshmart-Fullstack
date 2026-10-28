"""In-store (counter) sales: a customer buys at the shop, the store bills them in the admin app."""
from enum import Enum

from pydantic import BaseModel, Field

from app.models.user import PHONE_PATTERN


class SalePayment(str, Enum):
    CASH = "cash"
    UPI = "upi"
    CARD = "card"


class SaleItem(BaseModel):
    pid: int
    quantity: int = Field(..., ge=1, le=999)


class SaleCreate(BaseModel):
    items: list[SaleItem] = Field(..., min_length=1, max_length=100)
    payment_method: SalePayment
    cash_given: float | None = Field(default=None, ge=0)          # cash only, to work out change
    customer_phone: str | None = Field(default=None, pattern=PHONE_PATTERN)  # for a WhatsApp bill
