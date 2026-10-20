"""Delivery Partner (rider) APIs."""
from fastapi import APIRouter, Depends

from app.controllers import delivery_controller as ctl
from app.middleware.auth import require_role
from app.models.delivery import DeliverRequest, LocationUpdate, OnlineToggle

require_delivery = require_role("delivery")
router = APIRouter(prefix="/api/delivery", tags=["Delivery partner"], dependencies=[Depends(require_delivery)])


@router.get("/me")
async def me(user: dict = Depends(require_delivery)):
    return await ctl.me(user)


@router.patch("/online")
async def online(data: OnlineToggle, user: dict = Depends(require_delivery)):
    return await ctl.set_online(user, data)


@router.post("/location")
async def location(data: LocationUpdate, user: dict = Depends(require_delivery)):
    return await ctl.update_location(user, data)


@router.get("/tasks/available")
async def available(user: dict = Depends(require_delivery)):
    return await ctl.available_tasks(user)


@router.post("/tasks/{order_id}/accept")
async def accept(order_id: str, user: dict = Depends(require_delivery)):
    return await ctl.accept_task(user, order_id)


@router.get("/tasks/current")
async def current(user: dict = Depends(require_delivery)):
    return await ctl.current_task(user)


@router.post("/tasks/current/reached-store")
async def reached(user: dict = Depends(require_delivery)):
    return await ctl.reached_store(user)


@router.post("/tasks/current/picked-up")
async def picked(user: dict = Depends(require_delivery)):
    return await ctl.picked_up(user)


@router.post("/tasks/current/deliver")
async def deliver(data: DeliverRequest, user: dict = Depends(require_delivery)):
    return await ctl.deliver(user, data)


@router.get("/earnings")
async def earnings(days: int = 1, user: dict = Depends(require_delivery)):
    return await ctl.earnings(user, max(1, min(days, 31)))
