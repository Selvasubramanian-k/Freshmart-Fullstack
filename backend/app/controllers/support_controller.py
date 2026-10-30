"""Customer support / operations: one inbox for every store.

A ticket is a document in `complaints`:
  - customers raise them from the app (damaged, missing, refund, return ...)
  - pickers raise "substitution" when an item is not on the shelf
  - late orders become "late_delivery" tickets automatically when the inbox loads
Big refunds (above the owner's limit) wait for the FreshMart owner to approve.
"""
from datetime import timedelta, timezone

from fastapi import HTTPException, status
from pymongo import ReturnDocument

from app.controllers.complaint_controller import _create_exchange_order, _credit_wallet
from app.controllers.delivery_controller import PICKABLE_STATUSES, _partner_of
from app.controllers.order_controller import _apply_cancel
from app.database import get_db
from app.models.ticket import TicketAction, TicketActionIn
from app.utils import sms
from app.utils.helpers import now_utc, serialize, to_object_id
from app.utils.platform import get_platform

OPEN = ["open", "in_progress", "needs_approval"]
LIVE = ["placed", "confirmed", "packed", "out_for_delivery"]
LATE_MINUTES = 25
SLA_MINUTES = {"substitution": 5, "late_delivery": 10, "cancel": 10, "refund": 120, "return": 240}
GROUP = {"damaged": "complaint", "missing_item": "complaint", "wrong_item": "complaint", "quality": "complaint",
         "expired": "complaint", "other": "complaint", "late_delivery": "late", "substitution": "substitution",
         "cancel": "cancellation", "refund": "refund", "return": "refund"}
TITLE = {"damaged": "Damaged item", "missing_item": "Item missing", "wrong_item": "Wrong item", "quality": "Bad quality",
         "expired": "Expired item", "other": "Other problem", "late_delivery": "Order is late", "substitution": "Item not on the shelf",
         "cancel": "Wants to cancel", "refund": "Refund question", "return": "Return request"}


def _aware(d):
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


def _hist(st: str, note: str, by: str) -> dict:
    return {"status": st, "at": now_utc(), "note": note, "by": by}


