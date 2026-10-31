"""FreshMart owner (super admin): every store, commission, areas, offers, users, reports, support team."""
import re
from datetime import timedelta, timezone

from bson import ObjectId
from fastapi import HTTPException, status
from pymongo.errors import DuplicateKeyError

from app.database import get_db
from app.models.owner import (AgentCreate, AreasUpdate, CouponCreate, CouponUpdate, DeliverySettings, OwnerStoreCreate,
                              OwnerStoreUpdate, UserActive)
from app.utils import sms
from app.utils.helpers import now_utc, serialize, to_object_id
from app.utils.platform import commission_pct, get_platform, set_platform, store_area

LIVE = ["placed", "confirmed", "packed", "out_for_delivery"]
OPEN_TICKETS = ["open", "in_progress", "needs_approval"]


def _day_start(tz_minutes: int, days_back: int = 0):
    tz = timezone(timedelta(minutes=tz_minutes))
    local = now_utc().astimezone(tz).replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=days_back)
    return local.astimezone(timezone.utc)


def _aware(d):
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


async def _stores_by_id() -> dict:
    return {s["_id"]: s for s in await get_db().stores.find({}).to_list(None)}


# ---------------- Overview ----------------
async def overview(tz_minutes: int = 330) -> dict:
    db = get_db()
    today, week_start = _day_start(tz_minutes), _day_start(tz_minutes, 6)
    yesterday = _day_start(tz_minutes, 1)
    stores = await _stores_by_id()
    orders = await db.orders.find({"created_at": {"$gte": week_start}, "is_exchange": {"$ne": True}},
                                  {"store_id": 1, "status": 1, "bill": 1, "created_at": 1}).to_list(None)
    tz = timezone(timedelta(minutes=tz_minutes))
    days = [(week_start + timedelta(days=i)).astimezone(tz).strftime("%Y-%m-%d") for i in range(7)]
    week = {d: 0.0 for d in days}
    today_rows, y_sales, by_store = [], 0.0, {}
    for o in orders:
        if o["status"] == "cancelled":
            continue
        at = _aware(o["created_at"])
        key = at.astimezone(tz).strftime("%Y-%m-%d")
        if key in week:
            week[key] += o["bill"]["total"]
        if at >= today:
            today_rows.append(o)
            row = by_store.setdefault(o["store_id"], {"orders": 0, "sales": 0.0})
            row["orders"] += 1
            row["sales"] += o["bill"]["total"]
        elif at >= yesterday:
            y_sales += o["bill"]["total"]
    sales = round(sum(o["bill"]["total"] for o in today_rows), 2)
    commission = round(sum(o["bill"]["subtotal"] * commission_pct(stores.get(o["store_id"])) / 100
                           for o in today_rows if o["status"] == "delivered"), 2)
    top = sorted(by_store.items(), key=lambda kv: -kv[1]["sales"])[:5]

    needs = []
    for s in stores.values():
        if s.get("status") == "pending":
            owner = await db.users.find_one({"_id": s.get("owner_id")}) or {}
            needs.append({"kind": "store", "id": str(s["_id"]), "title": s["name"],
                          "text": f"Owner {owner.get('name', '?')} · +91 {owner.get('phone', '')} · {store_area(s)}"})
    for c in await db.complaints.find({"$or": [{"status": "needs_approval"}, {"escalated": True, "status": {"$in": OPEN_TICKETS}}]}
                                      ).sort("created_at", 1).to_list(20):
        if c["status"] == "needs_approval":
            text = f"Refund ₹{c['pending_refund']['amount']:g} for #{c['order_number']} · waiting for {c.get('store_name', 'the store')} admin"
        else:
            text = f"Escalated by support · #{c['order_number']} · {c.get('store_name', '')}"
        needs.append({"kind": "ticket", "id": str(c["_id"]), "title": c.get("customer_name") or "Customer",
                      "text": text, "approval": c["status"] == "needs_approval"})

    return {
        "sales_today": sales,
        "sales_change_pct": round((sales - y_sales) / y_sales * 100) if y_sales else None,
        "orders_today": len(today_rows),
        "live_orders": await db.orders.count_documents({"status": {"$in": LIVE}}),
        "commission_today": commission,
        "active_stores": sum(1 for s in stores.values() if s.get("status", "active") == "active"),
        "pending_stores": sum(1 for s in stores.values() if s.get("status") == "pending"),
        "riders_online": await db.users.count_documents({"role": "delivery", "is_online": True}),
        "new_customers_today": await db.users.count_documents({"role": "customer", "created_at": {"$gte": today}}),
        "open_tickets": await db.complaints.count_documents({"status": {"$in": OPEN_TICKETS}}),
        "week": [{"date": d, "sales": round(v, 2)} for d, v in week.items()],
        "top_stores": [{"id": str(sid), "name": stores.get(sid, {}).get("name", "?"), "area": store_area(stores.get(sid, {})),
                        "orders": r["orders"], "sales": round(r["sales"], 2)} for sid, r in top],
        "needs": needs,
    }


