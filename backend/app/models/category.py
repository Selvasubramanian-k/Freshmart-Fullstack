from pydantic import BaseModel, Field


class CategoryCreate(BaseModel):
    label: str = Field(..., min_length=2, max_length=30)   # "Pooja Items" -> id "pooja-items"
    title: str | None = Field(default=None, max_length=40)  # home page row heading (defaults to label)
    icon: str | None = Field(default=None, pattern=r"^[a-z0-9][a-z0-9-]{1,29}$")  # none -> picked from the name


ICON_PATTERN = r"^[a-z0-9][a-z0-9-]{1,29}$"


class CategoryUpdate(BaseModel):
    icon: str = Field(..., pattern=ICON_PATTERN)   # lucide-style name, eg "baby", "diya"
