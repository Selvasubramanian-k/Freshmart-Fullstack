from fastapi import APIRouter, Query

from app.controllers import category_controller, product_controller, store_controller

router = APIRouter(prefix="/api", tags=["Public catalog"])


@router.get("/products")
async def browse_products(
    q: str | None = Query(default=None, max_length=60),
    category: str | None = None,
    store_id: str | None = None,
):
    return await product_controller.browse_products(q, category, store_id)


@router.get("/products/{pid}")
async def get_product(pid: int):
    return await product_controller.get_product(pid)


@router.get("/categories")
async def categories():
    return await category_controller.list_categories()


@router.get("/stores")
async def stores(only_open: bool = False):
    return await store_controller.list_stores(only_open)


@router.get("/stores/{store_id}")
async def store(store_id: str):
    return await store_controller.get_store(store_id)


# ---------- offers (FreshMart owner adds them in the owner panel) ----------
@router.get("/coupons")
async def active_coupons():
    from app.database import get_db
    from app.utils.helpers import now_utc
    now = now_utc()
    docs = await get_db().coupons.find({"active": True}).sort("created_at", -1).to_list(20)
    return [{"code": d["code"], "title": d.get("title", ""), "kind": d.get("kind", "flat"), "value": d["value"],
             "max_off": d.get("max_off"), "min_order": d.get("min_order", 0)}
            for d in docs if not d.get("ends_at") or d["ends_at"].replace(tzinfo=now.tzinfo) >= now]


@router.get("/coupons/check")
async def check_coupon(code: str, subtotal: float):
    from fastapi import HTTPException
    from app.utils.pricing import validate_coupon
    try:
        c, off = await validate_coupon(code, subtotal)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"code": c, "off": off}
