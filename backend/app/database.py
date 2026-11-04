from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.config import settings

client: AsyncIOMotorClient | None = None
database: AsyncIOMotorDatabase | None = None


async def connect_database() -> None:
    global client, database
    client = AsyncIOMotorClient(settings.mongodb_url, serverSelectionTimeoutMS=5000, tz_aware=True)
    await client.admin.command("ping")
    database = client[settings.database_name]
    await database.users.update_many(
        {"role": "superadmin", "email": {"$ne": settings.admin_email.lower()}},
        {"$set": {"role": "admin"}},
    )
    await database.users.create_index("email", unique=True)
    await database.users.create_index(
        "role",
        unique=True,
        partialFilterExpression={"role": "superadmin"},
        name="one_superadmin",
    )
    await database.catalog.create_index([("kind", 1), ("name_key", 1)], unique=True)
    await database.tests.create_index("created_at")
    session_indexes = await database.exam_sessions.index_information()
    for index_name in ("student_id_1_test_id_1",):
        if index_name in session_indexes:
            await database.exam_sessions.drop_index(index_name)
    await database.exam_sessions.create_index(
        "student_id",
        unique=True,
        partialFilterExpression={"submitted": False},
        name="one_active_session_per_student",
    )
    result_indexes = await database.results.index_information()
    if "student_id_1_test_id_1" in result_indexes:
        await database.results.drop_index("student_id_1_test_id_1")
    await database.exam_sessions.update_many(
        {"attempt_number": {"$exists": False}},
        {"$set": {"attempt_number": 1}},
    )
    await database.results.update_many(
        {"attempt_number": {"$exists": False}},
        {"$set": {"attempt_number": 1}},
    )
    await database.exam_sessions.create_index(
        [("student_id", 1), ("test_id", 1), ("attempt_number", 1)],
        unique=True,
        name="unique_session_attempt",
    )
    await database.results.create_index(
        [("student_id", 1), ("test_id", 1), ("attempt_number", 1)],
        unique=True,
        name="unique_result_attempt",
    )
    await database.activity_logs.create_index("timestamp")
    await database.audit_logs.create_index("timestamp")
    await database.notifications.create_index([("user_id", 1), ("created_at", -1)])
    await database.notifications.create_index([("email_status", 1), ("created_at", 1)])
    await database.announcements.create_index([("published_at", -1)])
    await database.support_tickets.create_index([("user_id", 1), ("created_at", -1)])
    await database.support_tickets.create_index([("status", 1), ("created_at", -1)])
    await database.ai_question_drafts.create_index([("created_by", 1), ("created_at", -1)])
    await database.question_bank.create_index([("category", 1), ("difficulty", 1)])


async def close_database() -> None:
    if client:
        client.close()


def get_database() -> AsyncIOMotorDatabase:
    if database is None:
        raise RuntimeError("Database is not connected")
    return database
