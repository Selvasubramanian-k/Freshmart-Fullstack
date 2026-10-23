from pydantic import BaseModel, Field


class CategoryCreate(BaseModel):
    label: str = Field(..., min_length=2, max_length=30)   # "Pooja Items" -> id "pooja-items"
    title: str | None = Field(default=None, max_length=40)  # home page row heading (defaults to label)
