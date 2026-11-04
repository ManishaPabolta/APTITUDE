import uuid

from fastapi import HTTPException
from pymongo.errors import DuplicateKeyError

from app.database import get_database
from app.services.serializers import now_utc


async def create_catalog_item(kind: str, name: str) -> dict:
    normalized = name.strip()
    item = {
        "_id": str(uuid.uuid4()),
        "kind": kind,
        "name": normalized,
        "name_key": normalized.casefold(),
        "created_at": now_utc(),
    }
    try:
        await get_database().catalog.insert_one(item)
    except DuplicateKeyError as exc:
        raise HTTPException(status_code=409, detail=f"This {kind} already exists") from exc
    return {"id": item["_id"], "name": item["name"], "created_at": item["created_at"]}


async def delete_catalog_item(kind: str, item_id: str) -> None:
    result = await get_database().catalog.delete_one({"_id": item_id, "kind": kind})
    if not result.deleted_count:
        raise HTTPException(status_code=404, detail=f"{kind.capitalize()} not found")