# ---------------- Stores ----------------
def _store_row(s: dict, owner: dict | None, orders_7d: int) -> dict:
    st = s.get("status", "active")
    return {
        "id": str(s["_id"]), "name": s["name"], "area": store_area(s), "city": (s.get("address") or {}).get("city"),
        "address": (s.get("address") or {}).get("line1"), "status": st, "is_open": bool(s.get("is_open")),
        "commission_pct": commission_pct(s), "custom_commission": s.get("commission_pct") is not None,
        "owner": {"id": str(owner["_id"]), "name": owner.get("name"), "phone": owner.get("phone")} if owner else None,
        "orders_7d": orders_7d, "created_at": s.get("created_at"),
    }


async def list_stores() -> list[dict]:
    db = get_db()
    stores = await db.stores.find({}).sort("created_at", 1).to_list(None)
    owners = {u["_id"]: u for u in await db.users.find({"_id": {"$in": [s.get("owner_id") for s in stores]}}).to_list(None)}
    since = now_utc() - timedelta(days=7)
    counts = {r["_id"]: r["n"] for r in await (await db.orders.aggregate([
        {"$match": {"created_at": {"$gte": since}, "status": {"$ne": "cancelled"}}},
        {"$group": {"_id": "$store_id", "n": {"$sum": 1}}}])).to_list(None)}
    return serialize([_store_row(s, owners.get(s.get("owner_id")), counts.get(s["_id"], 0)) for s in stores])


async def create_store(data: OwnerStoreCreate) -> dict:
    db = get_db()
    if await db.users.find_one({"phone": data.phone, "role": "admin"}):
        raise HTTPException(status.HTTP_409_CONFLICT, "This number already owns a store")
    now = now_utc()
    user = {"name": " ".join(data.owner_name.split()), "phone": data.phone, "role": "admin", "is_active": True,
            "status": "active", "login": "otp", "created_at": now}
    u = await db.users.insert_one(user)
    store = {"name": data.store_name.strip(), "owner_id": u.inserted_id, "is_open": True, "status": "active",
             "area": data.area.strip(),
             "address": {"line1": data.line1.strip(), "city": data.city.strip(), "state": "Tamil Nadu", "pincode": data.pincode},
             "gst_number": (data.gst_number or "").strip().upper() or None, "category": "Grocery",
             "open_time": "08:00", "close_time": "22:00", "delivery_radius_km": 5, "created_at": now}
    if data.commission_pct is not None:
        store["commission_pct"] = data.commission_pct
    s = await db.stores.insert_one(store)
    await db.users.update_one({"_id": u.inserted_id}, {"$set": {"store_id": s.inserted_id}})
    sms.send_text(data.phone, f"FreshMart: {store['name']} is ready. Log in with this number to open your store dashboard.")
    store["_id"] = s.inserted_id
    return serialize(_store_row(store, {**user, "_id": u.inserted_id}, 0))


