from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class AssetBase(BaseModel):
    asset_type: str
    original_path: str
    media_path: str | None = None
    duration_seconds: float | None = None
    width: int | None = None
    height: int | None = None
    fps: float | None = None
    language_hint: str | None = None
    source: str | None = None
    metadata_json: dict[str, Any] = Field(default_factory=dict, alias="metadata")

    model_config = ConfigDict(populate_by_name=True)


class AssetCreate(AssetBase):
    asset_id: str


class AssetRead(AssetCreate):
    created_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        validate_by_alias=False,
        validate_by_name=True,
    )


class AssetUploadResponse(BaseModel):
    asset_id: str
    status: str
    asset_type: str
    original_filename: str
    media_path: str
    next_step: str = "run_ingestion"


class AssetListResponse(BaseModel):
    items: list[AssetRead]
    limit: int
    offset: int


class SegmentBase(BaseModel):
    asset_id: str
    segment_type: str
    start_time: float | None = None
    end_time: float | None = None
    representative_frame_path: str | None = None
    caption_vi: str | None = None
    caption_en: str | None = None
    transcript: str | None = None
    ocr_text: str | None = None
    objects: list[Any] = Field(default_factory=list)
    audio_events: list[Any] = Field(default_factory=list)
    metadata_json: dict[str, Any] = Field(default_factory=dict, alias="metadata")

    model_config = ConfigDict(populate_by_name=True)


class SegmentCreate(SegmentBase):
    segment_id: str


class SegmentRead(SegmentCreate):
    created_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        validate_by_alias=False,
        validate_by_name=True,
    )
