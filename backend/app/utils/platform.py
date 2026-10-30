"""Marketplace-wide settings the FreshMart owner controls (one document in `platform`)."""
from app.config import settings
from app.database import get_db

DEFAULTS = {"areas_off": [], "refund_approval_above": 500.0}


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


def store_area(store: dict) -> str:
    return (store.get("area") or (store.get("address") or {}).get("city") or "").strip()


async def hidden_store_filter() -> dict:
    """Mongo filter for stores customers may see (approved, not turned off, area switched on)."""
    q: dict = {"status": {"$nin": ["pending", "rejected", "disabled"]}}
    off = (await get_platform())["areas_off"]
    if off:
        q["area"] = {"$nin": off}
    return q
