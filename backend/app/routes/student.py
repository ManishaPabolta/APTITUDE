import hashlib
import hmac
import random
import re
import uuid
from datetime import datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.database import get_database
from app.middleware.role_guard import require_roles
from app.schemas import ActivityInput, AccessCodeInput, AnswerInput
from app.services.exam_service import finish_exam
from app.services.notification_service import enqueue_notifications
from app.services.serializers import now_utc, public_question, public_test

router = APIRouter()
StudentUser = Annotated[dict, Depends(require_roles("student"))]


def _parse_datetime(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=now_utc().tzinfo)


def _student_result(result: dict, test: dict | None, *, include_answers: bool = False) -> dict:
    if not test:
        return {"_id": result["_id"], "test_id": result["test_id"], "test_title": result["test_title"], "result_hidden": True}
    visibility = test.get("result_visibility", "immediate")
    closes_at = _parse_datetime(test["closes_at"]) if test.get("closes_at") else None
    if visibility == "hidden" or (visibility == "after_close" and (not closes_at or now_utc() < closes_at)):
        return {
            "_id": result["_id"],
            "test_id": result["test_id"],
            "test_title": result["test_title"],
            "submitted_at": result.get("submitted_at"),
            "result_hidden": True,
        }
    visible = result
    if not test.get("show_explanations", True):
        visible = {**result, "answers": [{key: value for key, value in item.items() if key != "explanation"} for item in result.get("answers", [])]}
    if not include_answers:
        visible = {key: value for key, value in visible.items() if key != "answers"}
    return visible


@router.get("/api/student/tests")
async def student_tests(student: StudentUser):
    db = get_database()
    tests = await db.tests.find({"published": True}).sort("scheduled_at", 1).to_list(length=500)
    results = await db.results.find({"student_id": student["_id"]}).sort("submitted_at", -1).to_list(length=1000)
    sessions = await db.exam_sessions.find({"student_id": student["_id"], "submitted": False}, {"test_id": 1, "_id": 1}).to_list(length=500)
    completed = {}
    attempt_counts = {}
    for result in results:
        completed.setdefault(result["test_id"], result)
        attempt_counts[result["test_id"]] = attempt_counts.get(result["test_id"], 0) + 1
    active_sessions = {session["test_id"]: session["_id"] for session in sessions}
    available = []
    current_time = now_utc()
    for test in tests:
        scheduled = _parse_datetime(test["scheduled_at"]) if test.get("scheduled_at") else None
        closes = _parse_datetime(test["closes_at"]) if test.get("closes_at") else None
        assigned = (not test.get("student_ids") and not test.get("batch")) or student["_id"] in test.get("student_ids", []) or (test.get("batch") and test["batch"] == student.get("batch"))
        if not assigned:
            continue
        result = completed.get(test["_id"])
        attempts_used = attempt_counts.get(test["_id"], 0)
        attempts_remaining = max(0, int(test.get("allowed_attempts", 1)) - attempts_used)
        completion_status = "completed" if attempts_remaining == 0 else None
        available.append({
            **public_test(test),
            "question_count": test.get("questions_per_attempt") or len(test.get("questions", [])),
            "question_pool_size": len(test.get("questions", [])),
            "status": completion_status or ("in_progress" if test["_id"] in active_sessions else ("upcoming" if scheduled and scheduled > current_time else ("closed" if closes and closes < current_time else "available"))),
            "attempts_used": attempts_used,
            "attempts_remaining": attempts_remaining,
            "session_id": active_sessions.get(test["_id"]),
            "result": _student_result(result, test) if result else None,
        })
    return available


