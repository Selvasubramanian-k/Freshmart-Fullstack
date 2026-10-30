"""Counter (in-store) sales + earnings that combine online orders and in-store sales."""
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from pymongo import ReturnDocument

from app.controllers.store_controller import get_admin_store_doc
from app.database import get_db
from app.utils.platform import commission_pct
from app.models.sale import SaleCreate
from app.utils.helpers import now_utc, serialize


def _aware(d: datetime) -> datetime:
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


def sale_out(doc: dict) -> dict:
    return serialize(doc)


# ---------------- Counter sale ----------------
async def create_sale(admin: dict, data: SaleCreate) -> dict:
    store = await get_admin_store_doc(admin)
    db = get_db()

    qty: dict[int, int] = {}
    for it in data.items:                       # same product twice -> one line
        qty[it.pid] = qty.get(it.pid, 0) + it.quantity

    products = {p["pid"]: p for p in await db.products.find({"pid": {"$in": list(qty)}, "store_id": store["_id"]}).to_list(None)}
    missing = [pid for pid in qty if pid not in products]
    if missing:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Product #{missing[0]} not found in your store")
    for pid, q in qty.items():
        if products[pid]["stock"] < q:
            p = products[pid]
            raise HTTPException(status.HTTP_409_CONFLICT, f"Only {p['stock']} left of {p['name']}")

    lines = [{
        "pid": pid, "name": products[pid]["name"], "unit": products[pid].get("unit", ""),
        "price": products[pid]["price"], "quantity": q, "total": round(products[pid]["price"] * q, 2),
    } for pid, q in qty.items()]
    total = round(sum(line["total"] for line in lines), 2)
    if data.payment_method == "cash" and data.cash_given is not None and data.cash_given < total:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Cash given is less than the bill (₹{total:g})")

    doc = {
        "store_id": store["_id"],
        "items": lines,
        "total": total,
        "payment_method": data.payment_method.value,
        "cash_given": data.cash_given if data.payment_method == "cash" else None,
        "change": round(data.cash_given - total, 2) if data.payment_method == "cash" and data.cash_given is not None else None,
        "customer_phone": data.customer_phone,
        "created_by": admin["id"],
    }

    # take the stock; if someone else just bought the last piece (or saving fails), put back what we took
    taken: list[tuple[int, int]] = []

    async def give_back():
        for back_pid, back_q in taken:
            await db.products.update_one({"pid": back_pid, "store_id": store["_id"]}, {"$inc": {"stock": back_q}})

    for pid, q in qty.items():
        res = await db.products.update_one(
            {"pid": pid, "store_id": store["_id"], "stock": {"$gte": q}},
            {"$inc": {"stock": -q}, "$set": {"updated_at": now_utc()}},
        )
        if res.modified_count != 1:
            await give_back()
            raise HTTPException(status.HTTP_409_CONFLICT, f"{products[pid]['name']} just ran out. Check the stock and try again.")
        taken.append((pid, q))

    try:
        counter = await db.counters.find_one_and_update(
            {"_id": f"sale_{store['_id']}"}, {"$inc": {"seq": 1}}, upsert=True, return_document=ReturnDocument.AFTER
        )
        doc["bill_no"] = f"S-{counter['seq']:04d}"
        doc["created_at"] = now_utc()
        res = await db.store_sales.insert_one(doc)
    except Exception:
        await give_back()
        raise
    doc["_id"] = res.inserted_id
    return sale_out(doc)


async def list_sales(admin: dict, date_from: datetime | None = None, date_to: datetime | None = None,
                     limit: int = 50) -> dict:
    store = await get_admin_store_doc(admin)
    query: dict = {"store_id": store["_id"]}
    if date_from or date_to:
        query["created_at"] = {k: v for k, v in (("$gte", date_from), ("$lt", date_to)) if v}
    db = get_db()
    docs = await db.store_sales.find(query).sort("created_at", -1).to_list(None)
    return {
        "count": len(docs),
        "total": round(sum(d["total"] for d in docs), 2),
        "bills": [sale_out(d) for d in docs[:limit]],
    }


