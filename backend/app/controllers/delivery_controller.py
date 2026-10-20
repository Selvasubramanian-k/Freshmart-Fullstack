"""Delivery Partner (rider) business logic.

Flow:  store packs order  ->  rider sees it in "available"  ->  accept
       -> reached store -> picked up (status: out_for_delivery)
       -> delivered (customer's 4-digit code)  ->  rider earns fee + tip
"""
from datetime import timedelta

from bson import ObjectId
from fastapi import HTTPException, status
from pymongo import ReturnDocument

from app.controllers.order_controller import hide_code
from app.database import get_db
from app.models.delivery import DeliverRequest, LocationUpdate, OnlineToggle
from app.utils.helpers import now_utc, serialize, to_object_id

RIDER_BASE_FEE = 30.0          # ₹ per delivery (tip is added on top)
PICKABLE_STATUSES = ["confirmed", "packed"]   # store has accepted; rider can head over


def _rider_fee(order: dict) -> float:
    return round(RIDER_BASE_FEE + float(order["bill"].get("tip", 0)), 2)


def _store_point(store: dict | None) -> dict | None:
    if not store:
        return None
    a = store.get("address") or {}
    text = ", ".join(x for x in [a.get("line1"), a.get("landmark"), a.get("city"), a.get("pincode")] if x)
    return {"name": store["name"], "text": text, "lat": a.get("lat"), "lng": a.get("lng")}


async def _rider_doc(rider: dict) -> dict:
    return await get_db().users.find_one({"_id": ObjectId(rider["id"])})


# ---------------- status / location ----------------
async def me(rider: dict) -> dict:
    doc = await _rider_doc(rider)
    return {
        "is_online": doc.get("is_online", False),
        "active_order_id": str(doc["active_order_id"]) if doc.get("active_order_id") else None,
        "vehicle": doc.get("vehicle"),
        "location": serialize(doc.get("location")),
    }


