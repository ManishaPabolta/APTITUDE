import asyncio
import uuid

from pymongo.errors import DuplicateKeyError

from app.config import settings
from app.database import close_database, connect_database, get_database
from app.security import hash_password
from app.services.serializers import now_utc


async def reset_superadmin_password() -> None:
    await connect_database()
    try:
        db = get_database()
        email = settings.admin_email.lower()
        result = await db.users.update_one(
            {"email": email},
            {
                "$set": {
                    "role": "superadmin",
                    "active": True,
                    "password_hash": hash_password(settings.admin_password),
                },
                "$setOnInsert": {
                    "_id": str(uuid.uuid4()),
                    "name": "Platform Administrator",
                    "email": email,
                    "created_at": now_utc(),
                },
            },
            upsert=True,
        )
        if result.upserted_id:
            print("Created the configured superadmin account and set its password.")
        else:
            print("Reset the configured superadmin account password.")
    except DuplicateKeyError as exc:
        raise RuntimeError(
            "Could not promote the configured account because another superadmin exists. "
            "Resolve the duplicate superadmin account first."
        ) from exc
    finally:
        await close_database()


if __name__ == "__main__":
    asyncio.run(reset_superadmin_password())
