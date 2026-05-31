from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.postgres import get_db
from app.schemas.auto import AutoAnswer, AutoAnswerEvidence, AutoSearchRequest, AutoSearchResponse
from app.schemas.search import SearchRequest, SearchResult
from app.search.service import SearchService

router = APIRouter(prefix="/auto", tags=["auto"])


@router.post("/search", response_model=AutoSearchResponse)
def auto_search(request: AutoSearchRequest, db: Session = Depends(get_db)) -> AutoSearchResponse:
    candidate_multiplier, disabled_retrievers = _mode_settings(request.speed_mode)
    search_response = SearchService().search(
        db,
        SearchRequest(query=request.query, mode=f"auto_{request.speed_mode}", top_k=request.top_k),
        candidate_multiplier=candidate_multiplier,
        disabled_retrievers=disabled_retrievers,
    )
    return AutoSearchResponse(
        query_id=request.query_id,
        answers=[_to_answer(rank, result) for rank, result in enumerate(search_response.results, start=1)],
        latency_ms=search_response.latency_ms,
    )


def _mode_settings(speed_mode: str) -> tuple[int, set[str]]:
    if speed_mode == "fast":
        return 1, {"temporal", "metadata"}
    if speed_mode == "accurate":
        return 5, set()
    return 3, set()


def _to_answer(rank: int, result: SearchResult) -> AutoAnswer:
    evidence = result.matched_evidence
    return AutoAnswer(
        rank=rank,
        asset_id=result.asset_id,
        segment_id=result.segment_id,
        timestamp_start=result.timestamp_start,
        timestamp_end=result.timestamp_end,
        score=result.score,
        evidence=AutoAnswerEvidence(
            frame=result.preview_image,
            caption=evidence.caption,
            transcript=evidence.transcript,
            ocr=evidence.ocr,
            text=evidence.text,
        ),
    )
