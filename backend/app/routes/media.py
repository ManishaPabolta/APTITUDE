import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from gridfs.errors import NoFile
from motor.motor_asyncio import AsyncIOMotorGridFSBucket

from app.database import get_database
from app.middleware.role_guard import require_roles

router = APIRouter(prefix="/api")
MediaEditor = Annotated[
    dict,
    Depends(require_roles("admin", "teacher", "exam_manager", "question_manager")),
]
MAX_IMAGE_BYTES = 5 * 1024 * 1024
IMAGE_SIGNATURES = (
    (b"\x89PNG\r\n\x1a\n", "image/png", "png"),
    (b"\xff\xd8\xff", "image/jpeg", "jpg"),
    (b"GIF87a", "image/gif", "gif"),
    (b"GIF89a", "image/gif", "gif"),
)


def _image_format(content: bytes) -> tuple[str, str] | None:
    for signature, content_type, extension in IMAGE_SIGNATURES:
        if content.startswith(signature):
            return content_type, extension
    if len(content) >= 12 and content.startswith(b"RIFF") and content[8:12] == b"WEBP":
        return "image/webp", "webp"
    return None


@router.post("/admin/question-bank/media", status_code=201)
async def upload_question_image(_: MediaEditor, file: UploadFile = File(...)):
    content = await file.read(MAX_IMAGE_BYTES + 1)
    if len(content) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Question images must be 5 MB or smaller")
    image = _image_format(content)
    if not image:
        raise HTTPException(status_code=415, detail="Upload a valid PNG, JPEG, GIF, or WebP image")
    content_type, extension = image
    media_id = str(uuid.uuid4())
    bucket = AsyncIOMotorGridFSBucket(get_database(), bucket_name="question_media")
    await bucket.upload_from_stream(
        f"{media_id}.{extension}",
        content,
        _id=media_id,
        metadata={"content_type": content_type, "length": len(content)},
    )
    return {"image_url": f"/api/media/{media_id}", "media_id": media_id}


@router.get("/media/{media_id}")
async def get_question_image(media_id: str):
    bucket = AsyncIOMotorGridFSBucket(get_database(), bucket_name="question_media")
    try:
        image = await bucket.open_download_stream(media_id)
    except NoFile as exc:
        raise HTTPException(status_code=404, detail="Question image not found") from exc
    content_type = (image.metadata or {}).get("content_type", "")
    if content_type not in {"image/png", "image/jpeg", "image/gif", "image/webp"}:
        raise HTTPException(status_code=415, detail="Stored media is not a supported image")
    content = await image.read(MAX_IMAGE_BYTES + 1)
    if len(content) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Stored question image exceeds the allowed size")
    return Response(
        content=content,
        media_type=content_type,
        headers={
            "Cache-Control": "public, max-age=31536000, immutable",
            "X-Content-Type-Options": "nosniff",
        },
    )
