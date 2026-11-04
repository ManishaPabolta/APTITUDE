import io
import hashlib
import re
import uuid
from datetime import datetime, timezone
from typing import Annotated

import numpy as np
import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pymongo.errors import DuplicateKeyError

from app.database import get_database
from app.schemas import TestInput, UserCreate, UserUpdate
from app.security import hash_password
from app.middleware.role_guard import ensure_user_management_access, require_roles
from app.services.serializers import now_utc, public_test, public_user
from app.services.audit_service import record_audit_event
from app.services.notification_service import notify_test_assignees

router = APIRouter()
AdminUser = Annotated[dict, Depends(require_roles("admin"))]
TeacherUser = Annotated[dict, Depends(require_roles("admin", "teacher"))]
ExamManagerUser = Annotated[dict, Depends(require_roles("admin", "teacher", "exam_manager"))]
MetricsUser = Annotated[dict, Depends(require_roles("admin", "teacher", "question_manager", "exam_manager"))]


def _utc_datetime(value):
    if not value:
        return None
    parsed = value if isinstance(value, datetime) else datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    return parsed.replace(tzinfo=timezone.utc) if parsed.tzinfo is None else parsed


@router.get("/api/admin/overview")
async def admin_overview(_: MetricsUser):
    db = get_database()
    student_count = await db.users.count_documents({"role": "student", "active": True})
    teacher_count = await db.users.count_documents({"role": "teacher", "active": True})
    admin_count = await db.users.count_documents({"role": "admin", "active": True})
    tests = await db.tests.count_documents({})
    registered_users = await db.users.count_documents({"active": True})
    test_documents = await db.tests.find({"published": True}, {"scheduled_at": 1, "closes_at": 1}).to_list(length=2000)
    now = now_utc()
    active_exams = sum(
        (not _utc_datetime(item.get("scheduled_at")) or _utc_datetime(item.get("scheduled_at")) <= now)
        and (not _utc_datetime(item.get("closes_at")) or _utc_datetime(item.get("closes_at")) >= now)
        for item in test_documents
    )
    results = await db.results.find({}, {"percentage": 1, "passed": 1, "submitted_at": 1, "test_title": 1, "student_name": 1, "score": 1}).to_list(length=5000)
    scores = np.array([item["percentage"] for item in results], dtype=float)
    recent = sorted(results, key=lambda x: _utc_datetime(x.get("submitted_at")) or datetime.min.replace(tzinfo=timezone.utc), reverse=True)[:8]
    activity_count = await db.activity_logs.count_documents({})
    recent_activity = await db.activity_logs.find(
        {}, {"student_name": 1, "test_title": 1, "event_type": 1, "timestamp": 1}
    ).sort("timestamp", -1).to_list(length=8)
    return {
        "students": student_count,
        "teachers": teacher_count,
        "admins": admin_count,
        "registered_users": registered_users,
        "tests": tests,
        "active_exams": active_exams,
        "submissions": len(results),
        "completed_exams": len(results),
        "cheating_alerts": activity_count,
        "average_percentage": round(float(np.mean(scores)), 1) if scores.size else 0,
        "pass_rate": round(float(np.mean([item.get("passed", False) for item in results]) * 100), 1) if scores.size else 0,
        "recent_results": recent,
        "recent_activity": recent_activity,
    }


@router.get("/api/admin/audit-logs")
async def admin_audit_logs(_: AdminUser):
    return await get_database().audit_logs.find().sort("timestamp", -1).to_list(length=500)


@router.get("/api/admin/users")
async def list_users(actor: AdminUser, role: str | None = None, search: str | None = None):
    query: dict = {}
    if actor["role"] != "superadmin":
        if role and role != "student":
            return []
        query["role"] = "student"
    elif role in {"student", "teacher", "admin", "superadmin", "question_manager", "exam_manager"}:
        query["role"] = role
    if search:
        escaped = re.escape(search.strip())
        query["$or"] = [{"name": {"$regex": escaped, "$options": "i"}}, {"email": {"$regex": escaped, "$options": "i"}}]
    users = await get_database().users.find(query).sort("created_at", -1).to_list(length=1000)
    return [public_user(user) for user in users]


@router.get("/api/staff/students")
async def staff_students(_: ExamManagerUser):
    users = await get_database().users.find({"role": "student", "active": True}).sort("name", 1).to_list(length=2000)
    return [public_user(user) for user in users]


async def validate_test_assignments(payload: TestInput) -> None:
    if not payload.student_ids:
        return
    valid_count = await get_database().users.count_documents({
        "_id": {"$in": payload.student_ids},
        "role": "student",
        "active": True,
    })
    if valid_count != len(payload.student_ids):
        raise HTTPException(status_code=400, detail="One or more assigned student IDs are invalid or inactive")


