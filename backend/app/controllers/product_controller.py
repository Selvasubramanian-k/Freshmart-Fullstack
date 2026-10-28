import re

from fastapi import HTTPException, status
from pymongo import ReturnDocument

from app.config import settings
from app.controllers.category_controller import ensure_category
from app.controllers.store_controller import get_admin_store_doc
from app.database import get_db
from app.models.product import ProductCreate, ProductUpdate, StockUpdate
from app.utils.helpers import now_utc, serialize, to_object_id


async def next_pid() -> int:
    """Auto-increment numeric product id (the customer cart uses numeric ids)."""
    doc = await get_db().counters.find_one_and_update(
        {"_id": "product_pid"}, {"$inc": {"seq": 1}}, upsert=True, return_document=ReturnDocument.AFTER
    )
    return doc["seq"]


def product_out(doc: dict, public: bool = False) -> dict:
    p = serialize(doc)
    if public:
        p.pop("expiry_date", None)   # expiry is only for the store admin
    mrp = p.get("mrp")
    p["discount"] = round((mrp - p["price"]) / mrp * 100) if mrp and mrp > p["price"] else None
    return p


# ---------------- Admin (shop owner) ----------------
async def create_product(admin: dict, data: ProductCreate) -> dict:
    store = await get_admin_store_doc(admin)
    await ensure_category(data.category)
    doc = {
        **data.model_dump(mode="json"),
        "pid": await next_pid(),
        "store_id": store["_id"],
        "created_at": now_utc(),
        "updated_at": now_utc(),
    }
    res = await get_db().products.insert_one(doc)
    doc["_id"] = res.inserted_id
    return product_out(doc)


async def list_store_products(admin: dict, q: str | None = None, category: str | None = None,
                              low_stock: bool = False) -> list[dict]:
    store = await get_admin_store_doc(admin)
    query: dict = {"store_id": store["_id"]}
    if q:
        query["name"] = {"$regex": re.escape(q), "$options": "i"}
    if category:
        query["category"] = category
    if low_stock:
        query["stock"] = {"$lte": settings.LOW_STOCK_THRESHOLD}
    docs = await get_db().products.find(query).sort("pid", -1).to_list(None)
    return [product_out(d) for d in docs]


async def _get_owned_product(admin: dict, pid: int) -> dict:
    store = await get_admin_store_doc(admin)
    product = await get_db().products.find_one({"pid": pid, "store_id": store["_id"]})
    if not product:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    return product


async def update_product(admin: dict, pid: int, data: ProductUpdate) -> dict:
    product = await _get_owned_product(admin, pid)
    updates = data.model_dump(mode="json", exclude_none=True)
    if not updates:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Nothing to update")
    if updates.get("category") != product.get("category"):
        await ensure_category(updates.get("category"))

    unset = {}
    if updates.get("mrp") == 0:          # 0 -> remove MRP
        updates.pop("mrp"); unset["mrp"] = ""
    if updates.get("expiry_date") == "":  # "" -> remove expiry
        updates.pop("expiry_date"); unset["expiry_date"] = ""

    price = updates.get("price", product["price"])
    mrp = None if "mrp" in unset else updates.get("mrp", product.get("mrp"))
    if mrp is not None and mrp < price:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "MRP cannot be less than selling price")

    updates["updated_at"] = now_utc()
    op = {"$set": updates}
    if unset:
        op["$unset"] = unset
    db = get_db()
    await db.products.update_one({"_id": product["_id"]}, op)
    return product_out(await db.products.find_one({"_id": product["_id"]}))


async def update_stock(admin: dict, pid: int, data: StockUpdate) -> dict:
    product = await _get_owned_product(admin, pid)
    await get_db().products.update_one(
        {"_id": product["_id"]}, {"$set": {"stock": data.stock, "updated_at": now_utc()}}
    )
    return {"pid": pid, "stock": data.stock}


async def delete_product(admin: dict, pid: int) -> dict:
    product = await _get_owned_product(admin, pid)
    await get_db().products.delete_one({"_id": product["_id"]})
    return {"message": "Product deleted"}


# ---------------- Public / Customer ----------------
async def browse_products(q: str | None = None, category: str | None = None,
                          store_id: str | None = None) -> list[dict]:
    """Active products from open stores. The customer app loads this once as its catalog."""
    db = get_db()
    store_query: dict = {"is_open": True, "status": {"$nin": ["pending", "rejected"]}}
    if store_id:
        store_query["_id"] = to_object_id(store_id, "store id")
    stores = await db.stores.find(store_query, {"name": 1}).to_list(None)
    names = {s["_id"]: s["name"] for s in stores}
    if not names:
        return []

    query: dict = {"store_id": {"$in": list(names)}, "is_active": True}
    if q:
        query["name"] = {"$regex": re.escape(q), "$options": "i"}
    if category:
        query["category"] = category
    docs = await db.products.find(query).sort("pid", 1).to_list(None)
    out = []
    for d in docs:
        d["store_name"] = names.get(d["store_id"], "")
        out.append(product_out(d, public=True))
    return out


async def get_product(pid: int) -> dict:
    product = await get_db().products.find_one({"pid": pid, "is_active": True})
    if not product:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    return product_out(product, public=True)
