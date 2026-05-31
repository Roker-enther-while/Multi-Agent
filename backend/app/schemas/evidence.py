from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class EvidenceSummary(BaseModel):
    segment_id: str
    validation_score: float


class EvidenceItemBase(BaseModel):
    segment_id: str
    evidence_type: str
    content: str | None = None
    confidence: float | None = None
    bbox: dict[str, Any] | list[float] | None = None
    timestamp_start: float | None = None
    timestamp_end: float | None = None
    model_name: str | None = None


class EvidenceItemCreate(EvidenceItemBase):
    evidence_id: str


class EvidenceItemRead(EvidenceItemCreate):
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