@router.post("/api/student/tests/{test_id}/start", status_code=201)
async def start_test(
    test_id: str,
    student: StudentUser,
    payload: AccessCodeInput | None = Body(default=None),
):
    db = get_database()
    test = await db.tests.find_one({"_id": test_id, "published": True})
    if not test:
        raise HTTPException(status_code=404, detail="Examination not found or not published")
    scheduled = _parse_datetime(test["scheduled_at"]) if test.get("scheduled_at") else None
    closes = _parse_datetime(test["closes_at"]) if test.get("closes_at") else None
    current_time = now_utc()
    if scheduled and scheduled > current_time:
        raise HTTPException(status_code=403, detail="This examination has not started yet")
    if closes and closes < current_time:
        raise HTTPException(status_code=403, detail="This examination is closed")
    assigned = (not test.get("student_ids") and not test.get("batch")) or student["_id"] in test.get("student_ids", []) or (test.get("batch") and test["batch"] == student.get("batch"))
    if not assigned:
        raise HTTPException(status_code=403, detail="This examination is not assigned to you")

    existing = await db.exam_sessions.find_one({"student_id": student["_id"], "test_id": test_id, "submitted": False})
    if existing:
        return await session_response(existing)
    if test.get("access_code_hash"):
        supplied = hashlib.sha256((payload.access_code if payload else "").encode()).hexdigest()
        if not hmac.compare_digest(supplied, test["access_code_hash"]):
            raise HTTPException(status_code=403, detail="A valid examination access code is required")
    attempts_used = await db.results.count_documents({"student_id": student["_id"], "test_id": test_id})
    allowed_attempts = int(test.get("allowed_attempts", 1))
    if attempts_used >= allowed_attempts:
        raise HTTPException(status_code=409, detail="You have used all allowed attempts for this examination")
    other_active = await db.exam_sessions.find_one({"student_id": student["_id"], "submitted": False})
    if other_active:
        raise HTTPException(status_code=409, detail="Finish or submit your active examination before starting another one")

    questions = [dict(question) for question in test.get("questions", [])]
    if not questions:
        raise HTTPException(status_code=400, detail="This examination has no questions")
    section_limits = test.get("section_time_limits", {})
    if section_limits:
        grouped_questions = {}
        for question in questions:
            question["section"] = question.get("section", "General")
            grouped_questions.setdefault(question["section"], []).append(question)
        questions = []
        for section_name in section_limits:
            section_questions = grouped_questions.get(section_name, [])
            if test.get("randomize_questions", True):
                random.SystemRandom().shuffle(section_questions)
            questions.extend(section_questions)
    elif test.get("randomize_questions", True):
        random.SystemRandom().shuffle(questions)
    if test.get("questions_per_attempt"):
        questions = questions[:test["questions_per_attempt"]]
    for question in questions:
        question.setdefault("id", str(uuid.uuid4()))
        if question.get("options") and test.get("randomize_options", True):
            random.SystemRandom().shuffle(question["options"])
    bank_question_ids = [
        question["bank_question_id"] for question in questions if question.get("bank_question_id")
    ]
    started = now_utc()
    session = {
        "_id": str(uuid.uuid4()), "student_id": student["_id"], "student_name": student["name"],
        "test_id": test_id, "questions": questions, "answers": {}, "submitted": False,
        "started_at": started, "expires_at": started + timedelta(minutes=test["duration_minutes"]),
        "negative_marks": test["negative_marks"], "passing_percentage": test["passing_percentage"],
        "attempt_number": attempts_used + 1,
        "section_time_limits": {section: int(minutes) * 60 for section, minutes in section_limits.items()},
        "active_section_index": 0,
        "section_started_at": started,
        "section_expires_at": started + timedelta(minutes=next(iter(section_limits.values()))) if section_limits else None,
        "violation_count": 0,
        "violation_limit": int(test.get("violation_limit", 1)),
        "immediate_submit_events": test.get(
            "immediate_submit_events",
            ["tab_switch", "visibility_change", "fullscreen_exit", "window_blur"],
        ),
    }
    try:
        await db.exam_sessions.insert_one(session)
    except DuplicateKeyError:
        active_session = await db.exam_sessions.find_one({
            "student_id": student["_id"],
            "test_id": test_id,
            "submitted": False,
        })
        if active_session:
            return await session_response(active_session)
        raise HTTPException(status_code=409, detail="An examination attempt is already active or being finalized")
    if bank_question_ids:
        await db.question_bank.update_many(
            {"_id": {"$in": bank_question_ids}},
            {"$inc": {"usage_count": 1}, "$addToSet": {"used_in_tests": test_id}},
        )
    admins = await db.users.find({"role": {"$in": ["admin", "superadmin", "exam_manager"]}, "active": True}, {"_id": 1, "email": 1}).to_list(length=500)
    if admins:
        await enqueue_notifications(
            db,
            admins,
            title="Student started an examination",
            body=f"{student['name']} started {test['title']}.",
            link="/activity",
        )
    return await session_response(session)


