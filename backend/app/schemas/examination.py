from datetime import datetime
import re
from typing import Literal

from pydantic import BaseModel, Field, model_validator


class QuestionInput(BaseModel):
    id: str | None = None
    bank_question_id: str | None = None
    text: str = Field(min_length=1, max_length=5000)
    type: Literal["single", "multiple", "numerical", "reasoning"] = "single"
    category: str = "Quantitative Aptitude"
    section: str = Field(default="General", min_length=1, max_length=120)
    topic: str = Field(default="", max_length=120)
    tags: list[str] = Field(default_factory=list, max_length=10)
    difficulty: Literal["beginner", "intermediate", "advanced"] = "intermediate"
    image_url: str | None = Field(default=None, max_length=2048)
    math_expression: str = Field(default="", max_length=1000)
    options: list[str] = Field(default_factory=list)
    correct_answer: str | list[str]
    marks: float = Field(default=1, gt=0, le=100)
    explanation: str = ""

    @model_validator(mode="after")
    def validate_options(self):
        self.section = self.section.strip()
        if not self.section:
            raise ValueError("Question section must not be empty")
        self.options = [option.strip() for option in self.options]
        if self.type in ("single", "multiple", "reasoning") and len(self.options) < 4:
            raise ValueError("Choice questions need at least four options")
        if any(not option for option in self.options) or len(set(self.options)) != len(self.options):
            raise ValueError("Options must be non-empty and unique")
        self.tags = list(dict.fromkeys(tag.strip() for tag in self.tags if tag.strip()))
        if self.image_url and not (
            self.image_url.startswith("https://")
            or re.fullmatch(r"/api/media/[0-9a-f-]{36}", self.image_url)
        ):
            raise ValueError("Question images must use HTTPS or a platform media URL")
        if self.type == "multiple" and not isinstance(self.correct_answer, list):
            raise ValueError("Multiple-answer questions require a list of correct answers")
        if self.type == "multiple":
            if not self.correct_answer or not set(self.correct_answer).issubset(set(self.options)):
                raise ValueError("Correct answers must match one or more options")
        elif self.type in ("single", "reasoning") and self.correct_answer not in self.options:
            raise ValueError("The correct answer must match one of the options")
        elif self.type == "numerical":
            try:
                from math import isfinite

                if not isfinite(float(self.correct_answer)):
                    raise ValueError("Numerical answer must be a finite number")
            except (TypeError, ValueError) as exc:
                raise ValueError("Numerical answer must be a finite number") from exc
        return self


