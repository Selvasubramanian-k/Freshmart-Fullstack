import secrets

from bson import ObjectId
from fastapi import HTTPException, status

from app.controllers.store_controller import get_admin_store_doc
from app.database import get_db
from app.models.complaint import ComplaintCreate, ComplaintRespond
from app.utils.helpers import now_utc, serialize, to_object_id

ITEM_PROBLEMS = {"damaged", "missing_item", "wrong_item", "quality", "expired"}
OPEN = ["open", "in_progress"]


def _hist(status_: str, note: str, at=None) -> dict:
    return {"status": status_, "at": at or now_utc(), "note": note}


async def _credit_wallet(user_id: ObjectId, amount: float, note: str) -> None:
    db = get_db()
    await db.users.update_one({"_id": user_id}, {"$inc": {"wallet_balance": round(amount, 2)}})
    await db.wallet_txns.insert_one({"user_id": user_id, "amount": round(amount, 2), "note": note, "at": now_utc()})


# ---------------- Customer ----------------
async def create_complaint(customer: dict, data: ComplaintCreate) -> dict:
    db = get_db()
    order = await db.orders.find_one(
        {"_id": to_object_id(data.order_id, "order id"), "customer_id": ObjectId(customer["id"])}
    )
    if not order:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")

    now = now_utc()
    doc = {
        "order_id": order["_id"],
        "order_number": order["order_number"],
        "store_id": order["store_id"],
        "store_name": order.get("store_name"),
        "customer_id": order["customer_id"],
        "customer_name": customer["name"],
        "customer_phone": customer.get("phone"),
        "type": data.type.value,
        "description": data.description,
        "status": "open",
        "response": None,
        "history": [_hist("open", "Request sent", now)],
        "created_at": now,
        "updated_at": now,
    }

    if data.resolution:  # ---- refund / exchange for items in a delivered order ----
        if order["status"] != "delivered":
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "You can ask for a refund or exchange after the order is delivered")
        if data.type.value not in ITEM_PROBLEMS:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Pick what went wrong with the items")
        if not data.items:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Pick at least one item")
        if await db.complaints.find_one({"order_id": order["_id"], "resolution": {"$exists": True}, "status": {"$in": OPEN}}):
            raise HTTPException(status.HTTP_409_CONFLICT, "This order already has an open request")
        lines = {i["pid"]: i for i in order["items"]}
        picked, amount = [], 0.0
        for it in data.items:
            line = lines.get(it.pid)
            if not line:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, "That item is not in this order")
            qty = min(it.quantity, line["quantity"])
            each = line["line_total"] / line["quantity"]
            amount += each * qty
            picked.append({"pid": it.pid, "name": line["name"], "unit": line.get("unit", ""),
                           "image_url": line.get("image_url"), "quantity": qty, "amount": round(each * qty, 2)})
        photos = [p for p in data.photos if isinstance(p, str) and p.startswith("/uploads/")]
        refund_to = data.refund_to.value
        if order["payment"]["method"] == "cod":
            refund_to = "cash"  # cash orders: refund goes to FreshMart Cash
        doc.update({
            "items": picked,
            "amount": round(amount, 2),
            "resolution": data.resolution.value,
            "refund_to": refund_to if data.resolution.value == "refund" else None,
            "payment_method": order["payment"]["method"],
            "photos": photos,
        })
    else:  # ---- older simple requests (late delivery, other, return of whole order) ----
        if data.type.value == "return" and order["status"] != "delivered":
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only delivered orders can be returned")
        if await db.complaints.find_one({"order_id": order["_id"], "type": data.type.value, "status": {"$in": OPEN}}):
            raise HTTPException(status.HTTP_409_CONFLICT, "You already have an open request of this type for this order")

    res = await db.complaints.insert_one(doc)
    doc["_id"] = res.inserted_id

    if data.type.value == "return" and not data.resolution:
        await db.orders.update_one(
            {"_id": order["_id"]},
            {"$set": {"status": "return_requested", "updated_at": now},
             "$push": {"status_history": {"status": "return_requested", "at": now, "note": data.description}}},
        )
    return serialize(doc)