async def session_response(session: dict) -> dict:
    if session.get("submitted"):
        raise HTTPException(status_code=409, detail="This examination has already been submitted")
    current_time = now_utc()
    remaining = max(0, int((session["expires_at"] - current_time).total_seconds()))
    if remaining <= 0:
        await finish_exam(get_database(), session, "time_expired")
        raise HTTPException(status_code=410, detail="Examination time has expired")
    section_names = list(session.get("section_time_limits", {}))
    section = section_names[session.get("active_section_index", 0)] if section_names else None
    section_remaining = None
    if section:
        section_remaining = max(0, int((session["section_expires_at"] - current_time).total_seconds()))
        if section_remaining <= 0:
            session = await _advance_section(session, automatic=True)
            if session.get("submitted"):
                raise HTTPException(status_code=410, detail="The examination section time has expired")
            section_names = list(session.get("section_time_limits", {}))
            section = section_names[session.get("active_section_index", 0)]
            section_remaining = max(0, int((session["section_expires_at"] - now_utc()).total_seconds()))
    return {
        "session_id": session["_id"], "test_id": session["test_id"], "started_at": session["started_at"],
        "expires_at": session["expires_at"], "remaining_seconds": remaining,
        "section": section,
        "section_index": session.get("active_section_index", 0),
        "section_count": len(section_names),
        "section_remaining_seconds": section_remaining,
        "violation_count": session.get("violation_count", 0),
        "violation_limit": session.get("violation_limit", 1),
        "questions": [public_question(question, index) for index, question in enumerate(session["questions"])],
        "answers": session.get("answers", {}),
    }


async def _advance_section(session: dict, *, automatic: bool = False) -> dict:
    db = get_database()
    names = list(session.get("section_time_limits", {}))
    if not names:
        raise HTTPException(status_code=400, detail="This exam does not use timed sections")
    current_index = int(session.get("active_section_index", 0))
    current_time = now_utc()
    if not automatic and current_time < session["section_expires_at"]:
        pass
    elif not automatic and current_time >= session["section_expires_at"]:
        automatic = True
    next_index = current_index + 1
    if next_index >= len(names):
        if not automatic:
            raise HTTPException(status_code=409, detail="You are already in the final section")
        result = await finish_exam(db, session, "section_time_expired")
        return {"submitted": True, "result": result}
    next_section = names[next_index]
    next_start = current_time
    next_expiry = next_start + timedelta(seconds=session["section_time_limits"][next_section])
    updated = await db.exam_sessions.find_one_and_update(
        {
            "_id": session["_id"],
            "submitted": False,
            "active_section_index": current_index,
            "section_started_at": session["section_started_at"],
        },
        {"$set": {
            "active_section_index": next_index,
            "section_started_at": next_start,
            "section_expires_at": next_expiry,
        }},
        return_document=ReturnDocument.AFTER,
    )
    if updated:
        return updated
    latest = await db.exam_sessions.find_one({"_id": session["_id"]})
    if not latest or latest.get("submitted"):
        raise HTTPException(status_code=409, detail="The examination has already been submitted")
    return latest


