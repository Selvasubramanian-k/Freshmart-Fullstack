"""Marketplace-wide settings the FreshMart owner controls (one document in `platform`)."""
from app.config import settings
from app.database import get_db

DEFAULTS = {
    "areas_off": [], "refund_approval_above": 500.0,
    # what the customer pays for delivery
    "delivery_fee": 25.0, "free_delivery_above": 499.0,
    # what the rider earns per delivery: base + per km (store -> customer) + the full tip
    "rider_base_fee": 20.0, "rider_per_km": 5.0, "rider_km_when_unknown": 3.0, "rider_max_km_pay": 10.0,
}
ROAD_FACTOR = 1.3   # straight line -> roughly road distance


async def get_platform() -> dict:
    doc = await get_db().platform.find_one({"_id": "settings"}) or {}
    return {**DEFAULTS, **{k: v for k, v in doc.items() if k != "_id"}}


async def set_platform(updates: dict) -> dict:
    await get_db().platform.update_one({"_id": "settings"}, {"$set": updates}, upsert=True)
    return await get_platform()


def commission_pct(store: dict | None) -> float:
    """Each store can have its own commission; else the default from .env."""
    v = (store or {}).get("commission_pct")
    return float(v) if v is not None else settings.PLATFORM_COMMISSION_PERCENT


def _km(a: dict | None, b: dict | None) -> float | None:
    from math import asin, cos, radians, sin, sqrt
    if not a or not b or a.get("lat") is None or b.get("lat") is None:
        return None
    dlat, dlng = radians(b["lat"] - a["lat"]), radians(b["lng"] - a["lng"])
    h = sin(dlat / 2) ** 2 + cos(radians(a["lat"])) * cos(radians(b["lat"])) * sin(dlng / 2) ** 2
    return 6371 * 2 * asin(sqrt(h)) * ROAD_FACTOR


def customer_delivery_fee(p: dict, subtotal: float) -> float:
    return 0.0 if subtotal >= float(p["free_delivery_above"]) else float(p["delivery_fee"])


def rider_pay(p: dict, store: dict | None, drop: dict | None, tip: float) -> dict:
    """Saved on the order when it is placed, so later setting changes don't change old orders."""
    km = _km((store or {}).get("address") or store, drop)
    known = km is not None
    km = round(min(km if known else float(p["rider_km_when_unknown"]), float(p["rider_max_km_pay"])), 1)
    distance = float(round(km * float(p["rider_per_km"])))   # whole rupees
    base = float(p["rider_base_fee"])
    return {"base": base, "km": km, "km_known": known, "per_km": float(p["rider_per_km"]), "distance": distance,
            "tip": round(tip, 2), "total": round(base + distance + tip, 2)}


def store_area(store: dict) -> str:
    return (store.get("area") or (store.get("address") or {}).get("city") or "").strip()


async def hidden_store_filter() -> dict:
    """Mongo filter for stores customers may see (approved, not turned off, area switched on)."""
    q: dict = {"status": {"$nin": ["pending", "rejected", "disabled"]}}
    off = (await get_platform())["areas_off"]
    if off:
        q["area"] = {"$nin": off}
    return q
