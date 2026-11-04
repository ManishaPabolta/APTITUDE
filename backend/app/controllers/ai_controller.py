from fastapi import HTTPException
from pymongo.errors import PyMongoError

from app.database import get_database
from app.schemas.examination import AIQuestionRequest, AIDraftApproval
from app.services.question_service import approve_ai_draft, create_ai_draft, get_ai_draft


async def generate_draft(payload: AIQuestionRequest, actor: dict) -> dict:
    try:
        return await create_ai_draft(get_database(), payload, actor)
    except HTTPException:
        raise
    except PyMongoError as exc:
        raise HTTPException(status_code=503, detail="Question draft could not be saved to the database") from exc


async def read_draft(draft_id: str, actor: dict) -> dict:
    return await get_ai_draft(get_database(), draft_id, actor)


async def approve_draft(draft_id: str, payload: AIDraftApproval, actor: dict) -> list[dict]:
    try:
        return await approve_ai_draft(get_database(), draft_id, payload, actor)
    except HTTPException:
        raise
    except PyMongoError as exc:
        raise HTTPException(status_code=503, detail="Approved questions could not be saved") from exc


async def discard_draft(draft_id: str, actor: dict) -> None:
    result = await get_database().ai_question_drafts.delete_one(
        {"_id": draft_id, "created_by": actor["_id"], "status": "pending_review"}
    )
    if not result.deleted_count:
        raise HTTPException(status_code=404, detail="Pending question draft not found")
