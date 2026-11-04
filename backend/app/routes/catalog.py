from fastapi import APIRouter, Depends, Response

from app.database import get_database
from app.middleware.role_guard import require_roles
from app.schemas import CatalogItemInput
from app.services.catalog_service import create_catalog_item, delete_catalog_item

router = APIRouter(prefix="/api/admin", tags=["Batches and courses"])
Staff = Depends(require_roles("admin", "teacher"))


async def list_items(kind: str):
    items = await get_database().catalog.find({"kind": kind}).sort("name", 1).to_list(length=500)
    return [{"id": item["_id"], "name": item["name"], "created_at": item["created_at"]} for item in items]


@router.get("/batches")
async def list_batches(_: dict = Staff):
    return await list_items("batch")


@router.post("/batches", status_code=201)
async def create_batch(payload: CatalogItemInput, _: dict = Staff):
    return await create_catalog_item("batch", payload.name)


@router.delete("/batches/{item_id}", status_code=204)
async def delete_batch(item_id: str, _: dict = Staff):
    await delete_catalog_item("batch", item_id)
    return Response(status_code=204)


@router.get("/courses")
async def list_courses(_: dict = Staff):
    return await list_items("course")


@router.post("/courses", status_code=201)
async def create_course(payload: CatalogItemInput, _: dict = Staff):
    return await create_catalog_item("course", payload.name)


@router.delete("/courses/{item_id}", status_code=204)
async def delete_course(item_id: str, _: dict = Staff):
    await delete_catalog_item("course", item_id)
    return Response(status_code=204)