@router.post("/api/student/sessions/{session_id}/section/advance")
async def advance_section(session_id: str, student: StudentUser):
    session = await get_database().exam_sessions.find_one({"_id": session_id, "student_id": student["_id"]})
    if not session:
        raise HTTPException(status_code=404, detail="Examination session not found")
    if session.get("submitted"):
        raise HTTPException(status_code=409, detail="Examination has already been submitted")
    updated = await _advance_section(session)
    if updated.get("submitted"):
        test = await get_database().tests.find_one({"_id": updated["result"]["test_id"]})
        return {"submitted": True, "result": _student_result(updated["result"], test)}
    return await session_response(updated)


@router.get("/api/student/sessions/{session_id}")
async def get_session(session_id: str, student: StudentUser):
    session = await get_database().exam_sessions.find_one({"_id": session_id, "student_id": student["_id"]})
    if not session:
        raise HTTPException(status_code=404, detail="Examination session not found")
    return await session_response(session)


@router.put("/api/student/sessions/{session_id}/answers/{question_id}")
async def save_answer(session_id: str, question_id: str, payload: AnswerInput, student: StudentUser):
    db = get_database()
    session = await db.exam_sessions.find_one({"_id": session_id, "student_id": student["_id"]})
    if not session:
        raise HTTPException(status_code=404, detail="Examination session not found")
    if session.get("submitted"):
        raise HTTPException(status_code=409, detail="Examination has already been submitted")
    if now_utc() >= session["expires_at"]:
        await finish_exam(db, session, "time_expired")
        raise HTTPException(status_code=410, detail="Examination time has expired")
    question = next((item for item in session["questions"] if item["id"] == question_id), None)
    if not question:
        raise HTTPException(status_code=404, detail="Question does not belong to this session")
    active_section_index = int(session.get("active_section_index", 0))
    section_names = list(session.get("section_time_limits", {}))
    if section_names:
        if now_utc() >= session["section_expires_at"]:
            session = await _advance_section(session, automatic=True)
            if session.get("submitted"):
                raise HTTPException(status_code=410, detail="Examination section time has expired")
            section_names = list(session.get("section_time_limits", {}))
            active_section_index = int(session.get("active_section_index", 0))
        if question.get("section", "General") != section_names[active_section_index]:
            raise HTTPException(status_code=409, detail="This question belongs to a different timed section")
    saved = await db.exam_sessions.update_one(
        {"_id": session_id, "submitted": False},
        {"$set": {f"answers.{question_id}": {"answer": payload.answer, "marked_for_review": payload.marked_for_review, "saved_at": now_utc()}}},
    )
    if not saved.matched_count:
        raise HTTPException(status_code=409, detail="Examination submission has already started")
    return {"saved": True}


