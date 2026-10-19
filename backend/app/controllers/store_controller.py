from bson import ObjectId
from fastapi import HTTPException, status

from app.database import get_db
from app.models.store import StoreAvailability, StoreUpdate
from app.utils.helpers import serialize, to_object_id


async def get_admin_store_doc(admin: dict) -> dict:
    """Return the raw store document owned by this admin (404 if missing)."""
    store = await get_db().stores.find_one({"owner_id": ObjectId(admin["id"])})
    if not store:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Store not found for this admin")
    return store


async def get_my_store(admin: dict) -> dict:
    return serialize(await get_admin_store_doc(admin))


async def update_my_store(admin: dict, data: StoreUpdate) -> dict:
    store = await get_admin_store_doc(admin)
    updates = data.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Nothing to update")
    db = get_db()
    await db.stores.update_one({"_id": store["_id"]}, {"$set": updates})
    return serialize(await db.stores.find_one({"_id": store["_id"]}))


async def set_availability(admin: dict, data: StoreAvailability) -> dict:
    store = await get_admin_store_doc(admin)
    await get_db().stores.update_one({"_id": store["_id"]}, {"$set": {"is_open": data.is_open}})
    return {"is_open": data.is_open}


# ---------- public ----------
async def list_stores(only_open: bool = False) -> list[dict]:
    query = {"is_open": True} if only_open else {}
    stores = await get_db().stores.find(query, {"gst_number": 0}).sort("name", 1).to_list(None)
    return serialize(stores)


async def get_store(store_id: str) -> dict:
    store = await get_db().stores.find_one({"_id": to_object_id(store_id, "store id")}, {"gst_number": 0})
    if not store:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Store not found")
    return serialize(store)
