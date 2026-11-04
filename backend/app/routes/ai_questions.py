from fastapi import APIRouter, Depends, Response

from app.controllers.ai_controller import approve_draft, discard_draft, generate_draft, read_draft
from app.database import get_database
from app.middleware.role_guard import require_roles
from app.schemas.examination import AIQuestionRequest, AIDraftApproval
from app.services.audit_service import record_audit_event

router = APIRouter(prefix="/api/admin/ai", tags=["AI question generation"])
Staff = Depends(require_roles("admin", "teacher", "question_manager"))


@router.get("/drafts")
async def list_pending_drafts(actor=Staff):
    drafts = await get_database().ai_question_drafts.find(
        {"created_by": actor["_id"], "status": "pending_review"},
        {"questions": 0},
    ).sort("created_at", -1).to_list(length=50)
    return [
        {
            "id": draft["_id"],
            "category": draft["category"],
            "difficulty": draft["difficulty"],
            "topic": draft.get("topic", ""),
            "question_count": len(draft.get("questions", [])),
            "created_at": draft["created_at"],
        }
        for draft in drafts
    ]


@router.post("/questions", status_code=201)
async def generate_question_draft(payload: AIQuestionRequest, actor=Staff):
    draft = await generate_draft(payload, actor)
    await record_audit_event(
        get_database(),
        actor,
        "generated_draft",
        "question_draft",
        draft["_id"],
        {"category": draft["category"], "question_count": len(draft["questions"])},
    )
    return {
        "id": draft["_id"],
        "status": draft["status"],
        "category": draft["category"],
        "difficulty": draft["difficulty"],
        "questions": draft["questions"],
    }


@router.get("/drafts/{draft_id}")
async def read_question_draft(draft_id: str, actor=Staff):
    draft = await read_draft(draft_id, actor)
    return {
        "id": draft["_id"],
        "status": draft["status"],
        "category": draft["category"],
        "difficulty": draft["difficulty"],
        "questions": draft["questions"],
    }


@router.post("/drafts/{draft_id}/approve", status_code=201)
async def approve_question_draft(draft_id: str, payload: AIDraftApproval, actor=Staff):
    questions = await approve_draft(draft_id, payload, actor)
    await record_audit_event(
        get_database(),
        actor,
        "approved",
        "question_draft",
        draft_id,
        {"question_count": len(questions)},
    )
    return {
        "approved": len(questions),
        "questions": [
            {
                "id": question["id"],
                "text": question["text"],
                "type": question["type"],
                "category": question["category"],
                "section": question.get("section", "General"),
                "topic": question.get("topic", ""),
                "tags": question.get("tags", []),
                "difficulty": question["difficulty"],
                "options": question["options"],
                "correct_answer": question["correct_answer"],
                "marks": question["marks"],
                "image_url": question.get("image_url"),
                "math_expression": question.get("math_expression", ""),
                "explanation": question["explanation"],
            }
            for question in questions
        ],
    }


@router.delete("/drafts/{draft_id}", status_code=204)
async def discard_question_draft(draft_id: str, actor=Staff):
    await discard_draft(draft_id, actor)
    await record_audit_event(get_database(), actor, "discarded", "question_draft", draft_id)
    return Response(status_code=204)
