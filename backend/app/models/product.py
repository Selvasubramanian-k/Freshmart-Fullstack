from enum import Enum

from pydantic import BaseModel, Field, model_validator

DATE_PATTERN = r"^\d{4}-\d{2}-\d{2}$"

# Same category ids the customer frontend uses (src/customer/data/categories.js)
CATEGORY_IDS = ["dairy", "fruits", "meat", "snacks", "beverage", "breakfast", "cooking", "home", "petcare"]
CATEGORY_PATTERN = r"^(" + "|".join(CATEGORY_IDS) + r")$"


class ProductTag(str, Enum):
    POPULAR = "popular"
    NEW = "new"
    SALE = "sale"
    ORGANIC = "organic"


class ProductCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    description: str = Field(default="", max_length=1000)
    category: str = Field(..., pattern=CATEGORY_PATTERN)
    price: float = Field(..., gt=0)
    mrp: float | None = Field(default=None, gt=0)      # shown as old price (strike-through)
    unit: str = Field(default="1 pc", max_length=30)   # "1 kg", "500 g", "1 L"
    stock: int = Field(default=0, ge=0)
    tag: ProductTag = ProductTag.POPULAR
    # "/uploads/x.jpg" (uploaded), "https://..." (external) or "asset:apple.jpg" (bundled frontend image)
    image_url: str | None = Field(default=None, max_length=500)
    expiry_date: str | None = Field(default=None, pattern=DATE_PATTERN)
    is_active: bool = True

    @model_validator(mode="after")
    def mrp_check(self):
        if self.mrp is not None and self.mrp < self.price:
            raise ValueError("MRP cannot be less than selling price")
        return self


class ProductUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    description: str | None = Field(default=None, max_length=1000)
    category: str | None = Field(default=None, pattern=CATEGORY_PATTERN)
    price: float | None = Field(default=None, gt=0)
    mrp: float | None = Field(default=None, ge=0)  # send 0 to remove MRP
    unit: str | None = Field(default=None, max_length=30)
    stock: int | None = Field(default=None, ge=0)
    tag: ProductTag | None = None
    image_url: str | None = Field(default=None, max_length=500)
    expiry_date: str | None = Field(default=None, pattern=r"^(\d{4}-\d{2}-\d{2})?$")  # "" clears it
    is_active: bool | None = None


class StockUpdate(BaseModel):
    stock: int = Field(..., ge=0)