@router.post("/api/admin/users", status_code=201)
async def create_user(payload: UserCreate, actor: AdminUser):
    ensure_user_management_access(actor["role"], payload.role)
    user = {
        "_id": str(uuid.uuid4()), "name": payload.name.strip(), "email": payload.email.lower(),
        "password_hash": hash_password(payload.password), "role": payload.role, "batch": payload.batch,
        "course": payload.course, "active": True, "created_at": now_utc(),
    }
    try:
        db = get_database()
        await db.users.insert_one(user)
    except DuplicateKeyError as exc:
        raise HTTPException(status_code=409, detail="An account with this email already exists") from exc
    await record_audit_event(db, actor, "created", "user", user["_id"], {"name": user["name"], "role": user["role"]})
    return public_user(user)


@router.patch("/api/admin/users/{user_id}")
async def update_user(user_id: str, payload: UserUpdate, admin: AdminUser):
    changes = payload.model_dump(exclude_unset=True)
    target = await get_database().users.find_one({"_id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    ensure_user_management_access(admin["role"], target["role"])
    if target["role"] == "superadmin":
        raise HTTPException(status_code=403, detail="The superadmin account cannot be changed here")
    if changes.get("role") is not None:
        ensure_user_management_access(admin["role"], changes["role"])
    if user_id == admin["_id"] and changes.get("active") is False:
        raise HTTPException(status_code=400, detail="You cannot deactivate your own account")
    db = get_database()
    result = await db.users.update_one({"_id": user_id}, {"$set": changes})
    if not result.matched_count:
        raise HTTPException(status_code=404, detail="User not found")
    await record_audit_event(db, admin, "updated", "user", user_id, {"fields": sorted(changes)})
    return public_user(await db.users.find_one({"_id": user_id}))


@router.delete("/api/admin/users/{user_id}", status_code=204)
async def deactivate_user(user_id: str, admin: AdminUser):
    if user_id == admin["_id"]:
        raise HTTPException(status_code=400, detail="You cannot deactivate your own account")
    db = get_database()
    target = await db.users.find_one({"_id": user_id}, {"role": 1})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    ensure_user_management_access(admin["role"], target["role"])
    if target["role"] == "superadmin":
        raise HTTPException(status_code=403, detail="The superadmin account cannot be deactivated here")
    result = await db.users.update_one({"_id": user_id}, {"$set": {"active": False}})
    if not result.matched_count:
        raise HTTPException(status_code=404, detail="User not found")
    await record_audit_event(db, admin, "deactivated", "user", user_id)


@router.post("/api/admin/users/import")
async def import_users(actor: AdminUser, file: UploadFile = File(...)):
    extension = file.filename.rsplit(".", 1)[-1].lower() if file.filename else ""
    if extension not in {"csv", "xlsx"}:
        raise HTTPException(status_code=400, detail="Upload a .csv or .xlsx file")
    contents = await file.read(10 * 1024 * 1024 + 1)
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Spreadsheet uploads must be 10 MB or smaller")
    try:
        frame = (pd.read_csv(io.BytesIO(contents)) if extension == "csv" else pd.read_excel(io.BytesIO(contents))).fillna("")
    except (UnicodeDecodeError, pd.errors.ParserError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="Could not read the uploaded spreadsheet") from exc
    required = {"name", "email"}
    if not required.issubset({str(column).strip().lower() for column in frame.columns}):
        raise HTTPException(status_code=400, detail="CSV headers must include name and email")
    frame.columns = [str(column).strip().lower() for column in frame.columns]
    if len(frame) > 5000:
        raise HTTPException(status_code=413, detail="A student CSV can contain at most 5,000 rows")
    db = get_database()
    inserted = 0
    skipped = []
    credentials = []
    for row_number, row in frame.iterrows():
        name, email = str(row.get("name", "")).strip(), str(row.get("email", "")).strip().lower()
        if not name or not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
            skipped.append({"row": int(row_number) + 2, "reason": "Name or email is invalid"})
            continue
        if await db.users.find_one({"email": email}):
            skipped.append({"row": int(row_number) + 2, "reason": "Email already exists"})
            continue
        password = str(row.get("password", "")).strip() or uuid.uuid4().hex[:12] + "A!"
        user = {
            "_id": str(uuid.uuid4()), "name": name, "email": email, "password_hash": hash_password(password),
            "role": "student", "batch": str(row.get("batch", "")).strip() or None,
            "course": str(row.get("course", "")).strip() or None, "active": True, "created_at": now_utc(),
        }
        try:
            await db.users.insert_one(user)
            inserted += 1
            credentials.append({"email": email, "temporary_password": password})
        except DuplicateKeyError:
            skipped.append({"row": int(row_number) + 2, "reason": "Email already exists"})
    await record_audit_event(db, actor, "imported_users", "user", details={"inserted": inserted, "skipped": len(skipped)})
    return {"inserted": inserted, "skipped": skipped, "total_rows": len(frame), "credentials": credentials}


@router.get("/api/admin/tests")
async def admin_tests(_: ExamManagerUser):
    tests = await get_database().tests.find().sort("created_at", -1).to_list(length=500)
    return [public_test(test) for test in tests]


@router.post("/api/admin/tests", status_code=201)
async def create_test(payload: TestInput, actor: ExamManagerUser):
    await validate_test_assignments(payload)
    test = payload.model_dump()
    access_code = test.pop("access_code")
    test.pop("clear_access_code", None)
    test["access_code_hash"] = hashlib.sha256(access_code.encode()).hexdigest() if access_code else None
    test["_id"] = str(uuid.uuid4())
    test["questions"] = [{**question, "id": str(uuid.uuid4())} for question in test["questions"]]
    test["created_at"] = now_utc()
    test["updated_at"] = test["created_at"]
    if test["published"] and not test["questions"]:
        raise HTTPException(status_code=400, detail="Add at least one question before publishing")
    await get_database().tests.insert_one(test)
    db = get_database()
    await record_audit_event(db, actor, "created", "exam", test["_id"], {"title": test["title"]})
    if test["published"]:
        await notify_test_assignees(db, test)
    return public_test(test)


@router.get("/api/admin/tests/{test_id}")
async def get_admin_test(test_id: str, _: ExamManagerUser):
    test = await get_database().tests.find_one({"_id": test_id})
    if not test:
        raise HTTPException(status_code=404, detail="Examination not found")
    return {**public_test(test), "questions": test.get("questions", [])}


@router.put("/api/admin/tests/{test_id}")
async def update_test(test_id: str, payload: TestInput, actor: ExamManagerUser):
    await validate_test_assignments(payload)
    test = payload.model_dump()
    access_code = test.pop("access_code")
    clear_access_code = test.pop("clear_access_code")
    test["questions"] = [
        {**question, "id": question.get("id") or str(uuid.uuid4())}
        for question in test["questions"]
    ]
    if test["published"] and not test["questions"]:
        raise HTTPException(status_code=400, detail="Add at least one question before publishing")
    test["updated_at"] = now_utc()
    db = get_database()
    previous = await db.tests.find_one({"_id": test_id}, {"published": 1, "access_code_hash": 1})
    if access_code:
        test["access_code_hash"] = hashlib.sha256(access_code.encode()).hexdigest()
    elif clear_access_code:
        test["access_code_hash"] = None
    elif previous:
        test["access_code_hash"] = previous.get("access_code_hash")
    result = await db.tests.update_one({"_id": test_id}, {"$set": test})
    if not result.matched_count:
        raise HTTPException(status_code=404, detail="Examination not found")
    saved_test = await db.tests.find_one({"_id": test_id})
    action = "published" if test["published"] and not (previous or {}).get("published") else "updated"
    await record_audit_event(db, actor, action, "exam", test_id, {"title": test["title"]})
    if action == "published":
        await notify_test_assignees(db, saved_test)
    return public_test(saved_test)


@router.delete("/api/admin/tests/{test_id}", status_code=204)
async def delete_test(test_id: str, actor: ExamManagerUser):
    db = get_database()
    test = await db.tests.find_one({"_id": test_id}, {"title": 1})
    if not test:
        raise HTTPException(status_code=404, detail="Examination not found")
    if await db.exam_sessions.find_one({"test_id": test_id}):
        raise HTTPException(status_code=409, detail="An examination with attempts cannot be deleted")
    result = await db.tests.delete_one({"_id": test_id})
    if not result.deleted_count:
        raise HTTPException(status_code=404, detail="Examination not found")
    await record_audit_event(db, actor, "deleted", "exam", test_id, {"title": test["title"]})


@router.post("/api/admin/tests/{test_id}/questions/import")
async def import_questions(test_id: str, actor: ExamManagerUser, file: UploadFile = File(...)):
    extension = file.filename.rsplit(".", 1)[-1].lower() if file.filename else ""
    if extension not in {"csv", "xlsx"}:
        raise HTTPException(status_code=400, detail="Upload a .csv or .xlsx file")
    test = await get_database().tests.find_one({"_id": test_id})
    if not test:
        raise HTTPException(status_code=404, detail="Examination not found")
    contents = await file.read(10 * 1024 * 1024 + 1)
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Spreadsheet uploads must be 10 MB or smaller")
    try:
        frame = (pd.read_csv(io.BytesIO(contents)) if extension == "csv" else pd.read_excel(io.BytesIO(contents))).fillna("")
    except (UnicodeDecodeError, pd.errors.ParserError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="Could not read the uploaded spreadsheet") from exc
    frame.columns = [str(column).strip().lower() for column in frame.columns]
    required = {"text", "type", "correct_answer", "marks"}
    if not required.issubset(frame.columns):
        raise HTTPException(status_code=400, detail="CSV headers must include text,type,correct_answer,marks")
    if len(frame) > 149:
        raise HTTPException(status_code=413, detail="A question CSV can contain at most 149 rows")
    allowed = {"single", "multiple", "numerical", "reasoning"}
    allowed_difficulty = {"beginner", "intermediate", "advanced"}
    questions = []
    existing_texts = {
        " ".join(str(question.get("text", "")).split()).casefold()
        for question in test.get("questions", [])
    }
    for row_number, row in frame.iterrows():
        qtype = str(row["type"]).strip().lower()
        if qtype not in allowed or not str(row["text"]).strip():
            raise HTTPException(status_code=400, detail=f"Invalid question type or text on CSV row {row_number + 2}")
        normalized_text = " ".join(str(row["text"]).split()).casefold()
        if normalized_text in existing_texts:
            raise HTTPException(status_code=400, detail=f"Duplicate question text on CSV row {row_number + 2}")
        existing_texts.add(normalized_text)
        difficulty = str(row.get("difficulty", "")).strip().lower() or "intermediate"
        if difficulty not in allowed_difficulty:
            raise HTTPException(status_code=400, detail=f"Invalid difficulty on CSV row {row_number + 2}")
        options = [str(row.get(f"option_{i}", "")).strip() for i in range(1, 7)]
        options = [option for option in options if option]
        raw_correct = str(row["correct_answer"]).strip()
        correct = [item.strip() for item in raw_correct.split("|")] if qtype == "multiple" else raw_correct
        if qtype in {"single", "multiple", "reasoning"} and len(options) < 4:
            raise HTTPException(status_code=400, detail=f"At least four options are required on spreadsheet row {row_number + 2}")
        try:
            marks = float(row["marks"])
        except (TypeError, ValueError) as exc:
            raise HTTPException(status_code=400, detail=f"Invalid marks on CSV row {row_number + 2}") from exc
        if not np.isfinite(marks) or marks <= 0 or marks > 100:
            raise HTTPException(status_code=400, detail=f"Marks must be greater than 0 and at most 100 on CSV row {row_number + 2}")
        if not raw_correct or (isinstance(correct, list) and not set(correct).issubset(set(options))):
            raise HTTPException(status_code=400, detail=f"Correct answer is invalid on CSV row {row_number + 2}")
        if qtype in {"single", "reasoning"} and correct not in options:
            raise HTTPException(status_code=400, detail=f"Correct answer must match an option on CSV row {row_number + 2}")
        if qtype == "numerical":
            try:
                numeric_answer = float(correct)
            except ValueError as exc:
                raise HTTPException(status_code=400, detail=f"Numerical answer is invalid on CSV row {row_number + 2}") from exc
            if not np.isfinite(numeric_answer):
                raise HTTPException(status_code=400, detail=f"Numerical answer is invalid on CSV row {row_number + 2}")
        image_url = str(row.get("image_url", "")).strip() or None
        if image_url and not (
            image_url.startswith("https://")
            or re.fullmatch(r"/api/media/[0-9a-f-]{36}", image_url)
        ):
            raise HTTPException(status_code=400, detail=f"Image URLs must use HTTPS or a platform media URL on spreadsheet row {row_number + 2}")
        questions.append({
            "id": str(uuid.uuid4()), "text": str(row["text"]).strip(), "type": qtype,
            "category": str(row.get("category", "")).strip() or "Quantitative Aptitude",
            "section": str(row.get("section", "")).strip() or "General",
            "topic": str(row.get("topic", "")).strip(),
            "tags": [tag.strip() for tag in str(row.get("tags", "")).split(",") if tag.strip()],
            "difficulty": difficulty,
            "image_url": image_url,
            "math_expression": str(row.get("math_expression", "")).strip(),
            "options": options, "correct_answer": correct, "marks": marks,
            "explanation": str(row.get("explanation", "")).strip(),
        })
    if len(test.get("questions", [])) + len(questions) > 149:
        raise HTTPException(status_code=413, detail="An examination cannot contain more than 149 questions")
    result = await get_database().tests.update_one(
        {
            "_id": test_id,
            "$expr": {
                "$lte": [
                    {"$add": [{"$size": {"$ifNull": ["$questions", []]}}, len(questions)]},
                    149,
                ]
            },
        },
        {"$push": {"questions": {"$each": questions}}, "$set": {"updated_at": now_utc()}},
    )
    if not result.modified_count:
        raise HTTPException(status_code=409, detail="Question pool changed or reached the 149-question limit; reload and try again")
    await record_audit_event(get_database(), actor, "imported_questions", "exam", test_id, {"count": len(questions)})
    return {"imported": len(questions), "question_count": len(test.get("questions", [])) + len(questions)}