async def update_store(store_id: str, data: OwnerStoreUpdate) -> dict:
    db = get_db()
    s = await db.stores.find_one({"_id": to_object_id(store_id, "store id")})
    if not s:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Store not found")
    sets: dict = {}
    if data.commission_pct is not None:
        sets["commission_pct"] = data.commission_pct
    if data.approve is not None:
        new = "active" if data.approve else "rejected"
        sets.update({"status": new, "is_open": bool(data.approve)})
        await db.users.update_one({"_id": s.get("owner_id")}, {"$set": {"status": new, "reviewed_at": now_utc()}})
        owner = await db.users.find_one({"_id": s.get("owner_id")}) or {}
        if owner.get("phone"):
            sms.send_text(owner["phone"], "FreshMart: your store is approved. Log in with your number to open it."
                          if data.approve else "FreshMart: sorry, your store request was not accepted.")
    elif data.enabled is not None:
        sets["status"] = "active" if data.enabled else "disabled"
        if not data.enabled:
            sets["is_open"] = False
    if sets:
        await db.stores.update_one({"_id": s["_id"]}, {"$set": sets})
    s = await db.stores.find_one({"_id": s["_id"]})
    return serialize(_store_row(s, await db.users.find_one({"_id": s.get("owner_id")}), 0))


# ---------------- Areas + offers ----------------
async def areas() -> dict:
    stores = await get_db().stores.find({}, {"area": 1, "address": 1, "status": 1}).to_list(None)
    counts: dict[str, int] = {}
    for s in stores:
        a = store_area(s)
        if a:
            counts[a] = counts.get(a, 0) + 1
    off = (await get_platform())["areas_off"]
    names = sorted(set(counts) | set(off))
    return {"areas": [{"name": n, "stores": counts.get(n, 0), "on": n not in off} for n in names]}


async def set_areas(data: AreasUpdate) -> dict:
    await set_platform({"areas_off": sorted({a.strip() for a in data.areas_off if a.strip()})})
    return await areas()


DELIVERY_KEYS = list(DeliverySettings.model_fields)


async def delivery_settings() -> dict:
    p = await get_platform()
    return {k: p[k] for k in DELIVERY_KEYS}


async def set_delivery_settings(data: DeliverySettings) -> dict:
    await set_platform(data.model_dump())
    return await delivery_settings()


async def list_coupons() -> list[dict]:
    return serialize(await get_db().coupons.find({}).sort("created_at", -1).to_list(200))


async def create_coupon(data: CouponCreate) -> dict:
    doc = {**data.model_dump(mode="python"), "code": data.code.upper(), "kind": data.kind.value,
           "active": True, "used": 0, "created_at": now_utc()}
    try:
        res = await get_db().coupons.insert_one(doc)
    except DuplicateKeyError:
        raise HTTPException(status.HTTP_409_CONFLICT, "A coupon with this code already exists")
    doc["_id"] = res.inserted_id
    return serialize(doc)


async def update_coupon(coupon_id: str, data: CouponUpdate) -> dict:
    sets = data.model_dump(exclude_none=True)
    if not sets:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Nothing to update")
    db = get_db()
    res = await db.coupons.update_one({"_id": to_object_id(coupon_id, "coupon id")}, {"$set": sets})
    if not res.matched_count:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Coupon not found")
    return serialize(await db.coupons.find_one({"_id": ObjectId(coupon_id)}))


# ---------------- Users ----------------
async def list_users(role: str | None = None, q: str | None = None) -> list[dict]:
    query: dict = {}
    if role:
        query["role"] = role
    if q:
        query["$or"] = [{"name": {"$regex": re.escape(q), "$options": "i"}}, {"phone": {"$regex": re.escape(q)}}]
    docs = await get_db().users.find(query, {"password_hash": 0}).sort("created_at", -1).to_list(300)
    stores = await _stores_by_id()
    return serialize([{
        "id": d["_id"], "name": d.get("name") or "", "phone": d.get("phone"), "email": d.get("email"), "role": d["role"],
        "is_active": d.get("is_active", True), "status": d.get("status", "active"), "created_at": d.get("created_at"),
        "last_login_at": d.get("last_login_at"), "store": stores.get(d.get("store_id"), {}).get("name"),
    } for d in docs])


