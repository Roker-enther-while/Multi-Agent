from __future__ import annotations

from time import perf_counter
from uuid import uuid4

from sqlalchemy.orm import Session

from app.db import crud
from app.schemas.search import SearchRequest, SearchResponse, SearchResult
from app.search.composer import AnswerComposer
from app.search.fusion import reciprocal_rank_fusion
from app.search.query_planner import QueryPlanner
from app.search.retrievers import (
    AudioEventRetriever,
    BaseRetriever,
    ImageTextRetriever,
    MetadataRetriever,
    OCRRetriever,
    ObjectRetriever,
    TemporalRetriever,
    TextSparseRetriever,
    TranscriptRetriever,
)
from app.search.validator import EvidenceValidator


class SearchService:
    def search(
        self,
        db: Session,
        request: SearchRequest,
        *,
        candidate_multiplier: int = 3,
        disabled_retrievers: set[str] | None = None,
    ) -> SearchResponse:
        started = perf_counter()
        filters = request.filters or {}
        parsed_query = QueryPlanner().plan(request.query, filters)
        retrievers = self._select_retrievers(parsed_query.target_modalities, disabled_retrievers or set())
        retriever_top_k = max(request.top_k, request.top_k * candidate_multiplier)

        results_by_retriever = {
            retriever.name: retriever.search(parsed_query, db, retriever_top_k, filters)
            for retriever in retrievers
        }
        fused_results = reciprocal_rank_fusion(results_by_retriever)[: request.top_k]

        segments = crud.get_segments_by_ids(db, [item.segment_id for item in fused_results])
        evidence_by_segment = crud.list_evidence_for_segments(db, [segment.segment_id for segment in segments])
        segments_by_id = {segment.segment_id: segment for segment in segments}

        validator = EvidenceValidator()
        composer = AnswerComposer()
        results: list[SearchResult] = []
        for fused in fused_results:
            segment = segments_by_id.get(fused.segment_id)
            if segment is None:
                continue
            evidence_items = evidence_by_segment.get(segment.segment_id, [])
            validation = validator.validate(parsed_query, segment, evidence_items)
            results.append(composer.compose(parsed_query, fused, segment, evidence_items, validation))

        latency_ms = int((perf_counter() - started) * 1000)
        search_id = f"search_{uuid4().hex}"
        retriever_outputs = {
            retriever_name: [result.to_dict() for result in retriever_results]
            for retriever_name, retriever_results in results_by_retriever.items()
        }
        crud.create_search_log(
            db,
            request.to_search_log(
                search_id=search_id,
                parsed_query=parsed_query.model_dump(),
                retriever_outputs=retriever_outputs,
                final_results=[item.model_dump() for item in results],
                latency_ms=latency_ms,
            ),
        )
        return SearchResponse(
            search_id=search_id,
            parsed_query=parsed_query,
            results=results,
            latency_ms=latency_ms,
        )

    def _select_retrievers(self, target_modalities: list[str], disabled: set[str]) -> list[BaseRetriever]:
        retrievers: list[BaseRetriever] = [TextSparseRetriever()]
        modality_set = set(target_modalities)
        if "visual" in modality_set:
            retrievers.extend([ImageTextRetriever(), ObjectRetriever()])
        if "ocr" in modality_set:
            retrievers.append(OCRRetriever())
        if "audio" in modality_set:
            retrievers.extend([TranscriptRetriever(), AudioEventRetriever()])
        if "text" in modality_set and not any(retriever.name == "transcript" for retriever in retrievers):
            retrievers.append(TranscriptRetriever())
        if "temporal" in modality_set:
            retrievers.append(TemporalRetriever())
        retrievers.append(MetadataRetriever())

        deduped: dict[str, BaseRetriever] = {}
        for retriever in retrievers:
            if retriever.name not in disabled:
                deduped[retriever.name] = retriever
        return list(deduped.values())
