"""Picker / packing staff app."""
from fastapi import APIRouter, Depends

from app.controllers import picker_controller as picker
from app.middleware.auth import require_picker
from app.models.picker import BagsIn, PickItemIn

router = APIRouter(prefix="/api/picker", tags=["Picker"])


@router.get("/me")
async def me(user: dict = Depends(require_picker)):
    return await picker.me(user)


@router.get("/queue")
async def queue(user: dict = Depends(require_picker)):
    return await picker.queue(user)


@router.get("/orders/{order_id}")
async def order(order_id: str, user: dict = Depends(require_picker)):
    return await picker.order_detail(user, order_id)


@router.post("/orders/{order_id}/start")
async def start(order_id: str, user: dict = Depends(require_picker)):
    return await picker.start(user, order_id)


@router.post("/orders/{order_id}/item")
async def item(order_id: str, data: PickItemIn, user: dict = Depends(require_picker)):
    return await picker.mark_item(user, order_id, data)


@router.post("/orders/{order_id}/pack")
async def pack(order_id: str, data: BagsIn, user: dict = Depends(require_picker)):
    return await picker.pack(user, order_id, data)
