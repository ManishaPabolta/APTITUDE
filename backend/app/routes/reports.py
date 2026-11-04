import io
import re
from datetime import datetime
from typing import Annotated

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse

from app.database import get_database
from app.middleware.role_guard import require_roles
from app.services.serializers import now_utc

router = APIRouter()
CurrentUser = Annotated[dict, Depends(require_roles("admin", "teacher", "question_manager", "exam_manager", "student"))]
AdminUser = Annotated[dict, Depends(require_roles("admin"))]
TeacherUser = Annotated[dict, Depends(require_roles("admin", "teacher", "exam_manager"))]
ExamManagerUser = Annotated[dict, Depends(require_roles("admin", "teacher", "exam_manager"))]


def _student_can_access_leaderboard(test: dict, student: dict) -> bool:
    assigned_students = test.get("student_ids", [])
    assigned_batch = test.get("batch")
    return (
        not assigned_students and not assigned_batch
    ) or student["_id"] in assigned_students or (
        bool(assigned_batch) and assigned_batch == student.get("batch")
    )


@router.get("/api/admin/analytics")
async def analytics(_: ExamManagerUser, test_id: str | None = None):
    db = get_database()
    query = {"test_id": test_id} if test_id else {}
    results = await db.results.find(
        query,
        {"percentage": 1, "test_title": 1, "passed": 1, "submitted_at": 1, "student_id": 1, "student_name": 1},
    ).to_list(length=10000)
    if not results:
        return {"score_distribution": [], "test_performance": [], "monthly_submissions": [], "student_performance": []}
    frame = pd.DataFrame(results)
    frame["percentage"] = pd.to_numeric(frame["percentage"], errors="coerce").fillna(0)
    bins = [0, 20, 40, 60, 80, 100.01]
    labels = ["0-20", "21-40", "41-60", "61-80", "81-100"]
    frame["range"] = pd.cut(frame["percentage"], bins=bins, labels=labels, include_lowest=True)
    distribution = frame.groupby("range", observed=False).size().reindex(labels, fill_value=0)
    by_test = frame.groupby("test_title").agg(avg=("percentage", "mean"), attempts=("percentage", "count")).reset_index()
    frame["submitted_at"] = pd.to_datetime(frame["submitted_at"], utc=True)
    frame["month"] = frame["submitted_at"].dt.strftime("%b %Y")
    monthly = frame.sort_values("submitted_at").groupby("month").size().tail(6)
    by_student = frame.groupby(["student_id", "student_name"]).agg(
        average=("percentage", "mean"),
        attempts=("percentage", "count"),
        pass_rate=("passed", "mean"),
    ).reset_index().sort_values(["average", "attempts"], ascending=[False, False]).head(20)
    return {
        "score_distribution": [{"range": key, "count": int(value)} for key, value in distribution.items()],
        "test_performance": [{"test": row.test_title, "average": round(float(row.avg), 1), "attempts": int(row.attempts)} for row in by_test.itertuples(index=False)],
        "monthly_submissions": [{"month": key, "count": int(value)} for key, value in monthly.items()],
        "student_performance": [
            {
                "student_id": row.student_id,
                "student": row.student_name,
                "average": round(float(row.average), 1),
                "attempts": int(row.attempts),
                "pass_rate": round(float(row.pass_rate) * 100, 1),
            }
            for row in by_student.itertuples(index=False)
        ],
    }


@router.get("/api/admin/results/export")
async def export_results(_: TeacherUser, format: str = "csv"):
    results = await get_database().results.find({}, {"answers": 0}).sort("submitted_at", -1).to_list(length=10000)
    frame = pd.DataFrame([{key: str(value) if isinstance(value, datetime) else value for key, value in result.items() if key != "_id"} for result in results])
    if format == "xlsx":
        output = io.BytesIO()
        frame.to_excel(output, index=False)
        output.seek(0)
        return StreamingResponse(output, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                                 headers={"Content-Disposition": "attachment; filename=examination-results.xlsx"})
    if format != "csv":
        raise HTTPException(status_code=400, detail="format must be csv or xlsx")
    output = io.StringIO()
    frame.to_csv(output, index=False)
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": "attachment; filename=examination-results.csv"})


@router.get("/api/admin/results")
async def list_results(
    _: TeacherUser,
    test_id: str | None = None,
    student_id: str | None = None,
    search: str | None = Query(default=None, max_length=160),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=25, ge=1, le=100),
):
    query = {"test_id": test_id} if test_id else {}
    if student_id:
        query["student_id"] = student_id
    if search and search.strip():
        term = re.escape(search.strip())
        query["$or"] = [
            {"student_name": {"$regex": term, "$options": "i"}},
            {"test_title": {"$regex": term, "$options": "i"}},
        ]
    collection = get_database().results
    total = await collection.count_documents(query)
    results = await collection.find(query, {"answers": 0}).sort("submitted_at", -1).skip(offset).limit(limit).to_list(length=limit)
    return {"items": results, "total": total, "offset": offset, "limit": limit}


@router.get("/api/admin/activity-logs")
async def activity_logs(_: TeacherUser, test_id: str | None = None, limit: int = 100):
    query = {"test_id": test_id} if test_id else {}
    bounded_limit = max(1, min(limit, 500))
    return await get_database().activity_logs.find(query).sort("timestamp", -1).to_list(length=bounded_limit)


@router.get("/api/admin/students/{student_id}/performance")
async def student_performance(student_id: str, _: ExamManagerUser):
    results = await get_database().results.find(
        {"student_id": student_id},
        {"answers": 0},
    ).sort("submitted_at", -1).to_list(length=500)
    if not results:
        return {"student_id": student_id, "attempts": 0, "average_percentage": 0, "pass_rate": 0, "results": []}
    frame = pd.DataFrame(results)
    percentages = pd.to_numeric(frame["percentage"], errors="coerce").fillna(0)
    return {
        "student_id": student_id,
        "attempts": len(results),
        "average_percentage": round(float(percentages.mean()), 1),
        "pass_rate": round(float(frame["passed"].fillna(False).mean()) * 100, 1),
        "results": results,
    }


@router.get("/api/leaderboard")
async def leaderboard(user: CurrentUser, test_id: str | None = None):
    query = {"test_id": test_id} if test_id else {}
    if user["role"] == "student":
        if not test_id:
            raise HTTPException(status_code=400, detail="Choose an examination to view its leaderboard")
        test = await get_database().tests.find_one({"_id": test_id, "published": True})
        if not test or not _student_can_access_leaderboard(test, user):
            raise HTTPException(status_code=404, detail="Examination not found")
        visibility = test.get("result_visibility", "immediate")
        if visibility == "hidden":
            raise HTTPException(status_code=403, detail="This examination's results are private")
        if visibility == "after_close":
            closes_at = test.get("closes_at")
            if not closes_at:
                raise HTTPException(status_code=403, detail="Leaderboard results are not available yet")
            if isinstance(closes_at, str):
                closes_at = datetime.fromisoformat(closes_at.replace("Z", "+00:00"))
            if closes_at.tzinfo is None:
                closes_at = closes_at.replace(tzinfo=now_utc().tzinfo)
            if closes_at > now_utc():
                raise HTTPException(status_code=403, detail="Leaderboard results are not available yet")
    results = await get_database().results.find(
        query,
        {
            "_id": 1,
            "test_id": 1,
            "test_title": 1,
            "student_name": 1,
            "percentage": 1,
            "score": 1,
            "total_marks": 1,
        },
    ).sort([("percentage", -1), ("submitted_at", 1)]).to_list(length=100)
    return [{"rank": index + 1, **result} for index, result in enumerate(results)]
