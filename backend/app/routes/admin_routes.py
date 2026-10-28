"""Shop Owner / Store Admin APIs."""
import secrets
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from app.controllers import (
    category_controller, complaint_controller, dashboard_controller, delivery_controller, order_controller, product_controller,
    staff_controller, store_controller,
)
from app.middleware.auth import require_admin
from app.models.category import CategoryCreate, CategoryUpdate
from app.models.complaint import ComplaintRespond
from app.models.delivery import AssignRequest
from app.models.order import OrderStatusUpdate
from app.models.product import ProductCreate, ProductUpdate, StockUpdate
from app.models.staff import StaffCreate, StaffUpdate
from app.models.store import StoreAvailability, StoreUpdate

router = APIRouter(prefix="/api/admin", tags=["Store admin"], dependencies=[Depends(require_admin)])

UPLOAD_DIR = Path(__file__).resolve().parents[2] / "uploads"
ALLOWED_IMAGES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
MAX_UPLOAD_BYTES = 2 * 1024 * 1024


# ---------- Dashboard ----------
@router.get("/dashboard")
async def dashboard(user: dict = Depends(require_admin)):
    return await dashboard_controller.admin_dashboard(user)


# ---------- Store ----------
@router.get("/store")
async def my_store(user: dict = Depends(require_admin)):
    return await store_controller.get_my_store(user)


@router.put("/store")
async def update_store(data: StoreUpdate, user: dict = Depends(require_admin)):
    return await store_controller.update_my_store(user, data)


@router.patch("/store/availability")
async def availability(data: StoreAvailability, user: dict = Depends(require_admin)):
    return await store_controller.set_availability(user, data)


# ---------- Products ----------
@router.get("/categories")
async def list_categories(user: dict = Depends(require_admin)):
    return await category_controller.admin_list(user)


@router.post("/categories", status_code=status.HTTP_201_CREATED)
async def create_category(data: CategoryCreate, user: dict = Depends(require_admin)):
    return await category_controller.create_category(user, data)


@router.patch("/categories/{cid}")
async def update_category(cid: str, data: CategoryUpdate, user: dict = Depends(require_admin)):
    return await category_controller.update_category(user, cid, data)


@router.delete("/categories/{cid}")
async def delete_category(cid: str, user: dict = Depends(require_admin)):
    return await category_controller.delete_category(user, cid)


@router.get("/products")
async def list_products(q: str | None = None, category: str | None = None, low_stock: bool = False,
                        user: dict = Depends(require_admin)):
    return await product_controller.list_store_products(user, q, category, low_stock)


@router.post("/products", status_code=status.HTTP_201_CREATED)
async def create_product(data: ProductCreate, user: dict = Depends(require_admin)):
    return await product_controller.create_product(user, data)


@router.put("/products/{pid}")
async def update_product(pid: int, data: ProductUpdate, user: dict = Depends(require_admin)):
    return await product_controller.update_product(user, pid, data)


@router.patch("/products/{pid}/stock")
async def update_stock(pid: int, data: StockUpdate, user: dict = Depends(require_admin)):
    return await product_controller.update_stock(user, pid, data)


@router.delete("/products/{pid}")
async def delete_product(pid: int, user: dict = Depends(require_admin)):
    return await product_controller.delete_product(user, pid)


@router.post("/uploads", status_code=status.HTTP_201_CREATED)
async def upload_image(file: UploadFile = File(...)):
    ext = ALLOWED_IMAGES.get(file.content_type or "")
    if not ext:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only JPG, PNG or WEBP images are allowed")
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Image must be 2 MB or smaller")
    UPLOAD_DIR.mkdir(exist_ok=True)
    name = f"{secrets.token_hex(8)}{ext}"
    (UPLOAD_DIR / name).write_bytes(data)
    return {"image_url": f"/uploads/{name}"}


# ---------- Orders ----------
@router.get("/orders")
async def list_orders(
    status_filter: str | None = None, q: str | None = None,
    date_from: datetime | None = None, date_to: datetime | None = None,
    active: bool = False, user: dict = Depends(require_admin),
):
    """date_from / date_to: ISO times (the browser sends its local day start/end).
    active=true: only orders still being handled (placed ... out_for_delivery)."""
    return await order_controller.store_orders(user, status_filter, q, date_from, date_to, active)


@router.patch("/orders/{order_id}/status")
async def update_order_status(order_id: str, data: OrderStatusUpdate, user: dict = Depends(require_admin)):
    return await order_controller.update_order_status(user, order_id, data)


# ---------- Earnings ----------
@router.get("/earnings")
async def earnings(days: int = 7, user: dict = Depends(require_admin)):
    return await order_controller.store_earnings(user, max(1, min(days, 90)))


# ---------- Staff ----------
@router.get("/staff")
async def list_staff(user: dict = Depends(require_admin)):
    return await staff_controller.list_staff(user)


@router.post("/staff", status_code=status.HTTP_201_CREATED)
async def add_staff(data: StaffCreate, user: dict = Depends(require_admin)):
    return await staff_controller.add_staff(user, data)


@router.put("/staff/{staff_id}")
async def update_staff(staff_id: str, data: StaffUpdate, user: dict = Depends(require_admin)):
    return await staff_controller.update_staff(user, staff_id, data)


@router.delete("/staff/{staff_id}")
async def remove_staff(staff_id: str, user: dict = Depends(require_admin)):
    return await staff_controller.remove_staff(user, staff_id)


# ---------- Store's own delivery staff ----------
@router.get("/riders")
async def list_riders(user: dict = Depends(require_admin)):
    return await delivery_controller.store_riders(user)


@router.post("/orders/{order_id}/assign")
async def assign_order(order_id: str, data: AssignRequest, user: dict = Depends(require_admin)):
    return await delivery_controller.assign_to_staff(user, order_id, data.rider_id)


# ---------- Complaints / returns ----------
@router.get("/complaints")
async def list_complaints(status_filter: str | None = None, user: dict = Depends(require_admin)):
    return await complaint_controller.store_complaints(user, status_filter)


@router.patch("/complaints/{complaint_id}")
async def respond_complaint(complaint_id: str, data: ComplaintRespond, user: dict = Depends(require_admin)):
    return await complaint_controller.respond_complaint(user, complaint_id, data)
