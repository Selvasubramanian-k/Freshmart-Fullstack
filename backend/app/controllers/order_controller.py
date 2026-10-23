import re
import secrets
from datetime import timedelta

from bson import ObjectId
from fastapi import HTTPException, status

from app.config import settings
from app.controllers.store_controller import get_admin_store_doc
from app.database import get_db
from app.models.order import (
    ALLOWED_TRANSITIONS, CUSTOMER_CANCELLABLE, CancelRequest, OrderCreate, OrderStatusUpdate,
)
from app.utils.helpers import now_utc, serialize, to_object_id
from app.utils.pricing import compute_bill, split_share, validate_coupon

BILL_KEYS = ["delivery_fee", "tip", "coupon_discount", "payment_discount", "cashback"]


def hide_code(doc):
    """The 4-digit delivery code is only for the customer; store and rider must not see it."""
    if isinstance(doc, list):
        return [hide_code(d) for d in doc]
    doc = dict(doc)
    doc.pop("delivery_code", None)
    return doc


def _order_number() -> str:
    return f"FM{now_utc():%y%m%d}{secrets.token_hex(3).upper()}"


async def _restock(order: dict) -> None:
    db = get_db()
    for item in order["items"]:
        await db.products.update_one({"pid": item["pid"]}, {"$inc": {"stock": item["quantity"]}})


# ======================= Customer =======================
async def place_order(customer: dict, data: OrderCreate) -> dict:
    db = get_db()

    # merge duplicate lines
    qty_by_pid: dict[int, int] = {}
    for it in data.items:
        qty_by_pid[it.pid] = qty_by_pid.get(it.pid, 0) + it.quantity

    products = await db.products.find({"pid": {"$in": list(qty_by_pid)}, "is_active": True}).to_list(None)
    found = {p["pid"]: p for p in products}
    missing = [pid for pid in qty_by_pid if pid not in found]
    if missing:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Some products are no longer available: {missing}")

    store_ids = {p["store_id"] for p in products}
    stores = {s["_id"]: s for s in await db.stores.find({"_id": {"$in": list(store_ids)}}).to_list(None)}
    closed = [s["name"] for s in stores.values() if not s.get("is_open", True)]
    if closed:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Store currently closed: {', '.join(closed)}")

    for pid, qty in qty_by_pid.items():
        if found[pid]["stock"] < qty:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"Only {found[pid]['stock']} left for {found[pid]['name']}",
            )

    subtotal = sum(found[pid]["price"] * qty for pid, qty in qty_by_pid.items())
    try:
        coupon_code, coupon_off = validate_coupon(data.coupon_code, subtotal)
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e))
    if data.payment_method.value == "nb" and not data.bank:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Please choose your bank")
    if data.payment_method.value == "card" and not data.card:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Card details are required")

    bill = compute_bill(subtotal, data.payment_method.value, data.tip, coupon_off)

    # ---- reserve stock atomically (rollback on failure) ----
    reserved: list[tuple[int, int]] = []
    for pid, qty in qty_by_pid.items():
        res = await db.products.update_one({"pid": pid, "stock": {"$gte": qty}}, {"$inc": {"stock": -qty}})
        if res.modified_count == 0:
            for rpid, rqty in reserved:
                await db.products.update_one({"pid": rpid}, {"$inc": {"stock": rqty}})
            raise HTTPException(status.HTTP_409_CONFLICT, f"{found[pid]['name']} just went out of stock")
        reserved.append((pid, qty))

    # ---- mock payment gateway ----
    is_cod = data.payment_method.value == "cod"
    payment = {
        "method": data.payment_method.value,
        "status": "pending" if is_cod else "paid",
        "transaction_id": None if is_cod else f"TXN{secrets.token_hex(6).upper()}",
        "bank": data.bank,
        "card_last4": data.card.last4 if data.card else None,
        "paid_at": None if is_cod else now_utc(),
    }

    # ---- one order per store (marketplace split) ----
    group_id = _order_number()
    orders = []
    remaining = {k: bill[k] for k in BILL_KEYS}
    store_list = list(store_ids)
    for i, sid in enumerate(store_list):
        lines = [
            {
                "pid": pid,
                "product_id": found[pid]["_id"],
                "name": found[pid]["name"],
                "unit": found[pid].get("unit", ""),
                "image_url": found[pid].get("image_url"),
                "price": found[pid]["price"],
                "quantity": qty,
                "line_total": round(found[pid]["price"] * qty, 2),
            }
            for pid, qty in qty_by_pid.items() if found[pid]["store_id"] == sid
        ]
        sub = round(sum(line["line_total"] for line in lines), 2)
        last = i == len(store_list) - 1
        part = {}
        for k in BILL_KEYS:
            part[k] = round(remaining[k], 2) if last else split_share(bill[k], sub, subtotal)
            remaining[k] -= part[k]
        total = round(sub + part["delivery_fee"] + part["tip"] - part["coupon_discount"] - part["payment_discount"], 2)

        now = now_utc()
        doc = {
            "order_number": group_id if len(store_list) == 1 else f"{group_id}-{i + 1}",
            "group_id": group_id,
            "customer_id": ObjectId(customer["id"]),
            "customer_name": customer["name"],
            "customer_phone": customer.get("phone"),
            "store_id": sid,
            "store_name": stores[sid]["name"],
            "items": lines,
            "bill": {"subtotal": sub, **part, "total": total},
            "coupon_code": coupon_code,
            "payment": payment,
            "address": data.address.model_dump(),
            "instructions": data.instructions,
            "slot": data.slot,
            "status": "placed",
            "status_history": [{"status": "placed", "at": now, "note": "Order placed"}],
            "delivery_code": f"{secrets.randbelow(10000):04d}",
            "partner": None,          # filled when a delivery partner accepts
            "rider_location": None,
            "created_at": now,
            "updated_at": now,
        }
        res = await db.orders.insert_one(doc)
        doc["_id"] = res.inserted_id
        orders.append(serialize(doc))

    return {"group_id": group_id, "bill": bill, "orders": orders}


