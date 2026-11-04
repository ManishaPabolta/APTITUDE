import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo.errors import PyMongoError

from app.ai.groq_client import generate_questions
from app.schemas.examination import AIQuestionRequest, AIDraftApproval


async def create_ai_draft(db: AsyncIOMotorDatabase, request: AIQuestionRequest, actor: dict) -> dict:
    from app.ai.groq_client import QuestionGenerationError

    try:
        questions = await generate_questions(request)
    except QuestionGenerationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    normalized_texts = [" ".join(question.text.split()).casefold() for question in questions]
    if len(normalized_texts) != len(set(normalized_texts)):
        raise HTTPException(status_code=502, detail="Groq returned duplicate questions. Please generate the batch again.")
    draft = {
        "_id": str(uuid.uuid4()),
        "created_by": actor["_id"],
        "category": request.category,
        "difficulty": request.difficulty,
        "topic": request.topic,
        "subtopic": request.subtopic,
        "company_exam": request.company_exam,
        "custom_prompt": request.custom_prompt,
        "question_format": request.question_format,
        "marks": request.marks,
        "negative_marks": request.negative_marks,
        "include_explanations": request.include_explanations,
        "status": "pending_review",
        "questions": [
            {"id": str(uuid.uuid4()), **question.model_dump(exclude={"id"})}
            for question in questions
        ],
        "created_at": datetime.now(timezone.utc),
    }
    await db.ai_question_drafts.insert_one(draft)
    return draft


async def get_ai_draft(db: AsyncIOMotorDatabase, draft_id: str, actor: dict) -> dict:
    draft = await db.ai_question_drafts.find_one({"_id": draft_id, "created_by": actor["_id"]})
    if not draft:
        raise HTTPException(status_code=404, detail="Question draft not found")
    return draft


async def approve_ai_draft(
    db: AsyncIOMotorDatabase, draft_id: str, payload: AIDraftApproval, actor: dict
) -> list[dict]:
    draft = await get_ai_draft(db, draft_id, actor)
    if any(question.type != draft["question_format"] for question in payload.questions):
        raise HTTPException(status_code=422, detail="Question format must match the generated draft")
    normalized_texts = [" ".join(question.text.split()).casefold() for question in payload.questions]
    if len(normalized_texts) != len(set(normalized_texts)):
        raise HTTPException(status_code=422, detail="A draft cannot approve duplicate question text")
    existing = await db.question_bank.find(
        {"text": {"$in": [question.text for question in payload.questions]}},
        {"text": 1},
    ).to_list(length=len(payload.questions))
    existing_texts = {
        " ".join(str(question.get("text", "")).split()).casefold()
        for question in existing
    }
    if existing_texts.intersection(normalized_texts):
        raise HTTPException(status_code=409, detail="One or more questions already exist in the question bank")
    claim = await db.ai_question_drafts.update_one(
        {"_id": draft_id, "created_by": actor["_id"], "status": "pending_review"},
        {"$set": {"status": "approving"}},
    )
    if not claim.modified_count:
        raise HTTPException(status_code=409, detail="This question draft has already been reviewed")
    now = datetime.now(timezone.utc)
    approved = [
        {
            "_id": str(uuid.uuid4()),
            "id": str(uuid.uuid4()),
            **question.model_dump(exclude={"id"}),
            "created_by": actor["_id"],
            "created_at": now,
            "source": "groq",
            "draft_id": draft_id,
        }
        for question in payload.questions
    ]
    try:
        await db.question_bank.insert_many(approved)
        finalized = await db.ai_question_drafts.update_one(
            {"_id": draft_id, "status": "approving"},
            {"$set": {"status": "approved", "reviewed_at": now, "approved_question_ids": [q["_id"] for q in approved]}},
        )
        if not finalized.modified_count:
            await db.question_bank.delete_many({"draft_id": draft_id})
            await db.ai_question_drafts.update_one(
                {"_id": draft_id, "status": "approving"},
                {"$set": {"status": "pending_review"}},
            )
            raise HTTPException(status_code=409, detail="Question draft approval could not be finalized")
    except PyMongoError:
        await db.question_bank.delete_many({"draft_id": draft_id})
        await db.ai_question_drafts.update_one(
            {"_id": draft_id, "status": "approving"},
            {"$set": {"status": "pending_review"}},
        )
        raise
    return approved
