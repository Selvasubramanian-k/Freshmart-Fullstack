from fastapi import HTTPException, status

from app.controllers.store_controller import get_admin_store_doc
from app.database import get_db
from app.models.staff import StaffCreate, StaffUpdate
from app.utils.helpers import now_utc, serialize, to_object_id
from app.utils.security import hash_password


async def list_staff(admin: dict) -> list[dict]:
    store = await get_admin_store_doc(admin)
    docs = await get_db().staff.find({"store_id": store["_id"]}).sort("created_at", -1).to_list(None)
    return serialize(docs)


async def add_staff(admin: dict, data: StaffCreate) -> dict:
    store = await get_admin_store_doc(admin)
    db = get_db()
    if await db.staff.find_one({"store_id": store["_id"], "phone": data.phone}):
        raise HTTPException(status.HTTP_409_CONFLICT, "A staff member with this phone already exists")
    doc = {**data.model_dump(mode="json", exclude={"password", "vehicle_number"}),
           "store_id": store["_id"], "is_active": True, "created_at": now_utc()}

    if data.role.value == "delivery":
        # store's own delivery staff: a delivery-app login that only gets this store's orders
        if not data.email or not data.password:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Delivery staff need an email and a password to log in to the delivery app")
        email = data.email.lower()
        if await db.users.find_one({"email": email}):
            raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists")
        user = {
            "name": data.name, "email": email, "phone": data.phone, "role": "delivery",
            "password_hash": hash_password(data.password),
            "vehicle": {"type": "scooter", "number": (data.vehicle_number or "").upper() or None},
            "city": store.get("address", {}).get("city"), "is_online": False, "active_order_id": None,
            "store_id": store["_id"], "in_house": True, "is_active": True, "created_at": now_utc(),
        }
        u = await db.users.insert_one(user)
        doc.update({"email": email, "user_id": u.inserted_id})

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
    if doc.get("user_id"):  # keep the delivery-app login in step
        sync = {k: updates[k] for k in ("name", "phone", "is_active") if k in updates}
        if sync:
            await db.users.update_one({"_id": doc["user_id"]}, {"$set": sync})
    return serialize(await db.staff.find_one({"_id": doc["_id"]}))


async def remove_staff(admin: dict, staff_id: str) -> dict:
    doc = await _owned(admin, staff_id)
    await get_db().staff.delete_one({"_id": doc["_id"]})
    if doc.get("user_id"):  # their delivery-app login stops working
        await get_db().users.update_one({"_id": doc["user_id"]}, {"$set": {"is_active": False, "is_online": False}})
    return {"message": "Staff member removed"}
