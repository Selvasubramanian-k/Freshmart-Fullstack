from app.config import settings
from app.controllers.order_controller import hide_code, store_earnings
from app.controllers.store_controller import get_admin_store_doc
from app.database import get_db
from app.utils.helpers import now_utc, serialize


async def admin_dashboard(admin: dict) -> dict:
    store = await get_admin_store_doc(admin)
    db = get_db()
    sid = store["_id"]
    today = now_utc().replace(hour=0, minute=0, second=0, microsecond=0)

    status_counts = {}
    async for row in await db.orders.aggregate(
        [{"$match": {"store_id": sid}}, {"$group": {"_id": "$status", "n": {"$sum": 1}}}]
    ):
        status_counts[row["_id"]] = row["n"]

    low_stock = await db.products.find(
        {"store_id": sid, "stock": {"$lte": settings.LOW_STOCK_THRESHOLD}}, {"pid": 1, "name": 1, "stock": 1, "unit": 1}
    ).sort("stock", 1).to_list(8)
    recent = await db.orders.find({"store_id": sid}).sort("created_at", -1).to_list(6)
    earnings = await store_earnings(admin)

    return {
        "store": {"id": str(sid), "name": store["name"], "is_open": store.get("is_open", True)},
        "products_total": await db.products.count_documents({"store_id": sid}),
        "low_stock_count": await db.products.count_documents(
            {"store_id": sid, "stock": {"$lte": settings.LOW_STOCK_THRESHOLD}}
        ),
        "orders_today": await db.orders.count_documents({"store_id": sid, "created_at": {"$gte": today}}),
        "orders_by_status": status_counts,
        "pending_orders": sum(status_counts.get(s, 0) for s in ("placed", "confirmed", "packed")),
        "open_complaints": await db.complaints.count_documents(
            {"store_id": sid, "status": {"$in": ["open", "in_progress"]}}
        ),
        "staff_count": await db.staff.count_documents({"store_id": sid, "is_active": True}),
        "net_earnings": earnings["net_earnings"],
        "daily": earnings["daily"],
        "low_stock": serialize(low_stock),
        "recent_orders": hide_code(serialize(recent)),
    }