async def _auto_late_tickets() -> None:
    """Orders still not delivered LATE_MINUTES after they were placed -> a late ticket (once per order)."""
    db = get_db()
    cutoff = now_utc() - timedelta(minutes=LATE_MINUTES)
    late = await db.orders.find({"status": {"$in": LIVE}, "created_at": {"$lt": cutoff}, "is_exchange": {"$ne": True},
                                 "slot": {"$in": [None, "now"]}}).to_list(200)
    for o in late:
        if await db.complaints.find_one({"order_id": o["_id"], "type": "late_delivery"}):
            continue
        mins = int((now_utc() - _aware(o["created_at"])).total_seconds() // 60)
        now = now_utc()
        await db.complaints.insert_one({
            "order_id": o["_id"], "order_number": o["order_number"], "store_id": o["store_id"], "store_name": o.get("store_name"),
            "customer_id": o["customer_id"], "customer_name": o.get("customer_name"), "customer_phone": o.get("customer_phone"),
            "type": "late_delivery", "auto": True, "status": "open", "response": None,
            "description": f"Auto: still '{o['status'].replace('_', ' ')}' {mins} min after the order was placed"
                           + ("" if o.get("partner") else " · no rider yet"),
            "history": [{"status": "open", "at": now, "note": "Opened automatically (late order)", "by": "FreshMart"}],
            "messages": [], "created_at": now, "updated_at": now,
        })


def _ticket_row(c: dict) -> dict:
    created = _aware(c["created_at"])
    due = created + timedelta(minutes=SLA_MINUTES.get(c["type"], 30))
    return {
        "id": str(c["_id"]), "type": c["type"], "group": GROUP.get(c["type"], "complaint"),
        "title": TITLE.get(c["type"], c["type"].replace("_", " ").title()),
        "customer_name": c.get("customer_name") or "Customer", "customer_phone": c.get("customer_phone"),
        "store_name": c.get("store_name"), "order_number": c.get("order_number"), "status": c["status"],
        "escalated": bool(c.get("escalated")), "auto": bool(c.get("auto")), "amount": c.get("amount"),
        "created_at": created, "due_at": due, "updated_at": c.get("updated_at"),
        "preview": (c.get("messages") or [{}])[-1].get("text") or c.get("description", ""),
    }


async def list_tickets(show: str = "open") -> list[dict]:
    await _auto_late_tickets()
    db = get_db()
    q: dict = {"status": {"$ne": "cancelled"}}
    if show == "open":
        q["status"] = {"$in": OPEN}
    else:   # solved in the last 3 days
        q.update({"status": {"$in": ["resolved", "rejected"]}, "updated_at": {"$gte": now_utc() - timedelta(days=3)}})
    docs = await db.complaints.find(q).sort("created_at", 1 if show == "open" else -1).to_list(300)
    return serialize([_ticket_row(c) for c in docs])


async def _ticket(ticket_id: str) -> dict:
    c = await get_db().complaints.find_one({"_id": to_object_id(ticket_id, "ticket id")})
    if not c:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Ticket not found")
    return c


async def ticket_detail(ticket_id: str) -> dict:
    db = get_db()
    c = await _ticket(ticket_id)
    order = await db.orders.find_one({"_id": c["order_id"]}) or {}
    cust = await db.users.find_one({"_id": c.get("customer_id")}) or {}
    refunds = await db.complaints.count_documents({"customer_id": c.get("customer_id"), "refunded_at": {"$exists": True}})
    msgs = [{"from": "customer", "text": c.get("description", ""), "at": c["created_at"]}] if not c.get("auto") and c["type"] != "substitution" else []
    for h in c.get("history", []):
        if h["status"] != "message":
            msgs.append({"from": "system", "text": h["note"], "at": h["at"], "by": h.get("by")})
    msgs += [{"from": m["from"], "text": m["text"], "at": m["at"], "by": m.get("by")} for m in c.get("messages", [])]
    msgs.sort(key=lambda m: _aware(m["at"]))
    refunded = round(float(order.get("payment", {}).get("refund_amount") or 0), 2)
    return serialize({
        **_ticket_row(c), "description": c.get("description"), "photos": c.get("photos", []),
        "items": c.get("items", []), "resolution": c.get("resolution"), "pending_refund": c.get("pending_refund"),
        "substitute": c.get("substitute"), "missing": c.get("missing"), "messages": msgs,
        "order": {
            "id": order.get("_id"), "number": order.get("order_number"), "status": order.get("status"),
            "items": [{"name": i["name"], "unit": i.get("unit", ""), "quantity": i["quantity"], "line_total": i["line_total"],
                       "problem": any(x.get("pid") == i.get("pid") for x in c.get("items", []))
                       or (c.get("missing") or {}).get("pid") == i.get("pid")} for i in order.get("items", [])],
            "bill": order.get("bill"), "payment": order.get("payment"), "refunded": refunded,
            "partner": (order.get("partner") or {}).get("name"), "address": (order.get("address") or {}).get("text"),
            "created_at": order.get("created_at"), "pickable": order.get("status") in PICKABLE_STATUSES and not order.get("partner"),
        } if order else None,
        "customer": {"orders": await db.orders.count_documents({"customer_id": c.get("customer_id")}),
                     "refunds": refunds, "wallet": round(cust.get("wallet_balance", 0) or 0, 2),
                     "since": cust.get("created_at")},
    })


async def _close(c: dict, st: str, note: str, by: str, extra: dict | None = None) -> None:
    await get_db().complaints.update_one({"_id": c["_id"]}, {
        "$set": {"status": st, "response": note, "updated_at": now_utc(), "handled_by": by, **(extra or {})},
        "$push": {"history": _hist(st, note, by)}})
    if c.get("customer_phone"):
        sms.send_text(c["customer_phone"], f"FreshMart #{c['order_number']}: {note}")


async def _do_refund(c: dict, order: dict, amount: float, to: str, by: str) -> str:
    db = get_db()
    paid_online = order.get("payment", {}).get("method") not in ("cod", "exchange") and order.get("payment", {}).get("status") in ("paid", "refunded")
    if to == "source" and not paid_online:
        to = "cash"   # cash order: money goes to the FreshMart wallet
    left = round(order["bill"]["total"] - float(order.get("payment", {}).get("refund_amount") or 0), 2)
    if amount > left + 0.01:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Only ₹{left:g} can still be refunded on this order")
    if to == "cash":
        await _credit_wallet(c["customer_id"], amount, f"Refund for #{c['order_number']}")
        note = f"₹{amount:g} added to your FreshMart wallet"
    else:
        await db.orders.update_one({"_id": order["_id"]}, {"$inc": {"payment.refund_amount": round(amount, 2)},
                                                           "$set": {"payment.refunded_at": now_utc()}})
        note = f"₹{amount:g} refund sent to your original payment (3–5 working days)"
    await db.complaints.update_one({"_id": c["_id"]}, {"$set": {"refunded_at": now_utc(), "refund": {"amount": amount, "to": to, "by": by}},
                                                       "$unset": {"pending_refund": ""}})
    return note


async def act(user: dict, ticket_id: str, data: TicketActionIn) -> dict:
    db = get_db()
    c = await _ticket(ticket_id)
    by = user.get("name") or ("FreshMart owner" if user["role"] == "superadmin" else "Support")
    owner = user["role"] == "superadmin"
    a = data.action
    closed = c["status"] in ("resolved", "rejected", "cancelled")
    if closed and a not in (TicketAction.REPLY,):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This ticket is already closed")
    order = await db.orders.find_one({"_id": c["order_id"]}) or {}

    if a == TicketAction.REPLY:
        text = (data.text or "").strip()
        if not text:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Type a reply")
        await db.complaints.update_one({"_id": c["_id"]}, {
            "$set": {"response": text, "updated_at": now_utc(), **({} if closed or c["status"] != "open" else {"status": "in_progress"})},
            "$push": {"messages": {"from": "support", "text": text, "at": now_utc(), "by": by}}})
        if c.get("customer_phone"):
            sms.send_text(c["customer_phone"], f"FreshMart support: {text}")

    elif a == TicketAction.REFUND:
        if not order:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
        amount = round(data.amount or c.get("amount") or 0, 2)
        if amount <= 0:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Enter the refund amount")
        limit = (await get_platform())["refund_approval_above"]
        if amount > limit and not owner:
            await db.complaints.update_one({"_id": c["_id"]}, {
                "$set": {"status": "needs_approval", "updated_at": now_utc(),
                         "pending_refund": {"amount": amount, "to": data.to.value, "by": by, "at": now_utc()}},
                "$push": {"history": _hist("needs_approval", f"{by} asked to refund ₹{amount:g}. Waiting for the FreshMart owner.", by)}})
        else:
            note = await _do_refund(c, order, amount, data.to.value, by)
            await _close(c, "resolved", note, by)

    elif a in (TicketAction.APPROVE_REFUND, TicketAction.REJECT_REFUND):
        if not owner:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the FreshMart owner can approve big refunds")
        p = c.get("pending_refund")
        if c["status"] != "needs_approval" or not p:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Nothing is waiting for approval")
        if a == TicketAction.APPROVE_REFUND:
            note = await _do_refund(c, order, p["amount"], p["to"], by)
            await _close(c, "resolved", note, by)
        else:
            await db.complaints.update_one({"_id": c["_id"]}, {"$set": {"status": "in_progress", "updated_at": now_utc()},
                                                               "$unset": {"pending_refund": ""},
                                                               "$push": {"history": _hist("in_progress", f"Owner said no to the ₹{p['amount']:g} refund" + (f": {data.text}" if data.text else ""), by)}})

    elif a == TicketAction.CANCEL_ORDER:
        if order.get("status") not in LIVE:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "This order can't be cancelled now")
        await _apply_cancel(order, f"Cancelled by FreshMart support{': ' + data.text if data.text else ''}")
        await db.orders.update_one({"_id": order["_id"]}, {"$set": {"cancel": {"by": "support", "reason": data.text, "at": now_utc()}}})
        paid = order.get("payment", {}).get("status") == "paid"
        await _close(c, "resolved", "Your order was cancelled" + (". The full amount is refunded." if paid else ". Nothing was charged."), by)

    elif a == TicketAction.ASSIGN_RIDER:
        if order.get("status") not in PICKABLE_STATUSES:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "The store hasn't accepted this order yet. Call the store first.")
        if order.get("partner"):
            raise HTTPException(status.HTTP_409_CONFLICT, f"{order['partner']['name']} is already on this order")
        store = await db.stores.find_one({"_id": order["store_id"]}) or {}
        riders = await db.users.find({"role": "delivery", "is_online": True, "active_order_id": None, "is_active": {"$ne": False},
                                      "$or": [{"in_house": {"$ne": True}}, {"store_id": order["store_id"]}]}).to_list(200)
        if not riders:
            raise HTTPException(status.HTTP_409_CONFLICT, "No delivery partner is free right now")
        sl = (store.get("location") or {})

        def dist(r):
            loc = r.get("location") or {}
            if sl.get("lat") is None or loc.get("lat") is None:
                return 9e9
            return (loc["lat"] - sl["lat"]) ** 2 + (loc["lng"] - sl["lng"]) ** 2
        rider = sorted(riders, key=dist)[0]
        res = await db.orders.find_one_and_update(
            {"_id": order["_id"], "partner": None, "status": {"$in": PICKABLE_STATUSES}},
            {"$set": {"partner": _partner_of(rider, by_store=True), "rider_location": rider.get("location"), "updated_at": now_utc()}},
            return_document=ReturnDocument.AFTER)
        if not res:
            raise HTTPException(status.HTTP_409_CONFLICT, "Someone took this order just now")
        await db.users.update_one({"_id": rider["_id"]}, {"$set": {"active_order_id": order["_id"]}})
        await db.complaints.update_one({"_id": c["_id"]}, {"$set": {"status": "in_progress", "updated_at": now_utc()},
                                                           "$push": {"history": _hist("in_progress", f"{rider['name']} assigned to the order", by)}})

    elif a in (TicketAction.SUBSTITUTE, TicketAction.REMOVE_ITEM):
        m = c.get("missing")
        if c["type"] != "substitution" or not m:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "This is not a missing-item ticket")
        items = order.get("items", [])
        idx = m["index"]
        if idx >= len(items) or items[idx].get("pid") != m["pid"]:
            raise HTTPException(status.HTTP_409_CONFLICT, "The order changed. Refresh and try again.")
        if a == TicketAction.SUBSTITUTE:
            sub = c.get("substitute")
            if not sub:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, "No substitute found for this item. Remove it instead.")
            taken = await db.products.update_one({"pid": sub["pid"], "stock": {"$gte": items[idx]["quantity"]}},
                                                 {"$inc": {"stock": -items[idx]["quantity"]}})
            if not taken.modified_count:
                raise HTTPException(status.HTTP_409_CONFLICT, f"{sub['name']} just ran out too. Remove the item instead.")
            await db.products.update_one({"pid": m["pid"]}, {"$inc": {"stock": items[idx]["quantity"]}})
            await db.orders.update_one({"_id": order["_id"]}, {"$set": {
                f"items.{idx}.pid": sub["pid"], f"items.{idx}.name": sub["name"], f"items.{idx}.unit": sub.get("unit", ""),
                f"items.{idx}.image_url": sub.get("image_url"), f"items.{idx}.substituted_for": m["name"],
                f"pick.items.{idx}.status": "substituted", "updated_at": now_utc()}})
            await _close(c, "resolved", f"{m['name']} was out of stock. We packed {sub['name']} at the same price.", by)
        else:
            line = items[idx]
            amount = round(line["line_total"], 2)
            bill = order["bill"]
            await db.products.update_one({"pid": m["pid"]}, {"$inc": {"stock": line["quantity"]}})
            await db.orders.update_one({"_id": order["_id"]}, {
                "$set": {"bill.subtotal": round(bill["subtotal"] - amount, 2), "bill.total": round(max(0, bill["total"] - amount), 2),
                         "updated_at": now_utc()},
                "$unset": {f"items.{idx}": "", f"pick.items.{idx}": ""},
                "$push": {"removed_items": {**line, "reason": "out of stock", "at": now_utc()}}})
            await db.orders.update_one({"_id": order["_id"]}, {"$pull": {"items": None, "pick.items": None}})
            # other missing-item tickets on this order point at later lines: shift them up by one
            await db.complaints.update_many({"order_id": order["_id"], "type": "substitution", "status": {"$in": OPEN},
                                             "missing.index": {"$gt": idx}}, {"$inc": {"missing.index": -1}})
            note = f"{m['name']} was out of stock and was removed."
            if order.get("payment", {}).get("status") == "paid":
                await db.orders.update_one({"_id": order["_id"]}, {"$inc": {"payment.refund_amount": amount},
                                                                   "$set": {"payment.refunded_at": now_utc()}})
                note += f" ₹{amount:g} is refunded to your payment."
            else:
                note += f" Your bill is ₹{amount:g} less."
            await _close(c, "resolved", note, by)

    elif a == TicketAction.ESCALATE:
        await db.complaints.update_one({"_id": c["_id"]}, {"$set": {"escalated": True, "updated_at": now_utc()},
                                                           "$push": {"history": _hist(c["status"], f"Escalated to the FreshMart owner by {by}" + (f": {data.text}" if data.text else ""), by)}})

    elif a == TicketAction.RESOLVE:
        if c.get("resolution") == "exchange" and c["status"] == "open":   # customer asked for a replacement
            ex = await _create_exchange_order(c, now_utc())
            await db.complaints.update_one({"_id": c["_id"]}, {"$set": {"exchange_order_id": ex["_id"], "exchange_order_number": ex["order_number"]}})
            await _close(c, "in_progress", f"Replacement order #{ex['order_number']} is on the way", by)
        else:
            await _close(c, "resolved", (data.text or "").strip() or "Solved by FreshMart support", by)

    elif a == TicketAction.REJECT:
        await _close(c, "rejected", (data.text or "").strip() or "We couldn't accept this request", by)

    return await ticket_detail(ticket_id)


async def counts() -> dict:
    db = get_db()
    return {"open": await db.complaints.count_documents({"status": {"$in": OPEN}}),
            "needs_approval": await db.complaints.count_documents({"status": "needs_approval"})}