# ---------------- Earnings: online + in-store ----------------
async def earnings(admin: dict, date_from: datetime, date_to: datetime, tz_minutes: int = 330) -> dict:
    """Online = delivered orders (not exchanges) by delivery time. In-store = counter sales.
    Commission is only on online item sales. Days are bucketed in the browser's time zone (tz_minutes east of UTC)."""
    store = await get_admin_store_doc(admin)
    db = get_db()
    sid = store["_id"]
    pct = commission_pct(store)
    tz = timezone(timedelta(minutes=tz_minutes))
    date_from, date_to = _aware(date_from), _aware(date_to)

    delivered = await db.orders.find({
        "store_id": sid, "status": "delivered", "is_exchange": {"$ne": True},
        "$or": [
            {"delivered_at": {"$gte": date_from, "$lt": date_to}},
            {"delivered_at": {"$exists": False}, "created_at": {"$gte": date_from, "$lt": date_to}},
        ],
    }).to_list(None)
    sales = await db.store_sales.find({"store_id": sid, "created_at": {"$gte": date_from, "$lt": date_to}}).to_list(None)

    # daily buckets in local days
    days: dict[str, dict] = {}
    d = date_from.astimezone(tz).date()
    last = (date_to - timedelta(seconds=1)).astimezone(tz).date()
    while d <= last and len(days) < 400:
        days[d.isoformat()] = {"date": d.isoformat(), "online": 0.0, "store": 0.0}
        d += timedelta(days=1)

    gross = prepaid = cod = 0.0
    for o in delivered:
        sub = o["bill"]["subtotal"]
        gross += sub
        if o.get("payment", {}).get("method") == "cod":
            cod += sub
        else:
            prepaid += sub
        key = _aware(o.get("delivered_at") or o["created_at"]).astimezone(tz).date().isoformat()
        if key in days:
            days[key]["online"] += sub * (1 - pct / 100)
    commission = gross * pct / 100

    by_pay = {"cash": 0.0, "upi": 0.0, "card": 0.0}
    store_total = 0.0
    for s in sales:
        store_total += s["total"]
        by_pay[s["payment_method"]] = by_pay.get(s["payment_method"], 0) + s["total"]
        key = _aware(s["created_at"]).astimezone(tz).date().isoformat()
        if key in days:
            days[key]["store"] += s["total"]

    today_start = datetime.now(tz).replace(hour=0, minute=0, second=0, microsecond=0)
    cash_today = 0.0
    async for s in db.store_sales.find({"store_id": sid, "payment_method": "cash", "created_at": {"$gte": today_start}}):
        cash_today += s["total"]

    r2 = lambda x: round(x, 2)  # noqa: E731
    online_net = gross - commission
    recent = await db.store_sales.find({"store_id": sid}).sort("created_at", -1).to_list(6)
    return {
        "commission_percent": pct,
        "total": r2(online_net + store_total),
        "online": {"orders": len(delivered), "gross": r2(gross), "commission": r2(commission), "net": r2(online_net),
                   "prepaid": r2(prepaid), "cod": r2(cod)},
        "store": {"bills": len(sales), "total": r2(store_total), **{k: r2(v) for k, v in by_pay.items()}},
        "cash_today": r2(cash_today),
        "cod_pending_orders": await db.orders.count_documents(
            {"store_id": sid, "payment.method": "cod", "payment.status": "pending", "status": {"$nin": ["cancelled"]}}),
        "refunded_orders": await db.orders.count_documents({"store_id": sid, "payment.status": "refunded"}),
        "daily": [{"date": v["date"], "online": r2(v["online"]), "store": r2(v["store"])} for v in days.values()],
        "recent_bills": [sale_out(x) for x in recent],
    }
