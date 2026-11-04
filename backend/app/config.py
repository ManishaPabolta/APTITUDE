from pathlib import Path

from pydantic import AliasChoices, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    mongodb_url: str = Field(
        default="mongodb://localhost:27017",
        validation_alias=AliasChoices("mongodb_url", "mongodb_uri"),
    )
    database_name: str = "aptitude_platform"
    jwt_secret: str = Field(min_length=32)
    jwt_expire_minutes: int = 720
    cors_origins: str = "http://localhost:5173"
    admin_email: str = "admin@example.com"
    admin_password: str = Field(min_length=12)
    groq_api_key: str = ""
    groq_model: str = "openai/gpt-oss-120b"
    mail_host: str = ""
    mail_port: int = 587
    mail_username: str = ""
    mail_password: str = ""
    mail_from: str = ""
    mail_use_tls: bool = True
    mail_use_ssl: bool = False

    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[1] / ".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @field_validator("mongodb_url")
    @classmethod
    def validate_mongodb_url(cls, value: str) -> str:
        if not value.startswith(("mongodb://", "mongodb+srv://")):
            raise ValueError("MONGODB_URL must start with mongodb:// or mongodb+srv://")
        return value

    @field_validator("jwt_secret")
    @classmethod
    def reject_example_secret(cls, value: str) -> str:
        if value.lower().startswith("replace-with-") or value == "replace-this-with-a-long-random-secret":
            raise ValueError("Set JWT_SECRET to a unique random value before starting the API")
        return value

    @field_validator("admin_password")
    @classmethod
    def reject_example_password(cls, value: str) -> str:
        if value.lower().startswith("replace-with-") or value == "ChangeMe123!":
            raise ValueError("Set ADMIN_PASSWORD to a unique password before starting the API")
        return value

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
