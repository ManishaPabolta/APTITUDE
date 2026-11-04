import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from app.database import get_database
from app.middleware.role_guard import require_roles
from app.schemas import AnnouncementInput, SupportTicketInput, SupportTicketUpdate
from app.services.audit_service import record_audit_event
from app.services.notification_service import enqueue_notifications
from app.services.serializers import now_utc

router = APIRouter(prefix="/api")
CurrentUser = Annotated[
    dict,
    Depends(require_roles("admin", "teacher", "question_manager", "exam_manager", "student")),
]
AdminUser = Annotated[dict, Depends(require_roles("admin"))]
StaffUser = Annotated[dict, Depends(require_roles("admin", "teacher", "exam_manager"))]


def _audience_query(user: dict, current_time: datetime) -> dict:
    audience = ["all", "students"] if user["role"] == "student" else ["all", "staff"]
    return {
        "audience": {"$in": audience},
        "published_at": {"$lte": current_time},
        "$or": [{"expires_at": None}, {"expires_at": {"$gt": current_time}}],
    }


@router.get("/announcements")
async def list_announcements(user: CurrentUser):
    db = get_database()
    query = _audience_query(user, now_utc())
    items = await db.announcements.find(query, {"_id": 1, "title": 1, "body": 1, "audience": 1, "published_at": 1, "created_by_name": 1}).sort(
        "published_at", -1
    ).to_list(length=100)
    return items


@router.post("/admin/announcements", status_code=201)
async def create_announcement(payload: AnnouncementInput, actor: AdminUser):
    db = get_database()
    announcement = {
        "_id": str(uuid.uuid4()),
        **payload.model_dump(),
        "published_at": payload.published_at or now_utc(),
        "created_by": actor["_id"],
        "created_by_name": actor["name"],
        "created_at": now_utc(),
    }
    await db.announcements.insert_one(announcement)
    audience_roles = ["student"] if payload.audience == "students" else (
        ["admin", "superadmin", "teacher", "question_manager", "exam_manager"]
        if payload.audience == "staff"
        else ["student", "admin", "superadmin", "teacher", "question_manager", "exam_manager"]
    )
    recipients = await db.users.find(
        {"active": True, "role": {"$in": audience_roles}}, {"_id": 1, "email": 1}
    ).to_list(length=5000)
    if recipients and announcement["published_at"] <= now_utc():
        await enqueue_notifications(
            db,
            recipients,
            title=f"Announcement: {payload.title}",
            body=payload.body[:500],
            link="/communications",
        )
    await record_audit_event(db, actor, "created", "announcement", announcement["_id"], {"title": payload.title})
    return {key: value for key, value in announcement.items() if key != "created_by"}


@router.get("/admin/announcements")
async def admin_announcements(_: AdminUser, offset: int = Query(default=0, ge=0), limit: int = Query(default=25, ge=1, le=100)):
    db = get_database()
    collection = db.announcements
    total = await collection.count_documents({})
    items = await collection.find().sort("created_at", -1).skip(offset).limit(limit).to_list(length=limit)
    return {"items": items, "total": total, "offset": offset, "limit": limit}


@router.delete("/admin/announcements/{announcement_id}", status_code=204)
async def delete_announcement(announcement_id: str, actor: AdminUser):
    db = get_database()
    result = await db.announcements.delete_one({"_id": announcement_id})
    if not result.deleted_count:
        raise HTTPException(status_code=404, detail="Announcement not found")
    await record_audit_event(db, actor, "deleted", "announcement", announcement_id)


@router.post("/support/tickets", status_code=201)
async def create_support_ticket(payload: SupportTicketInput, actor: CurrentUser):
    db = get_database()
    ticket = {
        "_id": str(uuid.uuid4()),
        **payload.model_dump(),
        "user_id": actor["_id"],
        "user_name": actor["name"],
        "user_email": actor["email"],
        "status": "open",
        "response": None,
        "created_at": now_utc(),
        "updated_at": now_utc(),
    }
    await db.support_tickets.insert_one(ticket)
    admins = await db.users.find(
        {"active": True, "role": {"$in": ["admin", "superadmin", "exam_manager"]}},
        {"_id": 1, "email": 1},
    ).to_list(length=500)
    if admins:
        await enqueue_notifications(
            db, admins, title="New support request",
            body=f"{actor['name']}: {payload.subject}", link="/communications",
        )
    return ticket


@router.get("/support/tickets")
async def list_support_tickets(
    actor: CurrentUser,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=25, ge=1, le=100),
    status: str | None = None,
):
    db = get_database()
    query = {} if actor["role"] in {"admin", "superadmin", "exam_manager"} else {"user_id": actor["_id"]}
    if status in {"open", "in_progress", "resolved", "closed"}:
        query["status"] = status
    collection = db.support_tickets
    total = await collection.count_documents(query)
    items = await collection.find(query).sort("created_at", -1).skip(offset).limit(limit).to_list(length=limit)
    return {"items": items, "total": total, "offset": offset, "limit": limit}


@router.patch("/admin/support/tickets/{ticket_id}")
async def update_support_ticket(ticket_id: str, payload: SupportTicketUpdate, actor: StaffUser):
    db = get_database()
    changes = {**payload.model_dump(), "updated_at": now_utc(), "updated_by": actor["_id"]}
    result = await db.support_tickets.update_one({"_id": ticket_id}, {"$set": changes})
    if not result.matched_count:
        raise HTTPException(status_code=404, detail="Support request not found")
    ticket = await db.support_tickets.find_one({"_id": ticket_id})
    await db.notifications.insert_one({
        "_id": str(uuid.uuid4()),
        "user_id": ticket["user_id"],
        "title": "Support request updated",
        "body": f"{ticket['subject']}: {payload.status.replace('_', ' ')}",
        "link": "/communications",
        "created_at": now_utc(),
        "read_at": None,
    })
    return ticket
