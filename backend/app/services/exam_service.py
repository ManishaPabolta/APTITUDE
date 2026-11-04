import uuid

from fastapi import HTTPException
from pymongo.errors import DuplicateKeyError, PyMongoError

from app.services.evaluation import evaluate_exam
from app.services.notification_service import enqueue_notifications
from app.services.serializers import now_utc


async def finish_exam(db, session: dict, reason: str) -> dict:
    if session.get("submitted"):
        existing = await db.results.find_one({"_id": session.get("result_id")}) if session.get("result_id") else None
        if existing:
            return existing
        raise HTTPException(status_code=409, detail="This examination has already been submitted")
    claimed = await db.exam_sessions.update_one(
        {"_id": session["_id"], "submitted": False},
        {"$set": {"submitted": True, "submitting": True, "submission_started_at": now_utc()}},
    )
    if not claimed.matched_count:
        latest = await db.exam_sessions.find_one({"_id": session["_id"]})
        existing = await db.results.find_one({"_id": latest.get("result_id")}) if latest and latest.get("result_id") else None
        if existing:
            return existing
        raise HTTPException(status_code=409, detail="Examination submission is already being processed")
    session = await db.exam_sessions.find_one({"_id": session["_id"]})
    if not session:
        raise HTTPException(status_code=404, detail="Examination session not found")

    test = await db.tests.find_one({"_id": session["test_id"]})
    if not test:
        await db.exam_sessions.update_one({"_id": session["_id"]}, {"$set": {"submitted": False}, "$unset": {"submitting": ""}})
        raise HTTPException(status_code=404, detail="Examination no longer exists")
    graded = evaluate_exam(
        session["questions"],
        session.get("answers", {}),
        float(session.get("negative_marks", test.get("negative_marks", 0))),
    )
    result = {
        "_id": str(uuid.uuid4()),
        "student_id": session["student_id"],
        "student_name": session["student_name"],
        "test_id": test["_id"],
        "test_title": test["title"],
        "score": graded["score"],
        "total_marks": graded["total_marks"],
        "percentage": graded["percentage"],
        "passed": graded["percentage"] >= float(session.get("passing_percentage", test.get("passing_percentage", 0))),
        "correct_count": graded["correct_count"],
        "attempted_count": graded["attempted_count"],
        "question_count": len(session["questions"]),
        "attempt_number": session.get("attempt_number", 1),
        "duration_seconds": max(0, int((now_utc() - session["started_at"]).total_seconds())),
        "answers": graded["answers"],
        "submission_reason": reason,
        "started_at": session["started_at"],
        "submitted_at": now_utc(),
    }
    try:
        await db.results.insert_one(result)
    except DuplicateKeyError:
        existing = await db.results.find_one({
            "student_id": session["student_id"],
            "test_id": session["test_id"],
            "attempt_number": session.get("attempt_number", 1),
        })
        if existing:
            await db.exam_sessions.update_one({"_id": session["_id"]}, {"$set": {"result_id": existing["_id"], "submitted": True}})
            return existing
        await db.exam_sessions.update_one({"_id": session["_id"]}, {"$set": {"submitted": False}, "$unset": {"submitting": ""}})
        raise
    except PyMongoError:
        await db.exam_sessions.update_one({"_id": session["_id"]}, {"$set": {"submitted": False}, "$unset": {"submitting": ""}})
        raise
    await db.exam_sessions.update_one(
        {"_id": session["_id"]},
        {"$set": {"submitted_at": result["submitted_at"], "submission_reason": reason, "result_id": result["_id"]}, "$unset": {"submitting": "", "submission_started_at": ""}},
    )
    admins = await db.users.find({"role": {"$in": ["admin", "superadmin", "exam_manager"]}, "active": True}, {"_id": 1, "email": 1}).to_list(length=500)
    if admins:
        await enqueue_notifications(
            db,
            admins,
            title="Examination submitted",
            body=f"{session['student_name']} completed {test['title']}.",
            link="/activity",
        )
    return result
