from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.search.query_planner import QueryPlan


class SearchRequest(BaseModel):
    query: str = Field(min_length=1)
    mode: str = "interactive"
    top_k: int = Field(default=20, ge=1, le=100)
    filters: dict[str, Any] | None = None

    @field_validator("query")
    @classmethod
    def query_must_not_be_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("query must not be blank")
        return stripped

    def to_search_log(
        self,
        *,
        parsed_query: dict[str, Any],
        retriever_outputs: dict[str, Any],
        search_id: str,
        final_results: list[dict[str, Any]],
        latency_ms: int,
    ) -> "SearchLogCreate":
        return SearchLogCreate(
            search_id=search_id,
            query=self.query,
            parsed_query=parsed_query,
            retriever_outputs=retriever_outputs,
            final_results=final_results,
            latency_ms=latency_ms,
            mode=self.mode,
        )


class MatchedEvidence(BaseModel):
    caption: str = ""
    ocr: str = ""
    transcript: str = ""
    objects: list[Any] = Field(default_factory=list)
    audio_events: list[Any] = Field(default_factory=list)
    text: str = ""


class ValidationChecks(BaseModel):
    visual_condition_met: bool = False
    ocr_condition_met: bool = False
    audio_condition_met: bool = False
    text_condition_met: bool = False
    temporal_condition_met: bool = False


class ValidationResult(BaseModel):
    checks: ValidationChecks
    missing: list[str] = Field(default_factory=list)
    validation_score: float = 0.0


class SearchResult(BaseModel):
    asset_id: str
    segment_id: str
    source_type: str
    score: float
    component_scores: dict[str, float] = Field(default_factory=dict)
    preview_image: str | None = None
    timestamp_start: float | None = None
    timestamp_end: float | None = None
    matched_evidence: MatchedEvidence
    validation: ValidationResult
    explanation: str


class SearchResponse(BaseModel):
    search_id: str
    parsed_query: QueryPlan
    results: list[SearchResult]
    latency_ms: int


class SearchLogBase(BaseModel):
    query: str
    parsed_query: dict[str, Any] | None = None
    retriever_outputs: dict[str, Any] | list[Any] | None = None
    final_results: dict[str, Any] | list[Any] | None = None
    latency_ms: int | None = None
    mode: str | None = None


class SearchLogCreate(SearchLogBase):
    search_id: str


class SearchLogRead(SearchLogCreate):
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
