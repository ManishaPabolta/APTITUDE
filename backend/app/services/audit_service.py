import uuid

from app.services.serializers import now_utc


async def record_audit_event(
    db,
    actor: dict,
    action: str,
    resource_type: str,
    resource_id: str | None = None,
    details: dict | None = None,
) -> None:
    await db.audit_logs.insert_one({
        "_id": str(uuid.uuid4()),
        "actor_id": actor["_id"],
        "actor_name": actor.get("name", ""),
        "actor_role": actor.get("role", ""),
        "action": action,
        "resource_type": resource_type,
        "resource_id": resource_id,
        "details": details or {},
        "timestamp": now_utc(),
    })
