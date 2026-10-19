from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from fastapi import HTTPException, status


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def to_object_id(value: str, name: str = "id") -> ObjectId:
    if not ObjectId.is_valid(value):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Invalid {name}")
    return ObjectId(value)


def serialize(doc: Any) -> Any:
    """Convert Mongo docs (ObjectId, nested lists/dicts) into JSON-friendly data.
    `_id` becomes `id`; password hashes are always removed."""
    if doc is None:
        return None
    if isinstance(doc, list):
        return [serialize(d) for d in doc]
    if isinstance(doc, ObjectId):
        return str(doc)
    if isinstance(doc, dict):
        out = {}
        for k, v in doc.items():
            if k == "password_hash":
                continue
            key = "id" if k == "_id" else k
            out[key] = serialize(v)
        return out
    return doc