async def my_complaints(customer: dict) -> list[dict]:
    docs = await get_db().complaints.find({"customer_id": ObjectId(customer["id"])}).sort("created_at", -1).to_list(None)
    return serialize(docs)


async def cancel_my_complaint(customer: dict, complaint_id: str) -> dict:
    db = get_db()
    c = await db.complaints.find_one({"_id": to_object_id(complaint_id, "request id"), "customer_id": ObjectId(customer["id"])})
    if not c:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Request not found")
    if c["status"] != "open":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only a request still under review can be cancelled")
    now = now_utc()
    await db.complaints.update_one(
        {"_id": c["_id"]},
        {"$set": {"status": "cancelled", "updated_at": now}, "$push": {"history": _hist("cancelled", "Cancelled by you", now)}},
    )
    return serialize(await db.complaints.find_one({"_id": c["_id"]}))


async def my_wallet(customer: dict) -> dict:
    db = get_db()
    u = await db.users.find_one({"_id": ObjectId(customer["id"])}, {"wallet_balance": 1})
    txns = await db.wallet_txns.find({"user_id": ObjectId(customer["id"])}).sort("at", -1).to_list(20)
    return {"balance": round((u or {}).get("wallet_balance", 0) or 0, 2), "txns": serialize(txns)}


# ---------------- Store admin ----------------
async def store_complaints(admin: dict, status_filter: str | None = None) -> list[dict]:
    store = await get_admin_store_doc(admin)
    query: dict = {"store_id": store["_id"], "status": {"$ne": "cancelled"}}
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
    if c["status"] in ("resolved", "rejected", "cancelled"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This request is already closed")

    if c.get("resolution"):
        await _respond_item_request(c, data)
    else:
        await _respond_simple(c, data)
    return serialize(await db.complaints.find_one({"_id": c["_id"]}))


async def _respond_item_request(c: dict, data: ComplaintRespond) -> None:
    """Refund / exchange flow: open -> approved (in_progress) -> resolved, or rejected."""
    db = get_db()
    now = now_utc()
    want = data.status.value
    sets: dict = {"response": data.response, "updated_at": now}
    hist: list[dict] = []

    if want == "rejected":
        sets["status"] = "rejected"
        hist.append(_hist("rejected", data.response, now))
    elif want in ("in_progress", "resolved") and c["status"] == "open":
        hist.append(_hist("approved", data.response, now))
        sets["approved_at"] = now
        if c["resolution"] == "refund":
            amt = c.get("amount", 0)
            if c.get("refund_to") == "cash":
                await _credit_wallet(c["customer_id"], amt, f"Refund for #{c['order_number']}")
                note = f"₹{amt:g} added to FreshMart Cash"
            else:
                await db.orders.update_one(
                    {"_id": c["order_id"]},
                    {"$set": {"payment.refund_amount": amt, "payment.refunded_at": now}},
                )
                note = f"₹{amt:g} refund sent to your original payment (3–5 working days)"
            sets.update({"status": "resolved", "refunded_at": now})
            hist.append(_hist("resolved", note, now))
        else:  # exchange: a free replacement order goes out like a normal delivery
            ex_order = await _create_exchange_order(c, now)
            sets.update({"status": "in_progress", "exchange_order_id": ex_order["_id"],
                         "exchange_order_number": ex_order["order_number"]})
            hist.append(_hist("dispatch", f"Replacement order #{ex_order['order_number']} sent to delivery partners", now))
    elif want == "resolved" and c["status"] == "in_progress" and c["resolution"] == "exchange":
        # store delivered it themselves (no rider)
        sets.update({"status": "resolved", "exchanged_at": now})
        hist.append(_hist("resolved", "New item delivered, old item collected", now))
        if c.get("exchange_order_id"):
            await db.orders.update_one(
                {"_id": c["exchange_order_id"], "status": {"$nin": ["delivered", "cancelled"]}},
                {"$set": {"status": "delivered", "delivered_at": now, "updated_at": now},
                 "$push": {"status_history": {"status": "delivered", "at": now, "note": "Delivered by the store"}}},
            )
    else:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That step is not allowed for this request")

    await db.complaints.update_one({"_id": c["_id"]}, {"$set": sets, "$push": {"history": {"$each": hist}}})


async def _respond_simple(c: dict, data: ComplaintRespond) -> None:
    db = get_db()
    now = now_utc()
    await db.complaints.update_one(
        {"_id": c["_id"]},
        {"$set": {"status": data.status.value, "response": data.response, "updated_at": now},
         "$push": {"history": _hist(data.status.value, data.response, now)}},
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


# ---------------- Exchange = a free replacement order ----------------
async def _create_exchange_order(c: dict, now) -> dict:
    """Copy the exchanged items into a ₹0 order (already packed) so the normal
    delivery flow picks it up: riders see it, accept, pick up, deliver with a code."""
    db = get_db()
    order = await db.orders.find_one({"_id": c["order_id"]})
    if not order:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Original order not found")
    lines_by_pid = {i["pid"]: i for i in order["items"]}

    # take the fresh items out of stock (roll back if one is missing)
    taken = []
    for it in c["items"]:
        res = await db.products.update_one({"pid": it["pid"], "stock": {"$gte": it["quantity"]}}, {"$inc": {"stock": -it["quantity"]}})
        if res.modified_count == 0:
            for pid, q in taken:
                await db.products.update_one({"pid": pid}, {"$inc": {"stock": q}})
            raise HTTPException(status.HTTP_409_CONFLICT, f"{it['name']} is out of stock. Approve a refund instead.")
        taken.append((it["pid"], it["quantity"]))

    lines = []
    for it in c["items"]:
        src = lines_by_pid.get(it["pid"], {})
        lines.append({"pid": it["pid"], "product_id": src.get("product_id"), "name": it["name"], "unit": it.get("unit", ""),
                      "image_url": it.get("image_url"), "price": 0, "quantity": it["quantity"], "line_total": 0})
    bill = {"subtotal": 0, "delivery_fee": 0, "tip": 0, "coupon_discount": 0, "payment_discount": 0, "cashback": 0, "total": 0}
    number = f"{order['order_number']}-X"
    if await db.orders.find_one({"order_number": number}):
        number = f"{number}{secrets.randbelow(90) + 10}"
    doc = {
        "order_number": number,
        "group_id": order.get("group_id"),
        "customer_id": order["customer_id"],
        "customer_name": order.get("customer_name"),
        "customer_phone": order.get("customer_phone"),
        "store_id": order["store_id"],
        "store_name": order.get("store_name"),
        "items": lines,
        "bill": bill,
        "coupon_code": None,
        "payment": {"method": "exchange", "status": "paid", "transaction_id": None, "paid_at": now},
        "address": order["address"],
        "instructions": ["Exchange: collect the old item from the customer and bring it back to the store"],
        "slot": None,
        # store approved = the fresh item is ready, so the rider can pick it up straight away
        "status": "packed",
        "status_history": [
            {"status": "placed", "at": now, "note": f"Exchange for #{order['order_number']}"},
            {"status": "confirmed", "at": now, "note": "Exchange approved by the store"},
            {"status": "packed", "at": now, "note": "Fresh item ready for pickup"},
        ],
        "delivery_code": f"{secrets.randbelow(10000):04d}",
        "partner": None,
        "rider_location": None,
        "is_exchange": True,
        "exchange_for": order["order_number"],
        "complaint_id": c["_id"],
        "created_at": now,
        "updated_at": now,
    }
    res = await db.orders.insert_one(doc)
    doc["_id"] = res.inserted_id
    return doc


async def exchange_delivered(order: dict, by: str) -> None:
    """Called when a replacement order is delivered: close the exchange request."""
    if not order.get("is_exchange") or not order.get("complaint_id"):
        return
    db = get_db()
    now = now_utc()
    await db.complaints.update_one(
        {"_id": order["complaint_id"], "status": "in_progress"},
        {"$set": {"status": "resolved", "exchanged_at": now, "updated_at": now},
         "$push": {"history": _hist("resolved", f"Fresh item delivered by {by}, old item collected", now)}},
    )
