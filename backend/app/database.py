"""MongoDB connection (uses PyMongo's native async client)."""
from pymongo import AsyncMongoClient, ASCENDING, DESCENDING

from app.config import settings


class _DBState:
    client = None
    db = None


db_state = _DBState()


async def connect_db() -> None:
    db_state.client = AsyncMongoClient(settings.MONGO_URI)
    db_state.db = db_state.client[settings.DB_NAME]
    await create_indexes()
    from app.controllers.category_controller import seed_defaults  # late import: avoids a cycle
    await seed_defaults()
    from app.utils.helpers import now_utc
    from app.utils.pricing import DEFAULT_COUPON
    await db_state.db.coupons.update_one({"code": DEFAULT_COUPON["code"]},
                                         {"$setOnInsert": {**DEFAULT_COUPON, "created_at": now_utc()}}, upsert=True)
    print(f"[db] Connected to MongoDB -> {settings.DB_NAME}")


async def close_db() -> None:
    if db_state.client is not None:
        await db_state.client.close()
        print("[db] Connection closed")


def get_db():
    if db_state.db is None:
        raise RuntimeError("Database not initialised. Call connect_db() first.")
    return db_state.db


async def create_indexes() -> None:
    db = db_state.db
    # email: unique but optional (OTP sign-ups may skip it) -> sparse. Old non-sparse index is replaced once.
    info = await db.users.index_information()
    if "email_1" in info and not info["email_1"].get("sparse"):
        await db.users.drop_index("email_1")
    await db.users.create_index([("email", ASCENDING)], unique=True, sparse=True)
    await db.users.create_index([("phone", ASCENDING)])
    await db.users.create_index([("role", ASCENDING), ("status", ASCENDING)])
    await db.otp_codes.create_index([("phone", ASCENDING)], unique=True)
    await db.stores.create_index([("owner_id", ASCENDING)], unique=True)
    await db.products.create_index([("pid", ASCENDING)], unique=True)
    await db.products.create_index([("store_id", ASCENDING), ("category", ASCENDING)])
    await db.orders.create_index([("customer_id", ASCENDING), ("created_at", DESCENDING)])
    await db.orders.create_index([("store_id", ASCENDING), ("status", ASCENDING)])
    await db.complaints.create_index([("store_id", ASCENDING), ("status", ASCENDING)])
    await db.staff.create_index([("store_id", ASCENDING)])
    await db.categories.create_index([("id", ASCENDING)], unique=True)
    await db.store_sales.create_index([("store_id", ASCENDING), ("created_at", DESCENDING)])
    await db.orders.create_index([("status", ASCENDING), ("partner", ASCENDING)])
    await db.orders.create_index([("partner.id", ASCENDING), ("delivered_at", DESCENDING)])
    await db.orders.create_index([("created_at", DESCENDING)])
    await db.coupons.create_index([("code", ASCENDING)], unique=True)
    await db.complaints.create_index([("status", ASCENDING), ("created_at", DESCENDING)])
    await db.users.create_index([("role", ASCENDING)])
