from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pwdlib import PasswordHash

from app.config import settings
from app.database import get_database

ALGORITHM = "HS256"
password_hash = PasswordHash.recommended()
bearer_scheme = HTTPBearer(auto_error=True)


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(password: str, hashed_password: str) -> bool:
    return password_hash.verify(password, hashed_password)


def create_access_token(user_id: str, role: str) -> str:
    expires = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    return jwt.encode({"sub": user_id, "role": role, "exp": expires}, settings.jwt_secret, algorithm=ALGORITHM)


async def get_current_user(credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)]):
    token = credentials.credentials
    unauthorized = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise unauthorized
    except JWTError as exc:
        raise unauthorized from exc
    user = await get_database().users.find_one({"_id": user_id, "active": True})
    if not user:
        raise unauthorized
    user.pop("password_hash", None)
    return user
