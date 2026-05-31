from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.db import crud
from app.db.postgres import get_db
from app.main import app
from app.schemas.asset import AssetCreate, SegmentCreate
from app.schemas.evidence import EvidenceItemCreate


def test_search_response_includes_parsed_query_and_filters(db_session: Session, tmp_path):
    def override_get_db():
        yield db_session

    def override_get_settings():
        return Settings(database_url="sqlite:///:memory:", storage_root=tmp_path / "raw")

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_settings] = override_get_settings

    crud.create_asset(
        db_session,
        AssetCreate(asset_id="text_001", asset_type="text", original_path="notes.txt"),
    )
    segment = crud.create_segment(
        db_session,
        SegmentCreate(
            segment_id="text_001_text_0",
            asset_id="text_001",
            segment_type="text_chunk",
            transcript="doanh thu quy mot tang manh",
            metadata={"ingestion_type": "text_mvp", "chunk_index": 0},
        ),
    )
    crud.create_evidence_item(
        db_session,
        EvidenceItemCreate(
            evidence_id="text_001_text_0_text_chunk",
            segment_id=segment.segment_id,
            evidence_type="text_chunk",
            content="doanh thu quy mot tang manh",
            confidence=1.0,
        ),
    )

    try:
        client = TestClient(app)
        response = client.post(
            "/api/v1/search",
            json={
                "query": "Tìm nội dung doanh thu",
                "top_k": 5,
                "filters": {"asset_type": ["text"]},
            },
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    body = response.json()
    assert body["parsed_query"]["intent"] == "document_qa"
    assert "text" in body["parsed_query"]["target_modalities"]
    assert body["parsed_query"]["metadata_filters"]["asset_type"] == ["text"]
    assert body["results"][0]["asset_id"] == "text_001"


def test_blank_search_query_returns_422():
    client = TestClient(app)

    response = client.post("/api/v1/search", json={"query": "   "})

    assert response.status_code == 422


def test_hybrid_search_returns_component_scores_and_logs_retriever_outputs(
    db_session: Session,
    tmp_path,
    monkeypatch,
):
    def override_get_db():
        yield db_session

    def override_get_settings():
        return Settings(database_url="sqlite:///:memory:", storage_root=tmp_path / "raw")

    def fail_qdrant(*_args, **_kwargs):
        raise RuntimeError("qdrant unavailable")

    monkeypatch.setattr("app.search.retrievers.qdrant_search", fail_qdrant)
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_settings] = override_get_settings

    crud.create_asset(
        db_session,
        AssetCreate(asset_id="image_hybrid", asset_type="image", original_path="image.jpg"),
    )
    crud.create_segment(
        db_session,
        SegmentCreate(
            segment_id="image_hybrid_image_0",
            asset_id="image_hybrid",
            segment_type="image",
            caption_en="red shirt person",
            ocr_text="large signboard",
            objects=["person", "signboard"],
            metadata={"ingestion_type": "image_mvp"},
        ),
    )

    try:
        client = TestClient(app)
        response = client.post(
            "/api/v1/search",
            json={
                "query": "Find image with red sign",
                "top_k": 5,
                "filters": {"asset_type": ["image"]},
            },
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    body = response.json()
    result = body["results"][0]
    assert result["segment_id"] == "image_hybrid_image_0"
    assert result["component_scores"]
    assert {"text_sparse", "ocr"}.intersection(result["component_scores"])
    assert result["matched_evidence"]["ocr"] == "large signboard"
    assert "validation" in result
    assert "explanation" in result
    assert result["validation"]["validation_score"] >= 0
    assert result["explanation"]

    search_log = crud.get_search_log(db_session, body["search_id"])
    assert search_log is not None
    assert search_log.parsed_query["intent"] == "image_retrieval"
    assert "text_sparse" in search_log.retriever_outputs
    assert search_log.final_results[0]["segment_id"] == "image_hybrid_image_0"
    assert "validation" in search_log.final_results[0]
    assert "explanation" in search_log.final_results[0]
    assert search_log.latency_ms is not None
