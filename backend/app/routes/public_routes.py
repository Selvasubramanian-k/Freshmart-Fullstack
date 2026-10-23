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
