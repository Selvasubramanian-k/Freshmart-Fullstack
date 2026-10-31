"""Picker / packing staff: pick each item from the shelf, check quantity + expiry, pack, mark ready.

Order flow with a picker:  placed -> (picker starts) confirmed -> packed (bag tag B-14) -> rider picks up.
An item not on the shelf becomes a "substitution" ticket for the support team; the picker waits for their answer.
"""
from datetime import date, timedelta, timezone

from bson import ObjectId
from fastapi import HTTPException, status
from pymongo import ReturnDocument

from app.database import get_db
from app.models.picker import BagsIn, PickItemIn
from app.utils.helpers import now_utc, serialize, to_object_id

QUEUE = ["placed", "confirmed"]
FRESH_DAYS = 3   # stock expiring within this many days must not go to a customer


def _aware(d):
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


async def _store_of(picker: dict) -> dict:
    sid = picker.get("store_id")
    store = await get_db().stores.find_one({"_id": ObjectId(sid)}) if sid else None
    if not store:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You are not linked to a store. Ask the store admin.")
    return store


async def me(picker: dict) -> dict:
    store = await _store_of(picker)
    db = get_db()
    today = now_utc().replace(hour=0, minute=0, second=0, microsecond=0)
    done = await db.orders.count_documents({"store_id": store["_id"], "pick.by": ObjectId(picker["id"]), "pick.packed_at": {"$gte": today}})
    return {"name": picker.get("name"), "store": {"id": str(store["_id"]), "name": store["name"], "is_open": store.get("is_open")},
            "packed_today": done}


async def queue(picker: dict) -> list[dict]:
    store = await _store_of(picker)
    docs = await get_db().orders.find({"store_id": store["_id"], "status": {"$in": QUEUE}}).sort("created_at", 1).to_list(50)
    out = []
    for o in docs:
        pick = o.get("pick") or {}
        items = pick.get("items") or []
        out.append({
            "id": str(o["_id"]), "order_number": o["order_number"], "status": o["status"], "created_at": o["created_at"],
            "customer_name": o.get("customer_name"), "items_count": sum(i["quantity"] for i in o["items"]),
            "lines": len(o["items"]), "payment": o["payment"]["method"], "slot": o.get("slot"),
            "picked": sum(1 for i in items if i.get("status") in ("picked", "substituted")),
            "picker": pick.get("by_name"), "mine": str(pick.get("by")) == picker["id"] if pick.get("by") else False,
        })
    return serialize(out)


async def _order(picker: dict, order_id: str) -> tuple[dict, dict]:
    store = await _store_of(picker)
    o = await get_db().orders.find_one({"_id": to_object_id(order_id, "order id"), "store_id": store["_id"]})
    if not o:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
    return o, store


async def order_detail(picker: dict, order_id: str) -> dict:
    o, _ = await _order(picker, order_id)
    db = get_db()
    prods = {p["pid"]: p for p in await db.products.find({"pid": {"$in": [i["pid"] for i in o["items"]]}}).to_list(None)}
    cats = {c["id"]: c.get("name") for c in await db.categories.find({}).to_list(None)}
    pick = o.get("pick") or {}
    states = pick.get("items") or [{} for _ in o["items"]]
    tickets = {t["missing"]["index"]: t for t in await db.complaints.find(
        {"order_id": o["_id"], "type": "substitution"}).sort("created_at", 1).to_list(None) if t.get("missing")}
    soon = (date.today() + timedelta(days=FRESH_DAYS)).isoformat()
    items = []
    for idx, it in enumerate(o["items"]):
        p = prods.get(it["pid"], {})
        st = states[idx] if idx < len(states) else {}
        t = tickets.get(idx)
        exp = p.get("expiry_date")
        items.append({
            "index": idx, "pid": it["pid"], "name": it["name"], "unit": it.get("unit", ""), "quantity": it["quantity"],
            "image_url": it.get("image_url") or p.get("image_url"),
            "location": p.get("aisle") or cats.get(p.get("category")) or (p.get("category") or "").title() or "Shelf",
            "expiry_date": exp, "expiry_warning": bool(exp and exp <= soon), "check_expiry": bool(exp),
            "status": st.get("status"), "substituted_for": it.get("substituted_for"),
            "ticket": {"status": t["status"], "substitute": (t.get("substitute") or {}).get("name"), "answer": t.get("response")} if t else None,
        })
    order_sorted = sorted(items, key=lambda x: (x["location"], x["name"]))   # walk the shop once, shelf by shelf
    return serialize({
        "id": o["_id"], "order_number": o["order_number"], "status": o["status"], "customer_name": o.get("customer_name"),
        "instructions": o.get("instructions", []), "payment": o["payment"]["method"], "created_at": o["created_at"],
        "picker": pick.get("by_name"), "mine": str(pick.get("by")) == picker["id"] if pick.get("by") else False,
        "bag_tag": pick.get("bag_tag"), "bags": pick.get("bags"), "items": order_sorted,
        "cold": any(any(w in (i["location"] or "").lower() for w in ("dairy", "frozen", "fridge", "meat")) for i in items),
    })