async def set_online(rider: dict, data: OnlineToggle) -> dict:
    doc = await _rider_doc(rider)
    if not data.is_online and doc.get("active_order_id"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Finish your current delivery before going offline")
    await get_db().users.update_one({"_id": doc["_id"]}, {"$set": {"is_online": data.is_online}})
    return {"is_online": data.is_online}


async def update_location(rider: dict, data: LocationUpdate) -> dict:
    db = get_db()
    doc = await _rider_doc(rider)
    loc = {**data.model_dump(), "at": now_utc()}
    await db.users.update_one({"_id": doc["_id"]}, {"$set": {"location": loc}})
    if doc.get("active_order_id"):
        await db.orders.update_one({"_id": doc["active_order_id"]}, {"$set": {"rider_location": loc}})
    return {"ok": True}


# ---------------- finding work ----------------
async def available_tasks(rider: dict) -> list[dict]:
    db = get_db()
    doc = await _rider_doc(rider)
    if not doc.get("is_online") or doc.get("active_order_id"):
        return []
    orders = await db.orders.find(
        {"status": {"$in": PICKABLE_STATUSES}, "partner": None}
    ).sort("created_at", 1).to_list(20)
    store_ids = list({o["store_id"] for o in orders})
    stores = {s["_id"]: s for s in await db.stores.find({"_id": {"$in": store_ids}, "is_open": True}).to_list(None)}

    out = []
    for o in orders:
        if o["store_id"] not in stores:
            continue
        cod = o["payment"]["method"] == "cod" and o["payment"]["status"] != "paid"
        out.append({
            "id": str(o["_id"]),
            "order_number": o["order_number"],
            "status": o["status"],
            "store": _store_point(stores[o["store_id"]]),
            "drop": {"label": o["address"]["label"], "text": o["address"]["text"],
                     "lat": o["address"].get("lat"), "lng": o["address"].get("lng")},
            "items_count": sum(i["quantity"] for i in o["items"]),
            "cod_amount": o["bill"]["total"] if cod else 0,
            "earning": _rider_fee(o),
            "tip": o["bill"].get("tip", 0),
            "created_at": o["created_at"],
        })
    return serialize(out)


async def accept_task(rider: dict, order_id: str) -> dict:
    db = get_db()
    doc = await _rider_doc(rider)
    if not doc.get("is_online"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Go online to accept deliveries")
    if doc.get("active_order_id"):
        raise HTTPException(status.HTTP_409_CONFLICT, "You already have an active delivery")

    partner = {
        "id": str(doc["_id"]),
        "name": doc["name"],
        "phone": doc.get("phone"),
        "vehicle": doc.get("vehicle"),
        "accepted_at": now_utc(),
        "reached_store_at": None,
        "picked_up_at": None,
    }
    order = await db.orders.find_one_and_update(
        {"_id": to_object_id(order_id, "order id"), "partner": None, "status": {"$in": PICKABLE_STATUSES}},
        {"$set": {"partner": partner, "rider_location": doc.get("location"), "updated_at": now_utc()}},
        return_document=ReturnDocument.AFTER,
    )
    if not order:
        raise HTTPException(status.HTTP_409_CONFLICT, "Another partner already took this order")
    await db.users.update_one({"_id": doc["_id"]}, {"$set": {"active_order_id": order["_id"]}})
    return await current_task(rider)


# ---------------- the active delivery ----------------
async def _active_order(rider: dict) -> dict:
    doc = await _rider_doc(rider)
    if not doc.get("active_order_id"):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No active delivery")
    order = await get_db().orders.find_one({"_id": doc["active_order_id"]})
    if not order:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No active delivery")
    return order


async def current_task(rider: dict) -> dict | None:
    doc = await _rider_doc(rider)
    if not doc.get("active_order_id"):
        return None
    db = get_db()
    order = await db.orders.find_one({"_id": doc["active_order_id"]})
    if not order or order["status"] in ("cancelled", "delivered"):
        await db.users.update_one({"_id": doc["_id"]}, {"$set": {"active_order_id": None}})
        return {"cancelled": True} if order and order["status"] == "cancelled" else None
    store = await db.stores.find_one({"_id": order["store_id"]})
    owner = await db.users.find_one({"_id": store["owner_id"]}) if store else None
    cod = order["payment"]["method"] == "cod" and order["payment"]["status"] != "paid"
    data = hide_code(serialize(order))
    data["store"] = {**(_store_point(store) or {}), "phone": owner.get("phone") if owner else None}
    data["cod_amount"] = order["bill"]["total"] if cod else 0
    data["earning"] = _rider_fee(order)
    return data


async def reached_store(rider: dict) -> dict:
    order = await _active_order(rider)
    await get_db().orders.update_one({"_id": order["_id"]}, {"$set": {"partner.reached_store_at": now_utc()}})
    return await current_task(rider)


async def picked_up(rider: dict) -> dict:
    db = get_db()
    order = await _active_order(rider)
    if order["status"] == "confirmed":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "The store is still packing this order. Please wait.")
    if order["status"] != "packed":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Order is '{order['status']}', cannot pick up")
    now = now_utc()
    await db.orders.update_one(
        {"_id": order["_id"]},
        {"$set": {"status": "out_for_delivery", "partner.picked_up_at": now, "updated_at": now},
         "$push": {"status_history": {"status": "out_for_delivery", "at": now,
                                      "note": f"Picked up by {order['partner']['name']}"}}},
    )
    return await current_task(rider)


async def deliver(rider: dict, data: DeliverRequest) -> dict:
    db = get_db()
    order = await _active_order(rider)
    if order["status"] != "out_for_delivery":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Pick up the order first")
    if data.code != order.get("delivery_code"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Wrong delivery code. Ask the customer again.")
    is_cod = order["payment"]["method"] == "cod" and order["payment"]["status"] != "paid"
    if is_cod and not data.cash_collected:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Collect ₹{order['bill']['total']:.0f} cash first")

    now = now_utc()
    updates = {
        "status": "delivered", "delivered_at": now, "updated_at": now,
        "partner.delivered_at": now, "partner.earning": _rider_fee(order),
        "partner.cash_collected": order["bill"]["total"] if is_cod else 0,
    }
    if is_cod:
        updates["payment.status"] = "paid"
        updates["payment.paid_at"] = now
    await db.orders.update_one(
        {"_id": order["_id"]},
        {"$set": updates,
         "$push": {"status_history": {"status": "delivered", "at": now,
                                      "note": f"Delivered by {order['partner']['name']}"}}},
    )
    await db.users.update_one({"_id": ObjectId(rider["id"])}, {"$set": {"active_order_id": None}})
    return {"message": "Delivered", "earning": _rider_fee(order)}


# ---------------- earnings ----------------
async def earnings(rider: dict, days: int = 1) -> dict:
    start = (now_utc() - timedelta(days=days - 1)).replace(hour=0, minute=0, second=0, microsecond=0)
    orders = await get_db().orders.find(
        {"partner.id": rider["id"], "status": "delivered", "delivered_at": {"$gte": start}}
    ).sort("delivered_at", -1).to_list(None)
    fees = len(orders) * RIDER_BASE_FEE
    tips = round(sum(o["bill"].get("tip", 0) for o in orders), 2)
    cash = round(sum(o["partner"].get("cash_collected", 0) for o in orders), 2)
    trips = [{
        "id": str(o["_id"]),
        "order_number": o["order_number"],
        "drop": o["address"]["text"],
        "store": o["store_name"],
        "delivered_at": o["delivered_at"],
        "earning": o["partner"].get("earning", RIDER_BASE_FEE),
        "cod": o["partner"].get("cash_collected", 0) > 0,
    } for o in orders]
    return serialize({
        "days": days,
        "deliveries": len(orders),
        "fees": fees,
        "tips": tips,
        "total": round(fees + tips, 2),
        "cash_to_deposit": cash,
        "base_fee": RIDER_BASE_FEE,
        "trips": trips,
    })


# ---------------- customer: live tracking ----------------
async def track_for_customer(customer: dict, order_id: str) -> dict:
    db = get_db()
    order = await db.orders.find_one(
        {"_id": to_object_id(order_id, "order id"), "customer_id": ObjectId(customer["id"])}
    )
    if not order:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
    store = await db.stores.find_one({"_id": order["store_id"]})
    p = order.get("partner")
    return serialize({
        "id": order["_id"],
        "order_number": order["order_number"],
        "status": order["status"],
        "status_history": order["status_history"],
        "delivery_code": order.get("delivery_code"),
        "store": _store_point(store),
        "drop": order["address"],
        "partner": {"name": p["name"], "phone": p.get("phone"), "vehicle": p.get("vehicle"),
                    "picked_up_at": p.get("picked_up_at")} if p else None,
        "rider_location": order.get("rider_location") if order["status"] in ("confirmed", "packed", "out_for_delivery") else None,
        "bill": order["bill"],
        "payment": {"method": order["payment"]["method"], "status": order["payment"]["status"]},
    })
