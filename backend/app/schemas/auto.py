from typing import Literal

from pydantic import BaseModel, Field, field_validator


class AutoSearchRequest(BaseModel):
    query_id: str = Field(min_length=1)
    query: str = Field(min_length=1)
    top_k: int = Field(default=10, ge=1, le=100)
    return_format: Literal["challenge_json"] = "challenge_json"
    speed_mode: Literal["fast", "balanced", "accurate"] = "balanced"

    @field_validator("query_id", "query")
    @classmethod
    def must_not_be_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("value must not be blank")
        return stripped


class AutoAnswerEvidence(BaseModel):
    frame: str | None = None
    caption: str = ""
    transcript: str = ""
    ocr: str = ""
    text: str = ""


class AutoAnswer(BaseModel):
    rank: int
    asset_id: str
    segment_id: str
    timestamp_start: float | None = None
    timestamp_end: float | None = None
    score: float
    evidence: AutoAnswerEvidence


class AutoSearchResponse(BaseModel):
    query_id: str
    answers: list[AutoAnswer]
    latency_ms: int
