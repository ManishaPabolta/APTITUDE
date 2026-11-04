import re
import uuid

from fastapi import HTTPException
from pymongo.errors import DuplicateKeyError

from app.database import get_database
from app.schemas.examination import QuestionInput
from app.services.audit_service import record_audit_event
from app.services.serializers import now_utc


def public_bank_question(question: dict) -> dict:
    return {
        "id": question["_id"],
        "text": question["text"],
        "type": question["type"],
        "category": question.get("category", "Quantitative Aptitude"),
        "section": question.get("section", "General"),
        "topic": question.get("topic", ""),
        "tags": question.get("tags", []),
        "difficulty": question.get("difficulty", "intermediate"),
        "image_url": question.get("image_url"),
        "math_expression": question.get("math_expression", ""),
        "options": question.get("options", []),
        "correct_answer": question["correct_answer"],
        "marks": question["marks"],
        "explanation": question.get("explanation", ""),
        "source": question.get("source", "manual"),
        "usage_count": question.get("usage_count", 0),
        "created_at": question.get("created_at"),
    }


async def list_bank_questions(
    category: str | None,
    search: str | None,
    difficulty: str | None,
    tag: str | None,
    offset: int,
    limit: int,
) -> dict:
    query: dict = {}
    if category:
        query["category"] = category
    if difficulty:
        query["difficulty"] = difficulty
    if tag:
        query["tags"] = tag.strip()
    if search:
        query["text"] = {"$regex": re.escape(search.strip()), "$options": "i"}
    collection = get_database().question_bank
    total = await collection.count_documents(query)
    documents = await collection.find(query).sort("created_at", -1).skip(offset).limit(limit).to_list(length=limit)
    return {
        "items": [public_bank_question(question) for question in documents],
        "total": total,
        "offset": offset,
        "limit": limit,
    }


async def save_bank_question(payload: QuestionInput, author_id: str, question_id: str | None = None) -> dict:
    db = get_database()
    fields = payload.model_dump(exclude={"id"})
    fields["updated_at"] = now_utc()
    if question_id:
        result = await db.question_bank.update_one(
            {"_id": question_id},
            {"$set": fields},
        )
        if not result.matched_count:
            raise HTTPException(status_code=404, detail="Question not found")
        actor = await db.users.find_one({"_id": author_id}, {"_id": 1, "name": 1, "role": 1})
        if actor:
            await record_audit_event(db, actor, "updated", "question", question_id, {"text": fields["text"][:200]})
        return public_bank_question(await db.question_bank.find_one({"_id": question_id}))

    document = {
        "_id": str(uuid.uuid4()),
        **fields,
        "created_by": author_id,
        "created_at": now_utc(),
        "source": "manual",
    }
    try:
        await db.question_bank.insert_one(document)
    except DuplicateKeyError as exc:
        raise HTTPException(status_code=409, detail="Question could not be saved") from exc
    actor = await db.users.find_one({"_id": author_id}, {"_id": 1, "name": 1, "role": 1})
    if actor:
        await record_audit_event(db, actor, "created", "question", document["_id"], {"text": fields["text"][:200]})
    return public_bank_question(document)


async def remove_bank_question(question_id: str, actor_id: str | None = None) -> None:
    db = get_database()
    question = await db.question_bank.find_one({"_id": question_id}, {"text": 1})
    result = await db.question_bank.delete_one({"_id": question_id})
    if not result.deleted_count:
        raise HTTPException(status_code=404, detail="Question not found")
    if actor_id:
        actor = await db.users.find_one({"_id": actor_id}, {"_id": 1, "name": 1, "role": 1})
        if actor:
            await record_audit_event(db, actor, "deleted", "question", question_id, {"text": (question or {}).get("text", "")[:200]})
