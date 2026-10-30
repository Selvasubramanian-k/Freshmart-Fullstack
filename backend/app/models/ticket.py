"""Support / operations inbox (tickets = the `complaints` collection, across all stores)."""
from enum import Enum

from pydantic import BaseModel, Field


class TicketAction(str, Enum):
    REPLY = "reply"                    # text to the customer
    REFUND = "refund"                  # amount + to (cash = FreshMart wallet, source = original payment)
    APPROVE_REFUND = "approve_refund"  # owner only: big refund waiting
    REJECT_REFUND = "reject_refund"    # owner only
    CANCEL_ORDER = "cancel_order"
    ASSIGN_RIDER = "assign_rider"      # nearest free rider
    SUBSTITUTE = "substitute"          # picker found an item missing: accept the suggested one
    REMOVE_ITEM = "remove_item"        # ... or remove it and refund it
    ESCALATE = "escalate"              # send to the FreshMart owner
    RESOLVE = "resolve"
    REJECT = "reject"


class RefundTo(str, Enum):
    CASH = "cash"
    SOURCE = "source"


class TicketActionIn(BaseModel):
    action: TicketAction
    text: str | None = Field(default=None, max_length=1000)
    amount: float | None = Field(default=None, gt=0, le=100000)
    to: RefundTo = RefundTo.CASH