async def my_orders(customer: dict) -> list[dict]:
    docs = await get_db().orders.find({"customer_id": ObjectId(customer["id"])}).sort("created_at", -1).to_list(None)
    return serialize(docs)


async def _customer_order(customer: dict, order_id: str) -> dict:
    order = await get_db().orders.find_one(
        {"_id": to_object_id(order_id, "order id"), "customer_id": ObjectId(customer["id"])}
    )
    if not order:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
    return order


async def get_my_order(customer: dict, order_id: str) -> dict:
    return serialize(await _customer_order(customer, order_id))


async def cancel_my_order(customer: dict, order_id: str, data: CancelRequest) -> dict:
    order = await _customer_order(customer, order_id)
    if order["status"] not in CUSTOMER_CANCELLABLE:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This order can no longer be cancelled")
    await _apply_cancel(order, f"Cancelled by customer{': ' + data.reason if data.reason else ''}")
    return serialize(await get_db().orders.find_one({"_id": order["_id"]}))


async def _apply_cancel(order: dict, note: str) -> None:
    db = get_db()
    now = now_utc()
    updates = {"status": "cancelled", "updated_at": now}
    if order["payment"]["status"] == "paid":
        updates["payment.status"] = "refunded"
        updates["payment.refunded_at"] = now
    await db.orders.update_one(
        {"_id": order["_id"]},
        {"$set": updates, "$push": {"status_history": {"status": "cancelled", "at": now, "note": note}}},
    )
    await _restock(order)
    if order.get("partner"):  # free the rider
        await db.users.update_one(
            {"_id": ObjectId(order["partner"]["id"]), "active_order_id": order["_id"]},
            {"$set": {"active_order_id": None}},
        )