async def set_user_active(user_id: str, data: UserActive) -> dict:
    db = get_db()
    u = await db.users.find_one({"_id": to_object_id(user_id, "user id")})
    if not u:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    if u["role"] == "superadmin":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Owner accounts are set in SUPER_ADMIN_PHONES")
    sets: dict = {"is_active": data.is_active}
    if not data.is_active:
        sets["is_online"] = False
    await db.users.update_one({"_id": u["_id"]}, {"$set": sets})
    return {"id": user_id, "is_active": data.is_active}


# ---------------- Commission, payouts, reports ----------------
async def money_report(days: int = 7) -> dict:
    db = get_db()
    since = now_utc() - timedelta(days=days)
    stores = await _stores_by_id()
    orders = await db.orders.find({"created_at": {"$gte": since}, "is_exchange": {"$ne": True}}).to_list(None)
    rows: dict = {}
    products: dict = {}
    for o in orders:
        r = rows.setdefault(o["store_id"], {"orders": 0, "delivered": 0, "cancelled": 0, "refunded": 0,
                                            "item_sales": 0.0, "total": 0.0})
        r["orders"] += 1
        if o["status"] == "cancelled":
            r["cancelled"] += 1
            continue
        if o.get("payment", {}).get("status") == "refunded" or o.get("payment", {}).get("refund_amount"):
            r["refunded"] += 1
        if o["status"] == "delivered":
            r["delivered"] += 1
            r["item_sales"] += o["bill"]["subtotal"]
            r["total"] += o["bill"]["total"]
            for it in o["items"]:
                p = products.setdefault(it["name"], {"name": it["name"], "qty": 0, "sales": 0.0})
                p["qty"] += it["quantity"]
                p["sales"] += it["line_total"]
    out = []
    for sid, r in rows.items():
        s = stores.get(sid, {})
        pct = commission_pct(s)
        com = round(r["item_sales"] * pct / 100, 2)
        out.append({"store_id": str(sid), "store": s.get("name", "?"), "area": store_area(s), **r,
                    "item_sales": round(r["item_sales"], 2), "total": round(r["total"], 2),
                    "avg_order": round(r["total"] / r["delivered"], 2) if r["delivered"] else 0,
                    "commission_pct": pct, "commission": com, "payout": round(r["item_sales"] - com, 2)})
    out.sort(key=lambda x: -x["item_sales"])
    areas: dict = {}
    for r in out:
        areas[r["area"] or "?"] = round(areas.get(r["area"] or "?", 0) + r["total"], 2)
    return {
        "days": days, "stores": out,
        "totals": {k: round(sum(r[k] for r in out), 2) for k in ("orders", "delivered", "cancelled", "item_sales", "commission", "payout")},
        "top_products": sorted(({**p, "sales": round(p["sales"], 2)} for p in products.values()), key=lambda p: -p["qty"])[:10],
        "by_area": [{"area": a, "sales": v} for a, v in sorted(areas.items(), key=lambda kv: -kv[1])],
    }


# ---------------- Support team ----------------
async def list_agents() -> list[dict]:
    docs = await get_db().users.find({"role": "support"}).sort("created_at", 1).to_list(None)
    return serialize([{"id": d["_id"], "name": d.get("name"), "phone": d.get("phone"), "is_active": d.get("is_active", True),
                       "last_login_at": d.get("last_login_at")} for d in docs])


async def add_agent(data: AgentCreate) -> dict:
    db = get_db()
    if await db.users.find_one({"phone": data.phone, "role": "support"}):
        raise HTTPException(status.HTTP_409_CONFLICT, "This number is already in the support team")
    doc = {"name": " ".join(data.name.split()), "phone": data.phone, "role": "support", "is_active": True,
           "status": "active", "login": "otp", "created_at": now_utc()}
    res = await db.users.insert_one(doc)
    sms.send_text(data.phone, "FreshMart: you're on the support team. Log in with this number to open the support inbox.")
    return serialize({"id": res.inserted_id, "name": doc["name"], "phone": doc["phone"], "is_active": True, "last_login_at": None})
