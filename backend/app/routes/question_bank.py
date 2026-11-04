import io

import pandas as pd
from fastapi import APIRouter, Depends, Query, Response

from app.middleware.role_guard import require_roles
from app.schemas.examination import QuestionInput
from app.services.question_bank_service import (
    list_bank_questions,
    remove_bank_question,
    save_bank_question,
)

router = APIRouter(prefix="/api/admin/question-bank", tags=["Question bank"])
Staff = Depends(require_roles("admin", "teacher", "question_manager"))
QuestionBankReader = Depends(require_roles("admin", "teacher", "question_manager", "exam_manager"))


@router.get("")
async def list_questions(
    category: str | None = None,
    search: str | None = None,
    difficulty: str | None = None,
    tag: str | None = None,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
    _: dict = QuestionBankReader,
):
    return await list_bank_questions(category, search, difficulty, tag, offset, limit)


@router.get("/export")
async def export_questions(_: dict = Staff):
    collection = await list_bank_questions(None, None, None, None, 0, 10000)
    frame = pd.DataFrame(collection["items"])
    content = frame.to_csv(index=False).encode("utf-8-sig")
    return Response(
        content=content,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="question-bank.csv"'},
    )


@router.post("", status_code=201)
async def create_question(payload: QuestionInput, actor: dict = Staff):
    return await save_bank_question(payload, actor["_id"])


@router.patch("/{question_id}")
async def update_question(question_id: str, payload: QuestionInput, actor: dict = Staff):
    return await save_bank_question(payload, actor["_id"], question_id)


@router.delete("/{question_id}", status_code=204)
async def delete_question(question_id: str, actor: dict = Staff):
    await remove_bank_question(question_id, actor["_id"])
    return Response(status_code=204)