async def start(picker: dict, order_id: str) -> dict:
    o, _ = await _order(picker, order_id)
    db = get_db()
    pick = o.get("pick") or {}
    if pick.get("by") and str(pick["by"]) != picker["id"]:
        raise HTTPException(status.HTTP_409_CONFLICT, f"{pick.get('by_name', 'Someone')} is already picking this order")
    if o["status"] not in QUEUE:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This order is not waiting to be picked")
    now = now_utc()
    sets = {"pick.by": ObjectId(picker["id"]), "pick.by_name": picker.get("name"), "updated_at": now}
    if not pick.get("items"):
        sets["pick.items"] = [{"status": None} for _ in o["items"]]
        sets["pick.started_at"] = now
    upd: dict = {"$set": sets}
    if o["status"] == "placed":   # picker taking it = the store accepted it
        sets["status"] = "confirmed"
        upd["$push"] = {"status_history": {"status": "confirmed", "at": now, "note": f"Picking started by {picker.get('name')}"}}
    res = await db.orders.find_one_and_update({"_id": o["_id"], "$or": [{"pick.by": None}, {"pick.by": ObjectId(picker["id"])},
                                                                        {"pick": None}, {"pick": {"$exists": False}}]},
                                              upd, return_document=ReturnDocument.AFTER)
    if not res:
        raise HTTPException(status.HTTP_409_CONFLICT, "Someone else just started this order")
    return await order_detail(picker, order_id)


async def _suggest(store_id, product: dict, qty: int) -> dict | None:
    """Same category, in stock, closest price (within 25%)."""
    if not product:
        return None
    price = product.get("price", 0)
    cands = await get_db().products.find({"store_id": store_id, "category": product.get("category"), "is_active": True,
                                          "pid": {"$ne": product["pid"]}, "stock": {"$gte": qty},
                                          "price": {"$gte": price * 0.75, "$lte": price * 1.25}}).to_list(50)
    if not cands:
        return None
    c = sorted(cands, key=lambda p: abs(p["price"] - price))[0]
    return {"pid": c["pid"], "name": c["name"], "unit": c.get("unit", ""), "price": c["price"], "image_url": c.get("image_url")}


async def mark_item(picker: dict, order_id: str, data: PickItemIn) -> dict:
    o, store = await _order(picker, order_id)
    db = get_db()
    pick = o.get("pick") or {}
    if str(pick.get("by")) != picker["id"]:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Start picking this order first")
    if o["status"] not in QUEUE:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This order is already packed")
    if data.index >= len(o["items"]):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No such item")
    line = o["items"][data.index]
    now = now_utc()
    if data.status == "picked":
        await db.orders.update_one({"_id": o["_id"]}, {"$set": {f"pick.items.{data.index}": {"status": "picked", "at": now}}})
    else:   # not on the shelf -> ask support (once per line)
        await db.orders.update_one({"_id": o["_id"]}, {"$set": {f"pick.items.{data.index}": {"status": "missing", "at": now}}})
        if not await db.complaints.find_one({"order_id": o["_id"], "type": "substitution", "missing.index": data.index,
                                             "status": {"$in": ["open", "in_progress"]}}):
            prod = await db.products.find_one({"pid": line["pid"]})
            sub = await _suggest(store["_id"], prod, line["quantity"])
            await db.complaints.insert_one({
                "order_id": o["_id"], "order_number": o["order_number"], "store_id": store["_id"], "store_name": store["name"],
                "customer_id": o["customer_id"], "customer_name": o.get("customer_name"), "customer_phone": o.get("customer_phone"),
                "type": "substitution", "status": "open", "response": None, "auto": True,
                "description": f"{line['name']} ({line.get('unit', '')}) ×{line['quantity']} is not on the shelf"
                               + (f". Suggested: {sub['name']} {sub['unit']}" if sub else ". No similar item in stock."),
                "missing": {"index": data.index, "pid": line["pid"], "name": line["name"], "quantity": line["quantity"],
                            "amount": line["line_total"]},
                "substitute": sub,
                "history": [{"status": "open", "at": now, "note": f"Picker {picker.get('name')}: not on the shelf", "by": picker.get("name")}],
                "messages": [], "created_at": now, "updated_at": now,
            })
    return await order_detail(picker, order_id)


