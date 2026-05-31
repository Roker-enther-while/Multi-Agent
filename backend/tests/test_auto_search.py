import sys
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from app.core.config import Settings, get_settings
from app.db import crud
from app.db.postgres import get_db
from app.main import app
from app.schemas.asset import AssetCreate, SegmentCreate
from scripts.batch_search import build_payload
from scripts.export_submission import export_submission


def test_auto_search_returns_query_id_and_answers(db_session: Session, tmp_path, monkeypatch):
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
        AssetCreate(asset_id="auto_image", asset_type="image", original_path="image.jpg"),
    )
    crud.create_segment(
        db_session,
        SegmentCreate(
            segment_id="auto_image_image_0",
            asset_id="auto_image",
            segment_type="image",
            caption_en="person in red shirt near motorbike",
            ocr_text="garage sign",
            objects=["person", "motorbike"],
        ),
    )

    try:
        client = TestClient(app)
        response = client.post(
            "/api/v1/auto/search",
            json={
                "query_id": "q_001",
                "query": "Find a person in red shirt near motorbike",
                "top_k": 5,
                "return_format": "challenge_json",
                "speed_mode": "balanced",
            },
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    body = response.json()
    assert body["query_id"] == "q_001"
    assert body["answers"][0]["rank"] == 1
    assert body["answers"][0]["asset_id"] == "auto_image"
    assert body["answers"][0]["segment_id"] == "auto_image_image_0"
    assert body["answers"][0]["score"] >= 0
    assert body["answers"][0]["evidence"]["caption"]


def test_auto_search_validation_errors():
    client = TestClient(app)

    invalid_speed = client.post(
        "/api/v1/auto/search",
        json={"query_id": "q_001", "query": "red shirt", "speed_mode": "slow"},
    )
    blank_query = client.post(
        "/api/v1/auto/search",
        json={"query_id": "q_001", "query": "   ", "speed_mode": "fast"},
    )

    assert invalid_speed.status_code == 422
    assert blank_query.status_code == 422


def test_auto_search_accepts_all_speed_modes(db_session: Session, tmp_path, monkeypatch):
    def override_get_db():
        yield db_session

    def override_get_settings():
        return Settings(database_url="sqlite:///:memory:", storage_root=tmp_path / "raw")

    def fail_qdrant(*_args, **_kwargs):
        raise RuntimeError("qdrant unavailable")

    monkeypatch.setattr("app.search.retrievers.qdrant_search", fail_qdrant)
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_settings] = override_get_settings
    crud.create_asset(db_session, AssetCreate(asset_id="auto_text", asset_type="text", original_path="notes.txt"))
    crud.create_segment(
        db_session,
        SegmentCreate(
            segment_id="auto_text_text_0",
            asset_id="auto_text",
            segment_type="text_chunk",
            transcript="quarterly revenue increased",
        ),
    )

    try:
        client = TestClient(app)
        statuses = [
            client.post(
                "/api/v1/auto/search",
                json={"query_id": f"q_{mode}", "query": "revenue", "speed_mode": mode},
            ).status_code
            for mode in ["fast", "balanced", "accurate"]
        ]
    finally:
        app.dependency_overrides.clear()

    assert statuses == [200, 200, 200]


def test_batch_payload_and_export_submission_helpers():
    payload = build_payload({"query_id": "q_001", "query": "red shirt"}, top_k=3, speed_mode="fast")
    assert payload == {
        "query_id": "q_001",
        "query": "red shirt",
        "top_k": 3,
        "return_format": "challenge_json",
        "speed_mode": "fast",
    }

    submission = export_submission(
        [
            {
                "query_id": "q_001",
                "answers": [
                    {
                        "rank": 1,
                        "asset_id": "asset_1",
                        "segment_id": "segment_1",
                        "timestamp_start": 1.0,
                        "timestamp_end": 2.0,
                        "score": 0.5,
                    }
                ],
            }
        ]
    )

    assert submission == [
        {
            "query_id": "q_001",
            "rank": 1,
            "asset_id": "asset_1",
            "segment_id": "segment_1",
            "timestamp_start": 1.0,
            "timestamp_end": 2.0,
            "score": 0.5,
        }
    ]
