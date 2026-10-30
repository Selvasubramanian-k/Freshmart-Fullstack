from typing import Literal

from pydantic import BaseModel, Field


class PickItemIn(BaseModel):
    index: int = Field(..., ge=0, le=200)
    status: Literal["picked", "missing"]


class BagsIn(BaseModel):
    bags: int = Field(..., ge=1, le=20)
