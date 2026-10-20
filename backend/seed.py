"""Seed MongoDB with demo accounts + the FreshMart catalog (154 products).

Run from the backend folder:   python seed.py
Re-running is safe: existing demo users are kept, products are only inserted if the store has none.
Use  python seed.py --reset   to wipe the database first.
"""
import asyncio
import json
import random
import sys
from datetime import timedelta
from pathlib import Path

from pymongo import AsyncMongoClient

from app.config import settings
from app.utils.helpers import now_utc
from app.utils.security import hash_password

SEED_FILE = Path(__file__).parent / "seed_data" / "products.json"

ADMIN = {
    "name": "Selva (Store Owner)",
    "email": "admin@freshmart.com",
    "phone": "9876543210",
    "password": "admin123",
}
CUSTOMER = {
    "name": "Priya",
    "email": "customer@freshmart.com",
    "phone": "9123456780",
    "password": "customer123",
    "address": {"line1": "No. 12, Gandhi Street, T Nagar", "city": "Chennai", "state": "Tamil Nadu",
                "pincode": "600017", "line2": None, "landmark": "Near Pondy Bazaar",
                "lat": 13.0418, "lng": 80.2341},
}
RIDER = {
    "name": "Ravi Kumar",
    "email": "rider@freshmart.com",
    "phone": "9840098400",
    "password": "rider123",
    "vehicle": {"type": "scooter", "number": "TN09AB1234"},
}
STORE = {
    "name": "FreshMart Chennai",
    "address": {"line1": "45, 2nd Avenue, Anna Nagar", "city": "Chennai", "state": "Tamil Nadu",
                "pincode": "600040", "line2": None, "landmark": None,
                "lat": 13.0850, "lng": 80.2101},
    "gst_number": "33ABCDE1234F1Z5",
    "category": "Grocery",
    "open_time": "08:00",
    "close_time": "22:00",
    "delivery_radius_km": 5,
}


async def main(reset: bool) -> None:
    client = AsyncMongoClient(settings.MONGO_URI)
    db = client[settings.DB_NAME]
    if reset:
        await client.drop_database(settings.DB_NAME)
        print(f"Dropped database {settings.DB_NAME}")

    # ---- admin + store ----
    admin = await db.users.find_one({"email": ADMIN["email"]})
    if not admin:
        res = await db.users.insert_one({
            "name": ADMIN["name"], "email": ADMIN["email"], "phone": ADMIN["phone"], "role": "admin",
            "password_hash": hash_password(ADMIN["password"]), "is_active": True, "created_at": now_utc(),
        })
        admin = await db.users.find_one({"_id": res.inserted_id})
    store = await db.stores.find_one({"owner_id": admin["_id"]})
    if not store:
        res = await db.stores.insert_one({**STORE, "owner_id": admin["_id"], "is_open": True, "created_at": now_utc()})
        store = await db.stores.find_one({"_id": res.inserted_id})
        await db.users.update_one({"_id": admin["_id"]}, {"$set": {"store_id": store["_id"]}})

    # ---- customer ----
    if not await db.users.find_one({"email": CUSTOMER["email"]}):
        await db.users.insert_one({
            "name": CUSTOMER["name"], "email": CUSTOMER["email"], "phone": CUSTOMER["phone"], "role": "customer",
            "address": CUSTOMER["address"], "password_hash": hash_password(CUSTOMER["password"]),
            "is_active": True, "created_at": now_utc(),
        })

    # ---- delivery partner ----
    if not await db.users.find_one({"email": RIDER["email"]}):
        await db.users.insert_one({
            "name": RIDER["name"], "email": RIDER["email"], "phone": RIDER["phone"], "role": "delivery",
            "vehicle": RIDER["vehicle"], "city": "Chennai", "is_online": False, "active_order_id": None,
            "location": None, "password_hash": hash_password(RIDER["password"]),
            "is_active": True, "created_at": now_utc(),
        })
    # older seeded store without map location -> add it
    await db.stores.update_one(
        {"_id": store["_id"], "address.lat": None},
        {"$set": {"address.lat": STORE["address"]["lat"], "address.lng": STORE["address"]["lng"]}},
    )

    # ---- products ----
    if await db.products.count_documents({"store_id": store["_id"]}) == 0:
        rng = random.Random(7)
        items = json.loads(SEED_FILE.read_text(encoding="utf-8"))
        docs = []
        for p in items:
            perishable = p["category"] in ("fruits", "dairy", "meat", "breakfast")
            docs.append({
                **p,
                "description": "",
                "stock": rng.choice([4, 8, 15, 25, 40, 60, 80]),
                "expiry_date": (now_utc() + timedelta(days=rng.randint(2, 7) if perishable else rng.randint(60, 300))).strftime("%Y-%m-%d"),
                "is_active": True,
                "store_id": store["_id"],
                "created_at": now_utc(),
                "updated_at": now_utc(),
            })
        await db.products.insert_many(docs)
        print(f"Inserted {len(docs)} products")

    max_pid = await db.products.find_one(sort=[("pid", -1)])
    await db.counters.update_one({"_id": "product_pid"}, {"$max": {"seq": max_pid["pid"] if max_pid else 0}}, upsert=True)

    # indexes (same as app startup)
    await db.users.create_index("email", unique=True)
    await db.products.create_index("pid", unique=True)

    print("\nDemo logins (same login page for both):")
    print(f"  Store admin : {ADMIN['email']} / {ADMIN['password']}")
    print(f"  Customer    : {CUSTOMER['email']} / {CUSTOMER['password']}")
    print(f"  Delivery    : {RIDER['email']} / {RIDER['password']}")
    await client.close()


if __name__ == "__main__":
    asyncio.run(main("--reset" in sys.argv))
