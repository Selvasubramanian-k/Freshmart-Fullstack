"""Approve (or reject) a store that registered from the app.

Until there is a FreshMart super-admin page, the platform owner runs this once per new store:

    python approve_store.py                 # list stores waiting
    python approve_store.py 9876543210      # approve the store owner with this phone
    python approve_store.py 9876543210 --reject
"""
import asyncio
import sys

from app.database import close_db, connect_db, get_db
from app.utils import sms
from app.utils.helpers import now_utc


async def main(args: list[str]) -> None:
    await connect_db()
    db = get_db()
    try:
        if not args:
            owners = await db.users.find({"role": "admin", "status": "pending"}).to_list(None)
            if not owners:
                print("No stores waiting.")
            for o in owners:
                store = await db.stores.find_one({"_id": o.get("store_id")}) or {}
                print(f"{o['phone']}  {o['name']:<24} {store.get('name', '?')} · {store.get('address', {}).get('city', '')}")
            return
        phone, reject = args[0], "--reject" in args
        owner = await db.users.find_one({"role": "admin", "phone": phone})
        if not owner:
            print("No store owner with that phone.")
            return
        new = "rejected" if reject else "active"
        await db.users.update_one({"_id": owner["_id"]}, {"$set": {"status": new, "reviewed_at": now_utc()}})
        await db.stores.update_one({"_id": owner.get("store_id")}, {"$set": {"status": new}})
        sms.send_text(phone, "FreshMart: your store is approved. Log in with your number to open it."
                      if not reject else "FreshMart: sorry, your store request was not accepted.")
        print(f"{owner['name']}: {new}")
    finally:
        await close_db()


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1:]))
