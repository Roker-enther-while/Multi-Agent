from io import BytesIO
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.db import crud
from app.db.postgres import get_db
from app.main import app
from app.models.embedding import ImageEmbeddingModel


@pytest.fixture()
def ingestion_client(db_session: Session, tmp_path: Path):
    storage_root = tmp_path / "raw"

    def override_get_db():
        yield db_session

    def override_get_settings():
        return Settings(
            database_url="sqlite:///:memory:",
            storage_root=storage_root,
            image_embedding_dim=64,
            enable_qdrant_indexing=True,
            health_fail_on_dependency_error=False,
        )

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_settings] = override_get_settings

    with TestClient(app) as client:
        yield client, db_session, storage_root

    app.dependency_overrides.clear()


def make_png_bytes(width: int = 13, height: int = 7) -> bytes:
    buffer = BytesIO()
    image = Image.new("RGB", (width, height), color=(180, 20, 20))
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def upload_test_image(client: TestClient, filename: str = "red_motorbike_sign.png") -> dict:
    response = client.post(
        "/api/v1/assets/upload",
        files={"file": (filename, make_png_bytes(), "image/png")},
    )
    assert response.status_code == 200
    return response.json()


def test_ingest_image_asset_creates_segment_evidence_and_updates_size(ingestion_client, monkeypatch):
    client, db_session, _storage_root = ingestion_client
    uploaded = upload_test_image(client)

    def fail_qdrant(*_args, **_kwargs):
        raise RuntimeError("qdrant unavailable")

    monkeypatch.setattr("app.ingestion.image_processor.ensure_collection", fail_qdrant)

    response = client.post(
        f"/api/v1/assets/{uploaded['asset_id']}/ingest",
        json={"run_ocr": True, "run_captioning": True, "index_after_processing": True},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "completed_with_warnings"
    assert body["segments_created"] == 1
    assert body["evidence_created"] == 2
    assert body["qdrant_indexed"] is False
    assert body["warnings"] == ["qdrant_indexing_skipped: RuntimeError"]

    asset = crud.get_asset(db_session, uploaded["asset_id"])
    assert asset.width == 13
    assert asset.height == 7

    segments = crud.list_segments_by_asset(db_session, uploaded["asset_id"])
    assert len(segments) == 1
    segment = segments[0]
    assert segment.segment_id == f"{uploaded['asset_id']}_image_0"
    assert segment.segment_type == "image"
    assert segment.representative_frame_path == uploaded["media_path"]
    assert "red motorbike sign" in (segment.ocr_text or "")
    assert segment.caption_en == "Image file red_motorbike_sign.png"
    assert segment.metadata_json == {"ingestion_type": "image_mvp"}

    evidence = crud.list_evidence_by_segment(db_session, segment.segment_id)
    assert {item.evidence_type for item in evidence} == {"caption", "ocr"}


def test_ingest_unsupported_text_subtype_returns_400(ingestion_client):
    client, _db_session, _storage_root = ingestion_client
    upload = client.post(
        "/api/v1/assets/upload",
        files={"file": ("document.pdf", b"%PDF fake", "application/pdf")},
    )
    assert upload.status_code == 200

    response = client.post(f"/api/v1/assets/{upload.json()['asset_id']}/ingest", json={})

    assert response.status_code == 400
    assert response.json()["detail"]["warnings"][0].startswith("not_supported_yet")


def test_ingest_missing_asset_returns_404(ingestion_client):
    client, _db_session, _storage_root = ingestion_client

    response = client.post("/api/v1/assets/missing/ingest", json={})

    assert response.status_code == 404


def test_mock_embedding_is_deterministic_and_normalized():
    model = ImageEmbeddingModel(dimension=64)

    first = model.embed_text("red motorbike")
    second = model.embed_text("red motorbike")
    other = model.embed_text("blue car")

    assert first == second
    assert first != other
    assert len(first) == 64
    assert abs(sum(value * value for value in first) - 1.0) < 1e-9


def test_search_image_baseline_returns_result_after_ingest(ingestion_client, monkeypatch):
    client, _db_session, _storage_root = ingestion_client
    uploaded = upload_test_image(client)

    def fail_qdrant(*_args, **_kwargs):
        raise RuntimeError("qdrant unavailable")

    monkeypatch.setattr("app.ingestion.image_processor.ensure_collection", fail_qdrant)
    ingest_response = client.post(f"/api/v1/assets/{uploaded['asset_id']}/ingest", json={})
    assert ingest_response.status_code == 200

    response = client.post(
        "/api/v1/search",
        json={
            "query": "red motorbike",
            "mode": "interactive",
            "top_k": 20,
            "filters": {"asset_type": ["image"]},
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["search_id"].startswith("search_")
    assert body["parsed_query"]["search_strategy"] == "hybrid_multimodal"
    assert "visual" in body["parsed_query"]["target_modalities"]
    assert body["results"][0]["asset_id"] == uploaded["asset_id"]
    assert body["results"][0]["segment_id"] == f"{uploaded['asset_id']}_image_0"
    assert body["results"][0]["score"] > 0
    assert body["results"][0]["matched_evidence"]["ocr"] == "red motorbike sign"
