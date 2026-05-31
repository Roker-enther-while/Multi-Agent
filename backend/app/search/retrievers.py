from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db import crud
from app.db.qdrant import search as qdrant_search
from app.models.embedding import ImageEmbeddingModel
from app.search.query_planner import QueryPlan


@dataclass
class RetrieverResult:
    segment_id: str
    asset_id: str
    score: float
    retriever: str
    evidence: str
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "segment_id": self.segment_id,
            "asset_id": self.asset_id,
            "score": self.score,
            "retriever": self.retriever,
            "evidence": self.evidence,
            "metadata": self.metadata,
        }


class BaseRetriever:
    name = "base"

    def search(
        self,
        query_plan: QueryPlan,
        db: Session,
        top_k: int,
        filters: dict[str, Any] | None = None,
    ) -> list[RetrieverResult]:
        raise NotImplementedError

    def _segments(self, db: Session, filters: dict[str, Any] | None):
        asset_types = None
        if filters and isinstance(filters.get("asset_type"), list):
            asset_types = filters["asset_type"]
        return crud.list_image_segments_for_search(db, asset_types=asset_types, limit=1000)

    def _evidence_by_segment(self, db: Session, segment_ids: list[str]):
        return crud.list_evidence_for_segments(db, segment_ids)

    def _score_text(self, query: str, text: str) -> float:
        query_terms = tokenize(query)
        if not query_terms:
            return 0.0
        text_terms = tokenize(text)
        return len(query_terms.intersection(text_terms)) / float(len(query_terms))

    def _top(self, results: list[RetrieverResult], top_k: int) -> list[RetrieverResult]:
        results.sort(key=lambda result: result.score, reverse=True)
        return [result for result in results if result.score > 0][:top_k]


class TextSparseRetriever(BaseRetriever):
    name = "text_sparse"

    def search(self, query_plan: QueryPlan, db: Session, top_k: int, filters: dict[str, Any] | None = None):
        segments = self._segments(db, filters)
        evidence_by_segment = self._evidence_by_segment(db, [segment.segment_id for segment in segments])
        results = []
        for segment in segments:
            text_evidence = " ".join(item.content or "" for item in evidence_by_segment.get(segment.segment_id, []))
            combined = " ".join(
                value
                for value in [
                    segment.caption_vi,
                    segment.caption_en,
                    segment.transcript,
                    segment.ocr_text,
                    text_evidence,
                ]
                if value
            )
            score = self._score_text(query_plan.text_query, combined)
            results.append(
                RetrieverResult(segment.segment_id, segment.asset_id, score, self.name, combined[:500])
            )
        return self._top(results, top_k)


class OCRRetriever(BaseRetriever):
    name = "ocr"

    def search(self, query_plan: QueryPlan, db: Session, top_k: int, filters: dict[str, Any] | None = None):
        segments = self._segments(db, filters)
        evidence_by_segment = self._evidence_by_segment(db, [segment.segment_id for segment in segments])
        results = []
        for segment in segments:
            evidence = " ".join(
                item.content or ""
                for item in evidence_by_segment.get(segment.segment_id, [])
                if item.evidence_type == "ocr"
            )
            combined = " ".join(value for value in [segment.ocr_text, evidence] if value)
            score = self._score_text(query_plan.ocr_query or query_plan.text_query, combined)
            results.append(RetrieverResult(segment.segment_id, segment.asset_id, score, self.name, combined))
        return self._top(results, top_k)


class TranscriptRetriever(BaseRetriever):
    name = "transcript"

    def search(self, query_plan: QueryPlan, db: Session, top_k: int, filters: dict[str, Any] | None = None):
        segments = self._segments(db, filters)
        evidence_by_segment = self._evidence_by_segment(db, [segment.segment_id for segment in segments])
        results = []
        for segment in segments:
            evidence = " ".join(
                item.content or ""
                for item in evidence_by_segment.get(segment.segment_id, [])
                if item.evidence_type == "transcript"
            )
            combined = " ".join(value for value in [segment.transcript, evidence] if value)
            score = self._score_text(query_plan.audio_query or query_plan.text_query, combined)
            results.append(RetrieverResult(segment.segment_id, segment.asset_id, score, self.name, combined))
        return self._top(results, top_k)


