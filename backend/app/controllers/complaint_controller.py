from bson import ObjectId
from fastapi import HTTPException, status

from app.controllers.store_controller import get_admin_store_doc
from app.database import get_db
from app.models.complaint import ComplaintCreate, ComplaintRespond
from app.utils.helpers import now_utc, serialize, to_object_id


# ---------------- Customer ----------------
async def create_complaint(customer: dict, data: ComplaintCreate) -> dict:
    db = get_db()
    order = await db.orders.find_one(
        {"_id": to_object_id(data.order_id, "order id"), "customer_id": ObjectId(customer["id"])}
    )
    if not order:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")

    if data.type.value == "return":
        if order["status"] != "delivered":
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only delivered orders can be returned")
    existing = await db.complaints.find_one(
        {"order_id": order["_id"], "type": data.type.value, "status": {"$in": ["open", "in_progress"]}}
    )
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "You already have an open request of this type for this order")

    now = now_utc()
    doc = {
        "order_id": order["_id"],
        "order_number": order["order_number"],
        "store_id": order["store_id"],
        "customer_id": order["customer_id"],
        "customer_name": customer["name"],
        "customer_phone": customer.get("phone"),
        "type": data.type.value,
        "description": data.description,
        "status": "open",
        "response": None,
        "created_at": now,
        "updated_at": now,
    }
    res = await db.complaints.insert_one(doc)
    doc["_id"] = res.inserted_id

    if data.type.value == "return":
        await db.orders.update_one(
            {"_id": order["_id"]},
            {"$set": {"status": "return_requested", "updated_at": now},
             "$push": {"status_history": {"status": "return_requested", "at": now, "note": data.description}}},
        )
    return serialize(doc)


async def my_complaints(customer: dict) -> list[dict]:
    docs = await get_db().complaints.find({"customer_id": ObjectId(customer["id"])}).sort("created_at", -1).to_list(None)
    return serialize(docs)


# ---------------- Store admin ----------------
async def store_complaints(admin: dict, status_filter: str | None = None) -> list[dict]:
    store = await get_admin_store_doc(admin)
    query: dict = {"store_id": store["_id"]}
    if status_filter:
        query["status"] = status_filter
    docs = await get_db().complaints.find(query).sort("created_at", -1).to_list(500)
    return serialize(docs)


async def respond_complaint(admin: dict, complaint_id: str, data: ComplaintRespond) -> dict:
    store = await get_admin_store_doc(admin)
    db = get_db()
    c = await db.complaints.find_one({"_id": to_object_id(complaint_id, "complaint id"), "store_id": store["_id"]})
    if not c:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Complaint not found")
    if c["status"] in ("resolved", "rejected"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This complaint is already closed")

    now = now_utc()
    await db.complaints.update_one(
        {"_id": c["_id"]},
        {"$set": {"status": data.status.value, "response": data.response, "updated_at": now}},
    )

    order = await db.orders.find_one({"_id": c["order_id"]})
    if order and data.status.value in ("resolved", "rejected"):
        if c["type"] == "return":
            new_status = "returned" if data.status.value == "resolved" else "delivered"
            updates = {"status": new_status, "updated_at": now}
            if new_status == "returned" and order["payment"]["status"] == "paid":
                updates["payment.status"] = "refunded"
                updates["payment.refunded_at"] = now
            note = f"Return {'approved' if new_status == 'returned' else 'rejected'}: {data.response}"
            await db.orders.update_one(
                {"_id": order["_id"]},
                {"$set": updates, "$push": {"status_history": {"status": new_status, "at": now, "note": note}}},
            )
        elif c["type"] == "refund" and data.status.value == "resolved" and order["payment"]["status"] == "paid":
            await db.orders.update_one(
                {"_id": order["_id"]},
                {"$set": {"payment.status": "refunded", "payment.refunded_at": now, "updated_at": now}},
            )

    return serialize(await db.complaints.find_one({"_id": c["_id"]}))
