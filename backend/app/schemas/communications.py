from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field, model_validator


class AnnouncementInput(BaseModel):
    title: str = Field(min_length=3, max_length=180)
    body: str = Field(min_length=1, max_length=10000)
    audience: Literal["all", "students", "staff"] = "all"
    published_at: datetime | None = None
    expires_at: datetime | None = None

    @model_validator(mode="after")
    def validate_expiry(self):
        if self.published_at and self.published_at.tzinfo is None:
            self.published_at = self.published_at.replace(tzinfo=timezone.utc)
        if self.expires_at and self.expires_at.tzinfo is None:
            self.expires_at = self.expires_at.replace(tzinfo=timezone.utc)
        if self.published_at and self.expires_at and self.expires_at <= self.published_at:
            raise ValueError("Announcement expiry must be after its publish time")
        return self


class SupportTicketInput(BaseModel):
    subject: str = Field(min_length=3, max_length=180)
    message: str = Field(min_length=10, max_length=5000)
    category: Literal["exam", "account", "technical", "other"] = "other"


class SupportTicketUpdate(BaseModel):
    status: Literal["open", "in_progress", "resolved", "closed"]
    response: str | None = Field(default=None, max_length=5000)
