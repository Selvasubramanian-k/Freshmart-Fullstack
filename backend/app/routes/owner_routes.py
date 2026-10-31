"""FreshMart owner (super admin). Number must be in SUPER_ADMIN_PHONES."""
from fastapi import APIRouter, Depends, Query

from app.controllers import owner_controller as owner, support_controller as support
from app.middleware.auth import require_superadmin
from app.models.owner import (AgentCreate, AreasUpdate, CouponCreate, CouponUpdate, DeliverySettings, OwnerStoreCreate,
                              OwnerStoreUpdate, UserActive)

router = APIRouter(prefix="/api/owner", tags=["FreshMart owner"], dependencies=[Depends(require_superadmin)])


@router.get("/overview")
async def overview(tz: int = Query(330, ge=-720, le=840)):
    return await owner.overview(tz)


@router.get("/stores")
async def stores():
    return await owner.list_stores()


@router.post("/stores", status_code=201)
async def add_store(data: OwnerStoreCreate):
    return await owner.create_store(data)


@router.patch("/stores/{store_id}")
async def update_store(store_id: str, data: OwnerStoreUpdate):
    return await owner.update_store(store_id, data)


@router.get("/areas")
async def areas():
    return await owner.areas()


@router.put("/areas")
async def set_areas(data: AreasUpdate):
    return await owner.set_areas(data)


@router.get("/delivery-settings")
async def delivery_settings():
    return await owner.delivery_settings()


@router.put("/delivery-settings")
async def set_delivery_settings(data: DeliverySettings):
    return await owner.set_delivery_settings(data)


@router.get("/coupons")
async def coupons():
    return await owner.list_coupons()


@router.post("/coupons", status_code=201)
async def add_coupon(data: CouponCreate):
    return await owner.create_coupon(data)


@router.patch("/coupons/{coupon_id}")
async def update_coupon(coupon_id: str, data: CouponUpdate):
    return await owner.update_coupon(coupon_id, data)


@router.get("/users")
async def users(role: str | None = None, q: str | None = Query(None, max_length=60)):
    return await owner.list_users(role, q)


@router.patch("/users/{user_id}")
async def set_user(user_id: str, data: UserActive):
    return await owner.set_user_active(user_id, data)


@router.get("/report")
async def report(days: int = Query(7, ge=1, le=90)):
    return await owner.money_report(days)


@router.get("/support-team")
async def agents():
    return await owner.list_agents()


@router.post("/support-team", status_code=201)
async def add_agent(data: AgentCreate):
    return await owner.add_agent(data)


@router.get("/support-counts")
async def support_counts():
    return await support.counts()
