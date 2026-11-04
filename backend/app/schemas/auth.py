from typing import Literal

from pydantic import BaseModel, EmailStr, Field, model_validator


class UserCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: Literal["student", "teacher", "admin", "question_manager", "exam_manager"] = "student"
    batch: str | None = None
    course: str | None = None


class UserUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    active: bool | None = None
    batch: str | None = None
    course: str | None = None
    role: Literal["student", "teacher", "admin", "question_manager", "exam_manager"] | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ProfileUpdate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    batch: str | None = Field(default=None, max_length=100)
    course: str | None = Field(default=None, max_length=150)
    current_password: str | None = None
    new_password: str | None = Field(default=None, min_length=8, max_length=128)

    @model_validator(mode="after")
    def require_current_password(self):
        if self.new_password and not self.current_password:
            raise ValueError("Current password is required to change your password")
        return self


class CatalogItemInput(BaseModel):
    name: str = Field(min_length=2, max_length=120)
