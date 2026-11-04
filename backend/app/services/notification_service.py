import asyncio
import logging
import smtplib
import ssl
import uuid
from datetime import timedelta
from email.message import EmailMessage

from app.config import settings
from app.services.serializers import now_utc

logger = logging.getLogger(__name__)


def _send_email(recipient: str, subject: str, body: str) -> None:
    if not settings.mail_host or not settings.mail_from:
        raise RuntimeError("Email delivery requires MAIL_HOST and MAIL_FROM")
    message = EmailMessage()
    message["From"] = settings.mail_from
    message["To"] = recipient
    message["Subject"] = subject
    message.set_content(body)
    if settings.mail_use_ssl:
        with smtplib.SMTP_SSL(
            settings.mail_host,
            settings.mail_port,
            timeout=15,
            context=ssl.create_default_context(),
        ) as server:
            if settings.mail_username:
                server.login(settings.mail_username, settings.mail_password)
            server.send_message(message)
        return
    with smtplib.SMTP(settings.mail_host, settings.mail_port, timeout=15) as server:
        if settings.mail_use_tls:
            server.starttls(context=ssl.create_default_context())
        if settings.mail_username:
            server.login(settings.mail_username, settings.mail_password)
        server.send_message(message)


async def enqueue_notifications(
    db,
    recipients: list[dict],
    *,
    title: str,
    body: str,
    link: str = "/",
    email_subject: str | None = None,
) -> int:
    notifications = [
        {
            "_id": str(uuid.uuid4()),
            "user_id": recipient["_id"],
            "title": title,
            "body": body,
            "link": link,
            "read_at": None,
            "created_at": now_utc(),
            "email_to": recipient.get("email", ""),
            "email_subject": email_subject or title,
            "email_body": body,
            "email_status": "queued" if settings.mail_host and settings.mail_from and recipient.get("email") else "not_configured",
            "email_attempts": 0,
        }
        for recipient in recipients
    ]
    if notifications:
        await db.notifications.insert_many(notifications)
    return len(notifications)


async def notify_test_assignees(db, test: dict) -> int:
    query = {"role": "student", "active": True}
    if test.get("student_ids"):
        query["_id"] = {"$in": test["student_ids"]}
    elif test.get("batch"):
        query["batch"] = test["batch"]
    cursor = db.users.find(query, {"_id": 1, "email": 1})
    count = 0
    batch = []
    async for user in cursor:
        batch.append(user)
        if len(batch) == 200:
            count += await enqueue_notifications(
                db,
                batch,
                title="New examination available",
                body=f"{test['title']} is available. Review its schedule in your examination dashboard.",
                link="/",
                email_subject=f"New examination: {test['title']}",
            )
            batch = []
    if batch:
        count += await enqueue_notifications(
            db,
            batch,
            title="New examination available",
            body=f"{test['title']} is available. Review its schedule in your examination dashboard.",
            link="/",
            email_subject=f"New examination: {test['title']}",
        )
    return count


async def process_email_queue(db) -> None:
    if not settings.mail_host or not settings.mail_from:
        return
    now = now_utc()
    await db.notifications.update_many(
        {"email_status": "sending", "email_started_at": {"$lte": now - timedelta(minutes=5)}},
        {"$set": {"email_status": "queued"}, "$unset": {"email_started_at": ""}},
    )
    cursor = db.notifications.find({
        "email_status": "queued",
        "email_attempts": {"$lt": 3},
        "$or": [{"email_retry_at": {"$exists": False}}, {"email_retry_at": {"$lte": now}}],
    }).sort("created_at", 1).limit(20)
    async for notification in cursor:
        claim = await db.notifications.update_one(
            {"_id": notification["_id"], "email_status": "queued"},
            {"$set": {"email_status": "sending", "email_started_at": now}, "$inc": {"email_attempts": 1}},
        )
        if not claim.modified_count:
            continue
        try:
            await asyncio.to_thread(
                _send_email,
                notification["email_to"],
                notification["email_subject"],
                notification["email_body"],
            )
        except (OSError, smtplib.SMTPException, RuntimeError):
            logger.warning("Notification email delivery failed for notification %s", notification["_id"])
            attempts = int(notification.get("email_attempts", 0)) + 1
            await db.notifications.update_one(
                {"_id": notification["_id"], "email_status": "sending"},
                {
                    "$set": {
                        "email_status": "failed" if attempts >= 3 else "queued",
                        "email_retry_at": now_utc() + timedelta(minutes=1),
                    },
                    "$unset": {"email_started_at": ""},
                },
            )
        else:
            await db.notifications.update_one(
                {"_id": notification["_id"], "email_status": "sending"},
                {
                    "$set": {"email_status": "sent", "email_sent_at": now_utc()},
                    "$unset": {"email_retry_at": "", "email_started_at": ""},
                },
            )