@router.post("/api/student/sessions/{session_id}/activity")
async def log_activity(session_id: str, payload: ActivityInput, student: StudentUser):
    db = get_database()
    session = await db.exam_sessions.find_one({"_id": session_id, "student_id": student["_id"]})
    if not session:
        raise HTTPException(status_code=404, detail="Examination session not found")
    if session.get("submitted"):
        return {"logged": False, "submitted": True}
    activity = {
        "_id": str(uuid.uuid4()), "session_id": session_id, "student_id": student["_id"],
        "student_name": session["student_name"], "test_id": session["test_id"],
        "event_type": payload.event_type,
        "details": payload.details[:500], "timestamp": now_utc(),
    }
    test = await db.tests.find_one({"_id": session["test_id"]}, {"title": 1})
    activity["test_title"] = test.get("title") if test else session["test_id"]
    updated = await db.exam_sessions.find_one_and_update(
        {"_id": session_id, "student_id": student["_id"], "submitted": False},
        {"$inc": {"violation_count": 1}},
        return_document=ReturnDocument.AFTER,
    )
    if not updated:
        return {"logged": False, "submitted": True}
    activity["violation_count"] = updated.get("violation_count", 1)
    await db.activity_logs.insert_one(activity)
    admins = await db.users.find({"role": {"$in": ["admin", "superadmin", "exam_manager"]}, "active": True}, {"_id": 1, "email": 1}).to_list(length=500)
    if admins:
        await enqueue_notifications(
            db,
            admins,
            title="Examination integrity event",
            body=f"{session['student_name']} recorded {payload.event_type} in {activity['test_title']} (violation {activity['violation_count']}/{updated.get('violation_limit', 1)}).",
            link=f"/activity?session_id={session_id}",
        )
    immediate_events = set(updated.get(
        "immediate_submit_events",
        ["tab_switch", "visibility_change", "fullscreen_exit", "window_blur"],
    ))
    violation_limit = int(updated.get("violation_limit", 1))
    should_submit = payload.event_type in immediate_events or activity["violation_count"] >= violation_limit
    if should_submit:
        reason = (
            f"anti_cheat:{payload.event_type}"
            if payload.event_type in immediate_events
            else "anti_cheat:violation_limit"
        )
        result = await finish_exam(db, updated, reason)
        if admins:
            await enqueue_notifications(
                db,
                admins,
                title="Examination auto-submitted",
                body=f"{session['student_name']}'s attempt for {activity['test_title']} was submitted after {activity['violation_count']} violation(s).",
                link=f"/activity?session_id={session_id}",
            )
        return {
            "logged": True,
            "submitted": True,
            "violation_count": activity["violation_count"],
            "violation_limit": violation_limit,
            "result": _student_result(result, await db.tests.find_one({"_id": session["test_id"]})),
        }
    return {
        "logged": True,
        "submitted": False,
        "violation_count": activity["violation_count"],
        "violation_limit": violation_limit,
    }


@router.post("/api/student/sessions/{session_id}/submit")
async def submit_test(session_id: str, student: StudentUser):
    db = get_database()
    session = await db.exam_sessions.find_one({"_id": session_id, "student_id": student["_id"]})
    if not session:
        raise HTTPException(status_code=404, detail="Examination session not found")
    if session.get("submitted"):
        result = await db.results.find_one({"_id": session["result_id"]})
        if result:
            test = await db.tests.find_one({"_id": result["test_id"]})
            return _student_result(result, test)
        raise HTTPException(status_code=409, detail="This examination has already been submitted")
    reason = "time_expired" if now_utc() >= session["expires_at"] else "student_submitted"
    result = await finish_exam(db, session, reason)
    test = await db.tests.find_one({"_id": result["test_id"]})
    return _student_result(result, test)


@router.get("/api/student/results")
async def student_results(
    student: StudentUser,
    test_id: str | None = None,
    search: str | None = Query(default=None, max_length=160),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=25, ge=1, le=100),
):
    db = get_database()
    collection = db.results
    query = {"student_id": student["_id"]}
    if test_id:
        query["test_id"] = test_id
    if search and search.strip():
        query["test_title"] = {"$regex": re.escape(search.strip()), "$options": "i"}
    total = await collection.count_documents(query)
    results = await collection.find(query).sort("submitted_at", -1).skip(offset).limit(limit).to_list(length=limit)
    items = [
        _student_result(result, await db.tests.find_one({"_id": result["test_id"]}))
        for result in results
    ]
    return {"items": items, "total": total, "offset": offset, "limit": limit}


@router.get("/api/student/results/{result_id}")
async def student_result(result_id: str, student: StudentUser):
    result = await get_database().results.find_one({"_id": result_id, "student_id": student["_id"]})
    if not result:
        raise HTTPException(status_code=404, detail="Result not found")
    test = await get_database().tests.find_one({"_id": result["test_id"]})
    return _student_result(result, test, include_answers=True)