# ======================= Store admin =======================
async def store_orders(admin: dict, status_filter: str | None = None, q: str | None = None,
                       date_from=None, date_to=None, active: bool = False) -> list[dict]:
    store = await get_admin_store_doc(admin)
    query: dict = {"store_id": store["_id"]}
    if status_filter:
        query["status"] = status_filter
    if active:
        query["status"] = {"$in": ["placed", "confirmed", "packed", "out_for_delivery"]}
    if date_from or date_to:
        query["created_at"] = {k: v for k, v in (("$gte", date_from), ("$lt", date_to)) if v}
    if q:
        query["$or"] = [
            {"order_number": {"$regex": re.escape(q.upper())}},
            {"customer_name": {"$regex": re.escape(q), "$options": "i"}},
        ]
    docs = await get_db().orders.find(query).sort("created_at", -1).to_list(2000)
    return hide_code(serialize(docs))


async def update_order_status(admin: dict, order_id: str, data: OrderStatusUpdate) -> dict:
    store = await get_admin_store_doc(admin)
    db = get_db()
    order = await db.orders.find_one({"_id": to_object_id(order_id, "order id"), "store_id": store["_id"]})
    if not order:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")

    new = data.status.value
    if new not in ALLOWED_TRANSITIONS.get(order["status"], []):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Cannot move order from '{order['status']}' to '{new}'")
    if order.get("partner") and new in ("out_for_delivery", "delivered"):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"{order['partner']['name']} (delivery partner) will update this step from the rider app",
        )

    if new == "cancelled":
        await _apply_cancel(order, f"Cancelled by store{': ' + data.note if data.note else ''}")
    else:
        now = now_utc()
        updates = {"status": new, "updated_at": now}
        if new == "delivered":
            updates["delivered_at"] = now
            if order["payment"]["method"] == "cod":
                updates["payment.status"] = "paid"
                updates["payment.paid_at"] = now
        await db.orders.update_one(
            {"_id": order["_id"]},
            {"$set": updates, "$push": {"status_history": {"status": new, "at": now, "note": data.note}}},
        )
        if new == "delivered" and order.get("is_exchange"):
            from app.controllers.complaint_controller import exchange_delivered
            await exchange_delivered(order, "the store")
    return hide_code(serialize(await db.orders.find_one({"_id": order["_id"]})))


async def store_earnings(admin: dict, days: int = 7) -> dict:
    store = await get_admin_store_doc(admin)
    db = get_db()
    pct = settings.PLATFORM_COMMISSION_PERCENT
    delivered = await db.orders.find({"store_id": store["_id"], "status": "delivered"}).to_list(None)

    gross = round(sum(o["bill"]["subtotal"] for o in delivered), 2)
    commission = round(gross * pct / 100, 2)

    start = (now_utc() - timedelta(days=days - 1)).replace(hour=0, minute=0, second=0, microsecond=0)
    daily = {(start + timedelta(days=i)).strftime("%Y-%m-%d"): 0.0 for i in range(days)}
    for o in delivered:
        at = o.get("delivered_at") or o["created_at"]
        key = at.strftime("%Y-%m-%d")
        if key in daily:
            daily[key] = round(daily[key] + o["bill"]["subtotal"] * (1 - pct / 100), 2)

    refunded = await db.orders.count_documents({"store_id": store["_id"], "payment.status": "refunded"})
    cod_pending = await db.orders.count_documents(
        {"store_id": store["_id"], "payment.method": "cod", "payment.status": "pending",
         "status": {"$nin": ["cancelled"]}}
    )
    return {
        "commission_percent": pct,
        "delivered_orders": len(delivered),
        "gross_sales": gross,
        "platform_commission": commission,
        "net_earnings": round(gross - commission, 2),
        "average_order_value": round(gross / len(delivered), 2) if delivered else 0,
        "refunded_orders": refunded,
        "cod_pending_orders": cod_pending,
        "daily": [{"date": d, "net": v} for d, v in daily.items()],
    }
