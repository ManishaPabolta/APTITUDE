from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class UserDocument(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    name: str
    email: str
    password_hash: str
    role: Literal["superadmin", "admin", "question_manager", "exam_manager", "teacher", "student"]
    active: bool = True
    batch: str | None = None
    course: str | None = None
    created_at: datetime


class QuestionDocument(BaseModel):
    model_config = ConfigDict(extra="allow")
    id: str
    text: str
    type: Literal["single", "multiple", "numerical", "reasoning"]
    category: str
    difficulty: Literal["beginner", "intermediate", "advanced"]
    options: list[str] = Field(default_factory=list)
    correct_answer: str | list[str]
    marks: float
    explanation: str = ""


class ExamSessionDocument(BaseModel):
    model_config = ConfigDict(extra="allow")
    id: str
    student_id: str
    test_id: str
    questions: list[dict[str, Any]]
    answers: dict[str, Any] = Field(default_factory=dict)
    started_at: datetime
    expires_at: datetime
    submitted: bool = False
