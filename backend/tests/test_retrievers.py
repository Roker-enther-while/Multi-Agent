from sqlalchemy.orm import Session

from app.db import crud
from app.schemas.asset import AssetCreate, SegmentCreate
from app.schemas.evidence import EvidenceItemCreate
from app.search.query_planner import QueryPlanner
from app.search.retrievers import (
    ImageTextRetriever,
    OCRRetriever,
    ObjectRetriever,
    TextSparseRetriever,
    TranscriptRetriever,
)


def seed_retriever_data(db_session: Session):
    crud.create_asset(
        db_session,
        AssetCreate(asset_id="image_ret", asset_type="image", original_path="image.jpg"),
    )
    crud.create_segment(
        db_session,
        SegmentCreate(
            segment_id="image_ret_image_0",
            asset_id="image_ret",
            segment_type="image",
            caption_en="person in red shirt near motorbike",
            ocr_text="coffee sign",
            transcript="",
            objects=["person", "motorbike"],
            metadata={"ingestion_type": "image_mvp"},
        ),
    )
    crud.create_evidence_item(
        db_session,
        EvidenceItemCreate(
            evidence_id="image_ret_image_0_text_chunk",
            segment_id="image_ret_image_0",
            evidence_type="text_chunk",
            content="annual revenue document",
            confidence=1.0,
        ),
    )
    crud.create_asset(
        db_session,
        AssetCreate(asset_id="audio_ret", asset_type="audio", original_path="audio.mp3"),
    )
    crud.create_segment(
        db_session,
        SegmentCreate(
            segment_id="audio_ret_audio_0",
            asset_id="audio_ret",
            segment_type="audio",
            transcript="mock transcript with horn sound",
            metadata={"ingestion_type": "audio_mvp"},
        ),
    )


def test_text_sparse_retriever_finds_caption_transcript_and_evidence(db_session: Session):
    seed_retriever_data(db_session)
    plan = QueryPlanner().plan("revenue document")

    results = TextSparseRetriever().search(plan, db_session, top_k=10)

    assert results[0].segment_id == "image_ret_image_0"
    assert results[0].retriever == "text_sparse"


def test_ocr_retriever_finds_ocr_text(db_session: Session):
    seed_retriever_data(db_session)
    plan = QueryPlanner().plan("Find sign text")

    results = OCRRetriever().search(plan, db_session, top_k=10)

    assert results[0].segment_id == "image_ret_image_0"
    assert results[0].retriever == "ocr"


def test_transcript_retriever_finds_transcript(db_session: Session):
    seed_retriever_data(db_session)
    plan = QueryPlanner().plan("horn sound")

    results = TranscriptRetriever().search(plan, db_session, top_k=10)

    assert results[0].segment_id == "audio_ret_audio_0"
    assert results[0].retriever == "transcript"


def test_object_retriever_matches_object_filters(db_session: Session):
    seed_retriever_data(db_session)
    plan = QueryPlanner().plan("person near motorbike")

    results = ObjectRetriever().search(plan, db_session, top_k=10)

    assert results[0].segment_id == "image_ret_image_0"
    assert results[0].metadata["matched_objects"] == ["motorbike", "person"]


def test_image_text_retriever_fallback_does_not_crash_when_qdrant_unavailable(db_session: Session, monkeypatch):
    seed_retriever_data(db_session)
    plan = QueryPlanner().plan("red shirt")

    def fail_qdrant(*_args, **_kwargs):
        raise RuntimeError("qdrant unavailable")

    monkeypatch.setattr("app.search.retrievers.qdrant_search", fail_qdrant)
    results = ImageTextRetriever().search(plan, db_session, top_k=10)

    assert results[0].segment_id == "image_ret_image_0"
    assert results[0].retriever == "image_text"