class TestInput(BaseModel):
    title: str = Field(min_length=3, max_length=180)
    description: str = ""
    instructions: str = Field(default="", max_length=5000)
    duration_minutes: int = Field(gt=0, le=600)
    section_time_limits: dict[str, int] = Field(default_factory=dict)
    questions_per_attempt: int | None = Field(default=None, gt=0, le=149)
    randomize_questions: bool = True
    randomize_options: bool = True
    negative_marks: float = Field(default=0, ge=0, le=100)
    passing_percentage: float = Field(default=40, ge=0, le=100)
    access_code: str | None = Field(default=None, min_length=4, max_length=64)
    clear_access_code: bool = False
    allowed_attempts: int = Field(default=1, ge=1, le=10)
    result_visibility: Literal["immediate", "after_close", "hidden"] = "immediate"
    show_explanations: bool = True
    violation_limit: int = Field(default=1, ge=1, le=20)
    immediate_submit_events: list[
        Literal["tab_switch", "window_blur", "visibility_change", "fullscreen_exit", "copy", "paste", "cut", "context_menu"]
    ] = Field(default_factory=lambda: ["tab_switch", "visibility_change", "fullscreen_exit", "window_blur"])
    scheduled_at: str | None = None
    closes_at: str | None = None
    student_ids: list[str] = Field(default_factory=list)
    batch: str | None = None
    published: bool = False
    questions: list[QuestionInput] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_schedule(self):
        if self.scheduled_at and self.closes_at:
            opens = datetime.fromisoformat(self.scheduled_at.replace("Z", "+00:00"))
            closes = datetime.fromisoformat(self.closes_at.replace("Z", "+00:00"))
            if closes <= opens:
                raise ValueError("Closing time must be after the opening time")
        if self.result_visibility == "after_close" and not self.closes_at:
            raise ValueError("A closing time is required when results are visible after the exam closes")
        if len(self.questions) > 149:
            raise ValueError("An examination cannot contain more than 149 questions")
        normalized_questions = [
            re.sub(r"\s+", " ", question.text).strip().casefold()
            for question in self.questions
        ]
        if len(normalized_questions) != len(set(normalized_questions)):
            raise ValueError("An examination cannot contain duplicate question text")
        if self.questions_per_attempt is not None and self.questions_per_attempt > len(self.questions):
            raise ValueError("Questions per attempt cannot exceed the question pool size")
        if len(set(self.student_ids)) != len(self.student_ids):
            raise ValueError("Student assignments must not contain duplicate IDs")
        if self.section_time_limits:
            normalized_limits: dict[str, int] = {}
            for name, minutes in self.section_time_limits.items():
                normalized = name.strip()
                if normalized in normalized_limits:
                    raise ValueError("Section names must be unique after trimming whitespace")
                normalized_limits[normalized] = minutes
            if any(not name or minutes < 1 or minutes > self.duration_minutes for name, minutes in normalized_limits.items()):
                raise ValueError("Each section time limit must be between 1 and the exam duration")
            question_sections = {question.section.strip() for question in self.questions}
            if set(normalized_limits) != question_sections:
                raise ValueError("Section time limits must match every section used by exam questions")
            if sum(normalized_limits.values()) > self.duration_minutes:
                raise ValueError("The sum of section time limits cannot exceed the exam duration")
            self.section_time_limits = normalized_limits
        return self


class AnswerInput(BaseModel):
    answer: str | list[str] | None = None
    marked_for_review: bool = False


class ActivityInput(BaseModel):
    event_type: Literal["tab_switch", "window_blur", "visibility_change", "fullscreen_exit", "copy", "paste", "cut", "context_menu"]
    details: str = ""


class AccessCodeInput(BaseModel):
    access_code: str = Field(min_length=1, max_length=64)


class AIQuestionRequest(BaseModel):
    category: Literal[
        "Quantitative Aptitude", "Logical Reasoning", "Verbal Ability",
        "Data Interpretation", "Probability", "Number Series", "Puzzles",
    ]
    difficulty: Literal["beginner", "intermediate", "advanced"]
    count: int = Field(ge=1, le=149)
    topic: str = Field(default="", max_length=200)
    subtopic: str = Field(default="", max_length=200)
    company_exam: str = Field(default="", max_length=120)
    custom_prompt: str = Field(default="", max_length=2000)
    question_format: Literal["single", "reasoning"] = "single"
    marks: float = Field(default=1, gt=0, le=100)
    negative_marks: float = Field(default=0, ge=0, le=100)
    include_explanations: bool = True
    language: str = Field(default="English", min_length=2, max_length=40)


class AIDraftApproval(BaseModel):
    questions: list[QuestionInput] = Field(min_length=1, max_length=149)

    @model_validator(mode="after")
    def validate_generated_mcqs(self):
        for question in self.questions:
            if question.type not in ("single", "reasoning"):
                raise ValueError("AI-generated questions must be single-answer multiple-choice questions")
            if len(question.options) != 4:
                raise ValueError("AI-generated questions must have exactly four options")
            if not isinstance(question.correct_answer, str):
                raise ValueError("AI-generated questions must have exactly one correct answer")
            if not question.explanation.strip():
                raise ValueError("Every AI-generated question must include an explanation")
        return self
