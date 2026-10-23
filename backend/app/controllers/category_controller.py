"""Product categories. Stored in MongoDB so the store admin can add / delete them.

The 9 original categories are seeded on startup (same ids the products already use),
so existing products keep working.
"""
import re

from fastapi import HTTPException, status

from app.controllers.store_controller import get_admin_store_doc
from app.database import get_db
from app.models.category import CategoryCreate
from app.utils.helpers import now_utc

DEFAULTS = [
    {"id": "dairy",     "label": "Dairy",           "icon": "milk",        "title": "Dairy & Eggs"},
    {"id": "fruits",    "label": "Fruits & Veg",    "icon": "apple",       "title": "Fruits & Vegetables", "badge": "30% OFF"},
    {"id": "meat",      "label": "Meat & Fish",     "icon": "fish",        "title": "Meat & Fish"},
    {"id": "snacks",    "label": "Snacks",          "icon": "popcorn",     "title": "Snacks & Munchies", "badge": "NEW"},
    {"id": "beverage",  "label": "Beverage",        "icon": "cup-soda",    "title": "Cold Drinks & Tea"},
    {"id": "breakfast", "label": "Breakfast",       "icon": "egg-fried",   "title": "Breakfast & Bakery"},
    {"id": "cooking",   "label": "Cooking",         "icon": "cooking-pot", "title": "Atta, Oil & Cooking"},
    {"id": "home",      "label": "Home & Cleaning", "icon": "spray-can",   "title": "Home & Cleaning"},
    {"id": "petcare",   "label": "Pet Care",        "icon": "paw-print",   "title": "Pet Care"},
]
FIELDS = ("id", "label", "title", "icon", "badge")


def _out(doc: dict) -> dict:
    return {k: doc[k] for k in FIELDS if doc.get(k)}


async def seed_defaults() -> None:
    """Insert the built-in categories once. Never overwrites admin edits, never re-adds a deleted one."""
    db = get_db()
    if await db.counters.find_one({"_id": "categories_seeded"}):
        return
    for i, c in enumerate(DEFAULTS):
        await db.categories.update_one(
            {"id": c["id"]}, {"$setOnInsert": {**c, "order": i, "builtin": True, "created_at": now_utc()}}, upsert=True
        )
    await db.counters.update_one({"_id": "categories_seeded"}, {"$set": {"at": now_utc()}}, upsert=True)


async def list_categories() -> list[dict]:
    docs = await get_db().categories.find({}).sort([("order", 1), ("created_at", 1)]).to_list(None)
    return [_out(d) for d in docs]


async def category_exists(cid: str) -> bool:
    return bool(await get_db().categories.find_one({"id": cid}, {"_id": 1}))


async def ensure_category(cid: str | None) -> None:
    if cid is not None and not await category_exists(cid):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Unknown category. Add it from Manage first.")


async def admin_list(admin: dict) -> list[dict]:
    store = await get_admin_store_doc(admin)
    db = get_db()
    counts = {r["_id"]: r["n"] async for r in await db.products.aggregate(
        [{"$match": {"store_id": store["_id"]}}, {"$group": {"_id": "$category", "n": {"$sum": 1}}}]
    )}
    return [{**c, "products": counts.get(c["id"], 0)} for c in await list_categories()]


def _slug(label: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", label.lower()).strip("-")[:40]


async def create_category(admin: dict, data: CategoryCreate) -> dict:
    await get_admin_store_doc(admin)
    label = " ".join(data.label.split())
    cid = _slug(label)
    if len(cid) < 2:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Use letters or numbers in the name.")
    db = get_db()
    if await db.categories.find_one({"$or": [{"id": cid}, {"label": {"$regex": f"^{re.escape(label)}$", "$options": "i"}}]}):
        raise HTTPException(status.HTTP_409_CONFLICT, f"“{label}” already exists.")
    last = await db.categories.find_one({}, sort=[("order", -1)])
    doc = {"id": cid, "label": label, "title": (data.title or "").strip() or label, "icon": "shopping-bag",
           "order": (last or {}).get("order", 0) + 1, "builtin": False, "created_at": now_utc()}
    await db.categories.insert_one(doc)
    return {**_out(doc), "products": 0}


async def delete_category(admin: dict, cid: str) -> dict:
    await get_admin_store_doc(admin)
    db = get_db()
    if not await category_exists(cid):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Category not found")
    n = await db.products.count_documents({"category": cid})
    if n:
        raise HTTPException(status.HTTP_409_CONFLICT, f"{n} product{'s' if n > 1 else ''} use this category. Move them first.")
    await db.categories.delete_one({"id": cid})
    return {"deleted": cid}
