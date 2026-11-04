import asyncio
import logging
import uuid
from contextlib import asynccontextmanager
from datetime import timedelta

from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pymongo.errors import PyMongoError

from app.config import settings
from app.database import close_database, connect_database, get_database
from app.security import hash_password
from app.services.exam_service import finish_exam
from app.services.serializers import now_utc

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    await connect_database()
    db = get_database()
    superadmin_email = settings.admin_email.lower()
    existing_superadmin = await db.users.find_one({"email": superadmin_email})
    if existing_superadmin:
        await db.users.update_one(
            {"_id": existing_superadmin["_id"]},
            {"$set": {"role": "superadmin", "active": True}},
        )
    else:
        await db.users.insert_one({
            "_id": str(uuid.uuid4()),
            "name": "Platform Administrator",
            "email": superadmin_email,
            "password_hash": hash_password(settings.admin_password),
            "role": "superadmin",
            "active": True,
            "created_at": now_utc(),
        })
    timer_task = asyncio.create_task(expired_session_worker())
    notification_task = asyncio.create_task(notification_email_worker())
    try:
        yield
    finally:
        timer_task.cancel()
        notification_task.cancel()
        try:
            await timer_task
        except asyncio.CancelledError:
            pass
        try:
            await notification_task
        except asyncio.CancelledError:
            pass
        await close_database()


async def expired_session_worker() -> None:
    while True:
        try:
            db = get_database()
            stale_cutoff = now_utc() - timedelta(minutes=2)
            stale_cursor = db.exam_sessions.find({
                "submitted": True,
                "submitting": True,
                "submission_started_at": {"$lte": stale_cutoff},
            })
            async for session in stale_cursor:
                existing = await db.results.find_one({
                    "student_id": session["student_id"],
                    "test_id": session["test_id"],
                    "attempt_number": session.get("attempt_number", 1),
                })
                if existing:
                    await db.exam_sessions.update_one(
                        {"_id": session["_id"]},
                        {"$set": {"result_id": existing["_id"]}, "$unset": {"submitting": "", "submission_started_at": ""}},
                    )
                else:
                    await db.exam_sessions.update_one(
                        {"_id": session["_id"], "submitting": True},
                        {"$set": {"submitted": False}, "$unset": {"submitting": "", "submission_started_at": ""}},
                    )
                    refreshed = await db.exam_sessions.find_one({"_id": session["_id"], "submitted": False})
                    if refreshed:
                        await finish_exam(db, refreshed, "time_expired")
            cursor = db.exam_sessions.find({"submitted": False, "expires_at": {"$lte": now_utc()}})
            async for session in cursor:
                try:
                    await finish_exam(db, session, "time_expired")
                except HTTPException as exc:
                    if exc.status_code != 409:
                        logger.error("Could not finalize expired exam session %s: %s", session["_id"], exc.detail)
                except PyMongoError:
                    logger.exception("Database error finalizing expired exam session %s", session["_id"])
        except PyMongoError:
            logger.exception("Could not scan for expired exam sessions")
        await asyncio.sleep(2)


async def notification_email_worker() -> None:
    while True:
        try:
            await process_email_queue(get_database())
        except PyMongoError:
            logger.exception("Could not process notification email queue")
        await asyncio.sleep(10)


app = FastAPI(title="Aptitude Exam Platform API", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.routes.admin import router as admin_router
from app.routes.ai_questions import router as ai_questions_router
from app.routes.auth import router as auth_router
from app.routes.catalog import router as catalog_router
from app.routes.communications import router as communications_router
from app.routes.media import router as media_router
from app.routes.question_bank import router as question_bank_router
from app.routes.reports import router as reports_router
from app.routes.student import router as student_router
from app.routes.notifications import router as notifications_router
from app.services.notification_service import process_email_queue

app.include_router(admin_router)
app.include_router(ai_questions_router)
app.include_router(auth_router)
app.include_router(catalog_router)
app.include_router(communications_router)
app.include_router(media_router)
app.include_router(question_bank_router)
app.include_router(reports_router)
app.include_router(student_router)
app.include_router(notifications_router)


@app.get("/", include_in_schema=False)
async def root():
    return {
        "name": "Aptitude Exam Platform API",
        "status": "ok",
        "docs": "/docs",
        "health": "/api/health",
    }


@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    return Response(status_code=204)


@app.get("/api/health")
async def health():
    await get_database().command("ping")
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
