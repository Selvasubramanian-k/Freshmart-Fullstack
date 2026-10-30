"""Bill calculation. Mirrors the rules shown in the customer checkout UI,
but the backend is the source of truth: the total is always recomputed here."""

DELIVERY_FEE = 5.0
# Coupons live in the `coupons` collection (FreshMart owner -> Areas & offers). FRESH20 is added once on start.
DEFAULT_COUPON = {"code": "FRESH20", "title": "₹20 off your order", "kind": "flat", "value": 20.0,
                  "max_off": None, "min_order": 100.0, "active": True, "used": 0}

# type: pct (percent off, capped) | flat (rupees off) | cashback (credited later, price same)
METHOD_OFFERS = {
    "gpay": {"type": "pct", "value": 10, "cap": 30},
    "phonepe": {"type": "cashback", "value": 15},
    "paytm": {"type": "flat", "value": 10},
    "card": {"type": "pct", "value": 5, "cap": 25},
}


def method_offer(method: str, base: float) -> tuple[float, float]:
    """Returns (discount, cashback)"""
    o = METHOD_OFFERS.get(method)
    if not o:
        return 0.0, 0.0
    if o["type"] == "pct":
        return min(base * o["value"] / 100, o["cap"]), 0.0
    if o["type"] == "flat":
        return float(o["value"]), 0.0
    if o["type"] == "cashback":
        return 0.0, float(o["value"])
    return 0.0, 0.0


def coupon_discount(rule: dict, subtotal: float) -> float:
    if rule.get("kind") == "pct":
        off = subtotal * float(rule["value"]) / 100
        if rule.get("max_off"):
            off = min(off, float(rule["max_off"]))
    else:
        off = float(rule["value"])
    return round(min(off, subtotal), 2)


async def validate_coupon(code: str | None, subtotal: float) -> tuple[str | None, float]:
    """Returns (normalised code, discount). Raises ValueError for a bad coupon."""
    from app.database import get_db
    from app.utils.helpers import now_utc
    if not code:
        return None, 0.0
    code = code.strip().upper()
    rule = await get_db().coupons.find_one({"code": code, "active": True})
    if not rule:
        raise ValueError("That coupon code is not valid")
    ends = rule.get("ends_at")
    if ends and (ends if ends.tzinfo else ends.replace(tzinfo=now_utc().tzinfo)) < now_utc():
        raise ValueError("This coupon has ended")
    if subtotal < float(rule.get("min_order") or 0):
        raise ValueError(f"Coupon needs a minimum order of ₹{float(rule['min_order']):.0f}")
    return code, coupon_discount(rule, subtotal)


def compute_bill(subtotal: float, method: str, tip: float, coupon_off: float) -> dict:
    base = subtotal + DELIVERY_FEE - coupon_off
    method_off, cashback = method_offer(method, base)
    total = max(0.0, base + tip - method_off)
    return {
        "subtotal": round(subtotal, 2),
        "delivery_fee": DELIVERY_FEE,
        "tip": round(tip, 2),
        "coupon_discount": round(coupon_off, 2),
        "payment_discount": round(method_off, 2),
        "cashback": round(cashback, 2),
        "total": round(total, 2),
    }


def split_share(amount: float, part: float, whole: float) -> float:
    """Proportionally split an order-level amount (fee/discount) between store sub-orders."""
    return round(amount * part / whole, 2) if whole else 0.0
