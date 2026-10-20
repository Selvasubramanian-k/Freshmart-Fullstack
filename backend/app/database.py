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
    await db.users.create_index([("email", ASCENDING)], unique=True)
    await db.stores.create_index([("owner_id", ASCENDING)], unique=True)
    await db.products.create_index([("pid", ASCENDING)], unique=True)
    await db.products.create_index([("store_id", ASCENDING), ("category", ASCENDING)])
    await db.orders.create_index([("customer_id", ASCENDING), ("created_at", DESCENDING)])
    await db.orders.create_index([("store_id", ASCENDING), ("status", ASCENDING)])
    await db.complaints.create_index([("store_id", ASCENDING), ("status", ASCENDING)])
    await db.staff.create_index([("store_id", ASCENDING)])
    await db.orders.create_index([("status", ASCENDING), ("partner", ASCENDING)])
    await db.orders.create_index([("partner.id", ASCENDING), ("delivered_at", DESCENDING)])
