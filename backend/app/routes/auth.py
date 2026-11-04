import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pymongo.errors import DuplicateKeyError

from app.config import settings
from app.database import get_database
from app.schemas import LoginRequest, ProfileUpdate, UserCreate
from app.security import create_access_token, get_current_user, hash_password, verify_password
from app.services.serializers import now_utc, public_user

router = APIRouter(tags=["Authentication"])


@router.post("/api/auth/register", status_code=status.HTTP_201_CREATED)
async def register(payload: UserCreate):
    if payload.role != "student":
        raise HTTPException(status_code=403, detail="Only student accounts can be self-registered")
    user = {
        "_id": str(uuid.uuid4()),
        "name": payload.name.strip(),
        "email": payload.email.lower(),
        "password_hash": hash_password(payload.password),
        "role": "student",
        "batch": None,
        "course": None,
        "active": True,
        "created_at": now_utc(),
    }
    try:
        await get_database().users.insert_one(user)
    except DuplicateKeyError as exc:
        raise HTTPException(status_code=409, detail="An account with this email already exists") from exc
    return {
        "access_token": create_access_token(user["_id"], user["role"]),
        "token_type": "bearer",
        "user": public_user(user),
    }


@router.post("/api/auth/login")
async def login(payload: LoginRequest):
    user = await get_database().users.find_one({"email": payload.email.lower(), "active": True})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    return {
        "access_token": create_access_token(user["_id"], user["role"]),
        "token_type": "bearer",
        "user": public_user(user),
    }


@router.get("/api/auth/me")
async def me(user=Depends(get_current_user)):
    return public_user(user)


@router.patch("/api/profile")
async def update_profile(payload: ProfileUpdate, user=Depends(get_current_user)):
    changes = {"name": payload.name.strip()}
    if payload.new_password:
        db_user = await get_database().users.find_one({"_id": user["_id"]})
        if not db_user or not verify_password(payload.current_password, db_user["password_hash"]):
            raise HTTPException(status_code=400, detail="Current password is incorrect")
        changes["password_hash"] = hash_password(payload.new_password)
    await get_database().users.update_one({"_id": user["_id"], "active": True}, {"$set": changes})
    return public_user(await get_database().users.find_one({"_id": user["_id"]}))