async def next_bag_tag(store_id) -> str:
    """B-01, B-02 ... per store per day (India time). Used by the picker and by the store admin's "Packed"."""
    day = now_utc().astimezone(timezone(timedelta(minutes=330))).strftime("%Y%m%d")
    counter = await get_db().counters.find_one_and_update({"_id": f"bags:{store_id}:{day}"}, {"$inc": {"n": 1}},
                                                          upsert=True, return_document=ReturnDocument.AFTER)
    return f"B-{counter['n']:02d}"


async def pack(picker: dict, order_id: str, data: BagsIn) -> dict:
    o, store = await _order(picker, order_id)
    db = get_db()
    pick = o.get("pick") or {}
    if str(pick.get("by")) != picker["id"]:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Start picking this order first")
    if o["status"] != "confirmed":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This order is not being picked")
    states = pick.get("items") or []
    waiting = [o["items"][i]["name"] for i, s in enumerate(states) if i < len(o["items"]) and s.get("status") not in ("picked", "substituted")]
    if waiting:
        raise HTTPException(status.HTTP_409_CONFLICT, "Still waiting for: " + ", ".join(waiting))
    now = now_utc()
    tag = await next_bag_tag(store["_id"])
    await db.orders.update_one({"_id": o["_id"]}, {
        "$set": {"status": "packed", "updated_at": now, "pick.bags": data.bags, "pick.bag_tag": tag, "pick.packed_at": now},
        "$push": {"status_history": {"status": "packed", "at": now, "note": f"Packed by {picker.get('name')} · {data.bags} bag{'s' if data.bags > 1 else ''} · {tag}"}}})
    return await order_detail(picker, order_id)


# ---------------- history: who packed what ----------------
RANGES = {"today": (0, 1), "yesterday": (1, 1), "week": (6, 7)}   # (days back from today, days long)


async def history(picker: dict, rng: str = "today", who: str = "all", tz_minutes: int = 330) -> dict:
    store = await _store_of(picker)
    back, length = RANGES.get(rng, RANGES["today"])
    tz = timezone(timedelta(minutes=tz_minutes))
    start_local = now_utc().astimezone(tz).replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=back)
    start, end = start_local.astimezone(timezone.utc), (start_local + timedelta(days=length)).astimezone(timezone.utc)
    docs = await get_db().orders.find({"store_id": store["_id"], "pick.packed_at": {"$gte": start, "$lt": end}}
                                      ).sort("pick.packed_at", -1).to_list(500)
    board: dict[str, int] = {}
    for o in docs:
        name = (o.get("pick") or {}).get("by_name") or "Store"
        board[name] = board.get(name, 0) + 1
    if who == "me":
        docs = [o for o in docs if str((o.get("pick") or {}).get("by")) == picker["id"]]
    mins = [(_aware(o["pick"]["packed_at"]) - _aware(o["pick"]["started_at"])).total_seconds() / 60
            for o in docs if o["pick"].get("started_at")]
    return serialize({
        "range": rng, "who": who,
        "orders": sum(1 for o in docs if o["status"] != "cancelled"),
        "items": sum(i["quantity"] for o in docs for i in o["items"]),
        "avg_minutes": round(sum(mins) / len(mins), 1) if mins else None,
        "board": [{"name": n, "orders": c} for n, c in sorted(board.items(), key=lambda kv: -kv[1])],
        "list": [{
            "id": o["_id"], "order_number": o["order_number"], "bag_tag": o["pick"].get("bag_tag"),
            "bags": o["pick"].get("bags"), "items": sum(i["quantity"] for i in o["items"]),
            "picked_by": o["pick"].get("by_name") or "Store", "packed_at": o["pick"]["packed_at"],
            "status": o["status"], "mine": str(o["pick"].get("by")) == picker["id"],
        } for o in docs],
    })
