from fastapi import APIRouter, Depends, HTTPException, Query

from app.database import get_database
from app.security import get_current_user
from app.services.serializers import now_utc

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])
CurrentUser = Depends(get_current_user)


@router.get("")
async def list_notifications(
    limit: int = Query(default=30, ge=1, le=100),
    actor: dict = CurrentUser,
):
    db = get_database()
    items = await db.notifications.find(
        {"user_id": actor["_id"]},
        {"email_to": 0, "email_subject": 0, "email_body": 0, "email_retry_at": 0},
    ).sort("created_at", -1).to_list(length=limit)
    unread_count = await db.notifications.count_documents({"user_id": actor["_id"], "read_at": None})
    return {"items": items, "unread_count": unread_count}


@router.patch("/{notification_id}/read")
async def mark_notification_read(notification_id: str, actor: dict = CurrentUser):
    result = await get_database().notifications.update_one(
        {"_id": notification_id, "user_id": actor["_id"]},
        {"$set": {"read_at": now_utc()}},
    )
    if not result.matched_count:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"read": True}


@router.post("/read-all")
async def mark_all_notifications_read(actor: dict = CurrentUser):
    result = await get_database().notifications.update_many(
        {"user_id": actor["_id"], "read_at": None},
        {"$set": {"read_at": now_utc()}},
    )
    return {"updated": result.modified_count}
