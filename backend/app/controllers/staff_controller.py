from fastapi import HTTPException, status

from app.controllers.store_controller import get_admin_store_doc
from app.database import get_db
from app.models.staff import StaffCreate, StaffUpdate
from app.utils.helpers import now_utc, serialize, to_object_id


async def list_staff(admin: dict) -> list[dict]:
    store = await get_admin_store_doc(admin)
    docs = await get_db().staff.find({"store_id": store["_id"]}).sort("created_at", -1).to_list(None)
    return serialize(docs)


async def add_staff(admin: dict, data: StaffCreate) -> dict:
    store = await get_admin_store_doc(admin)
    db = get_db()
    if await db.staff.find_one({"store_id": store["_id"], "phone": data.phone}):
        raise HTTPException(status.HTTP_409_CONFLICT, "A staff member with this phone already exists")
    doc = {**data.model_dump(mode="json"), "store_id": store["_id"], "is_active": True, "created_at": now_utc()}
    res = await db.staff.insert_one(doc)
    doc["_id"] = res.inserted_id
    return serialize(doc)


async def _owned(admin: dict, staff_id: str) -> dict:
    store = await get_admin_store_doc(admin)
    doc = await get_db().staff.find_one({"_id": to_object_id(staff_id, "staff id"), "store_id": store["_id"]})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Staff member not found")
    return doc


async def update_staff(admin: dict, staff_id: str, data: StaffUpdate) -> dict:
    doc = await _owned(admin, staff_id)
    updates = data.model_dump(mode="json", exclude_none=True)
    if not updates:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Nothing to update")
    db = get_db()
    await db.staff.update_one({"_id": doc["_id"]}, {"$set": updates})
    return serialize(await db.staff.find_one({"_id": doc["_id"]}))


async def remove_staff(admin: dict, staff_id: str) -> dict:
    doc = await _owned(admin, staff_id)
    await get_db().staff.delete_one({"_id": doc["_id"]})
    return {"message": "Staff member removed"}
