from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    project_name: str = "VietMIRA"
    environment: str = "local"
    api_v1_prefix: str = "/api/v1"

    database_url: str = "postgresql+psycopg://vietmira:vietmira@localhost:5432/vietmira"
    qdrant_url: str = "http://localhost:6333"
    redis_url: str = "redis://localhost:6379/0"
    image_embedding_dim: int = 64
    text_embedding_dim: int = 64
    image_collection_name: str = "image_frames_clip"
    text_collection_name: str = "text_chunks_dense"
    audio_collection_name: str = "audio_text_dense"
    enable_qdrant_indexing: bool = True

    media_root: Path = Path("./data/media")
    storage_root: Path = Path("./data/raw")
    processed_root: Path = Path("./data/processed")
    video_keyframe_interval_seconds: float = 5.0
    video_max_keyframes: int = 20
    text_chunk_size: int = 800
    text_chunk_overlap: int = 100
    max_text_ingest_chars: int = 200_000
    public_media_url: str = "/media"
    backend_cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:3000"])
    health_fail_on_dependency_error: bool = False

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @field_validator("backend_cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