class ObjectRetriever(BaseRetriever):
    name = "object"

    def search(self, query_plan: QueryPlan, db: Session, top_k: int, filters: dict[str, Any] | None = None):
        if not query_plan.object_filters:
            return []
        results = []
        for segment in self._segments(db, filters):
            objects = [normalize_object(item) for item in (segment.objects or [])]
            matched = sorted(set(objects).intersection(query_plan.object_filters))
            score = len(matched) / float(len(query_plan.object_filters))
            results.append(
                RetrieverResult(
                    segment.segment_id,
                    segment.asset_id,
                    score,
                    self.name,
                    " ".join(matched),
                    {"matched_objects": matched},
                )
            )
        return self._top(results, top_k)


class ImageTextRetriever(BaseRetriever):
    name = "image_text"

    def search(self, query_plan: QueryPlan, db: Session, top_k: int, filters: dict[str, Any] | None = None):
        settings = get_settings()
        if settings.enable_qdrant_indexing:
            try:
                vector = ImageEmbeddingModel(settings.image_embedding_dim).embed_text(
                    query_plan.visual_query or query_plan.text_query
                )
                response = qdrant_search(settings.image_collection_name, vector, top_k, filters)
                points = getattr(response, "points", response)
                qdrant_results = []
                for point in points:
                    payload = getattr(point, "payload", {}) or {}
                    if payload.get("segment_id") and payload.get("asset_id"):
                        qdrant_results.append(
                            RetrieverResult(
                                payload["segment_id"],
                                payload["asset_id"],
                                float(getattr(point, "score", 0.0)),
                                self.name,
                                payload.get("caption", ""),
                                {"source": "qdrant"},
                            )
                        )
                if qdrant_results:
                    return qdrant_results
            except Exception:
                pass

        results = []
        for segment in self._segments(db, filters):
            caption = " ".join(value for value in [segment.caption_en, segment.caption_vi] if value)
            score = self._score_text(query_plan.visual_query or query_plan.text_query, caption)
            results.append(RetrieverResult(segment.segment_id, segment.asset_id, score, self.name, caption))
        return self._top(results, top_k)


class MetadataRetriever(BaseRetriever):
    name = "metadata"

    def search(self, query_plan: QueryPlan, db: Session, top_k: int, filters: dict[str, Any] | None = None):
        metadata_filters = query_plan.metadata_filters or {}
        results = []
        for segment in self._segments(db, filters):
            score = 0.0
            evidence = []
            asset_type_filter = metadata_filters.get("asset_type")
            if isinstance(asset_type_filter, list) and segment.asset.asset_type in asset_type_filter:
                score += 1.0
                evidence.append(f"asset_type={segment.asset.asset_type}")
            source_filter = metadata_filters.get("source")
            if source_filter and segment.asset.source == source_filter:
                score += 1.0
                evidence.append(f"source={segment.asset.source}")
            results.append(RetrieverResult(segment.segment_id, segment.asset_id, score, self.name, " ".join(evidence)))
        return self._top(results, top_k)


class AudioEventRetriever(BaseRetriever):
    name = "audio_event"

    def search(self, query_plan: QueryPlan, db: Session, top_k: int, filters: dict[str, Any] | None = None):
        results = []
        for segment in self._segments(db, filters):
            audio_events = " ".join(str(item) for item in (segment.audio_events or []))
            combined = " ".join(value for value in [audio_events, segment.transcript] if value)
            score = self._score_text(query_plan.audio_query or query_plan.text_query, combined)
            results.append(RetrieverResult(segment.segment_id, segment.asset_id, score, self.name, combined))
        return self._top(results, top_k)


class TemporalRetriever(BaseRetriever):
    name = "temporal"

    def search(self, query_plan: QueryPlan, db: Session, top_k: int, filters: dict[str, Any] | None = None):
        if "temporal" not in query_plan.target_modalities:
            return []
        results = []
        for segment in self._segments(db, filters):
            has_time = segment.start_time is not None or segment.end_time is not None
            score = 1.0 if has_time else 0.0
            if query_plan.temporal_constraints and has_time:
                score += 0.25
            results.append(
                RetrieverResult(
                    segment.segment_id,
                    segment.asset_id,
                    score,
                    self.name,
                    f"start={segment.start_time} end={segment.end_time}",
                )
            )
        return self._top(results, top_k)


def tokenize(value: str) -> set[str]:
    return {token.lower() for token in value.replace("_", " ").replace("-", " ").split() if token.strip()}


def normalize_object(value: Any) -> str:
    if isinstance(value, dict):
        return str(value.get("label") or value.get("name") or value.get("class") or "").lower()
    return str(value).lower()
