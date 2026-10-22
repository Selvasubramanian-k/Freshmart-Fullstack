from fastapi import APIRouter, Depends, status

from app.controllers import complaint_controller, delivery_controller, order_controller
from app.middleware.auth import require_customer
from app.models.complaint import ComplaintCreate
from app.models.order import CancelRequest, OrderCreate, RateRequest

router = APIRouter(prefix="/api/customer", tags=["Customer"], dependencies=[Depends(require_customer)])


# ---------- Orders ----------
@router.post("/orders", status_code=status.HTTP_201_CREATED)
async def place_order(data: OrderCreate, user: dict = Depends(require_customer)):
    return await order_controller.place_order(user, data)


@router.get("/orders")
async def my_orders(user: dict = Depends(require_customer)):
    return await order_controller.my_orders(user)


@router.get("/orders/{order_id}")
async def get_order(order_id: str, user: dict = Depends(require_customer)):
    return await order_controller.get_my_order(user, order_id)


@router.get("/orders/{order_id}/track")
async def track_order(order_id: str, user: dict = Depends(require_customer)):
    """Live tracking: status, rider location, store + drop points, delivery code."""
    return await delivery_controller.track_for_customer(user, order_id)


@router.post("/orders/{order_id}/rate")
async def rate_order(order_id: str, data: RateRequest, user: dict = Depends(require_customer)):
    """Star rating for the delivery (shown to the store)."""
    return await delivery_controller.rate_delivery(user, order_id, data.stars)


@router.post("/orders/{order_id}/cancel")
async def cancel_order(order_id: str, data: CancelRequest, user: dict = Depends(require_customer)):
    return await order_controller.cancel_my_order(user, order_id, data)


# ---------- Returns / complaints ----------
@router.post("/complaints", status_code=status.HTTP_201_CREATED)
async def create_complaint(data: ComplaintCreate, user: dict = Depends(require_customer)):
    return await complaint_controller.create_complaint(user, data)


@router.get("/complaints")
async def my_complaints(user: dict = Depends(require_customer)):
    return await complaint_controller.my_complaints(user)
