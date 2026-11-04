from fastapi import Depends, HTTPException

from app.security import get_current_user


def role_has_access(role: str | None, allowed_roles: tuple[str, ...]) -> bool:
    return role in allowed_roles or (role == "superadmin" and "admin" in allowed_roles)


def ensure_user_management_access(actor_role: str, target_role: str) -> None:
    if actor_role != "superadmin" and target_role != "student":
        raise HTTPException(
            status_code=403,
            detail="Only the superadmin can view or manage non-student accounts",
        )


def require_roles(*roles: str):
    async def role_guard(user=Depends(get_current_user)):
        if not role_has_access(user.get("role"), roles):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user

    return role_guard
