from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.db import crud
from app.db.postgres import get_db
from app.ingestion.text_processor import TextProcessor
from app.main import app


@pytest.fixture()
def audio_text_client(db_session: Session, tmp_path: Path):
    storage_root = tmp_path / "raw"
    processed_root = tmp_path / "processed"

    def override_get_db():
        yield db_session

    def override_get_settings():
        return Settings(
            database_url="sqlite:///:memory:",
            storage_root=storage_root,
            processed_root=processed_root,
            text_chunk_size=40,
            text_chunk_overlap=10,
            max_text_ingest_chars=500,
            text_embedding_dim=64,
            enable_qdrant_indexing=True,
            health_fail_on_dependency_error=False,
        )

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_settings] = override_get_settings

    with TestClient(app) as client:
        yield client, db_session, storage_root

    app.dependency_overrides.clear()


def test_ingest_audio_creates_segment_evidence_and_search_result(audio_text_client, monkeypatch):
    client, db_session, _storage_root = audio_text_client
    upload = client.post(
        "/api/v1/assets/upload",
        files={"file": ("meeting_red_motorbike.mp3", b"fake audio bytes", "audio/mpeg")},
    )
    assert upload.status_code == 200
    asset_id = upload.json()["asset_id"]

    def fail_qdrant(*_args, **_kwargs):
        raise RuntimeError("qdrant unavailable")

    monkeypatch.setattr("app.ingestion.audio_processor.ensure_collection", fail_qdrant)

    ingest = client.post(f"/api/v1/assets/{asset_id}/ingest", json={"run_asr": True})
    assert ingest.status_code == 200
    body = ingest.json()
    assert body["status"] == "completed_with_warnings"
    assert body["segments_created"] == 1
    assert body["evidence_created"] == 1
    assert body["qdrant_indexed"] is False
    assert body["warnings"] == ["qdrant_indexing_skipped: RuntimeError"]

    segments = crud.list_segments_by_asset(db_session, asset_id)
    assert len(segments) == 1
    assert segments[0].segment_type == "audio"
    assert "meeting red motorbike" in segments[0].transcript

    evidence = crud.list_evidence_by_segment(db_session, segments[0].segment_id)
    assert len(evidence) == 1
    assert evidence[0].evidence_type == "transcript"

    search = client.post(
        "/api/v1/search",
        json={"query": "meeting motorbike", "filters": {"asset_type": ["audio"]}},
    )
    assert search.status_code == 200
    result = search.json()["results"][0]
    assert result["source_type"] == "audio"
    assert result["matched_evidence"]["transcript"] == segments[0].transcript


def test_ingest_txt_creates_chunks_evidence_and_search_result(audio_text_client, monkeypatch):
    client, db_session, _storage_root = audio_text_client
    content = b"alpha red motorbike beta gamma " * 6
    upload = client.post(
        "/api/v1/assets/upload",
        files={"file": ("notes.txt", content, "text/plain")},
    )
    assert upload.status_code == 200
    asset_id = upload.json()["asset_id"]

    def fail_qdrant(*_args, **_kwargs):
        raise RuntimeError("qdrant unavailable")

    monkeypatch.setattr("app.ingestion.text_processor.ensure_collection", fail_qdrant)

    ingest = client.post(f"/api/v1/assets/{asset_id}/ingest", json={})
    assert ingest.status_code == 200
    body = ingest.json()
    assert body["status"] == "completed_with_warnings"
    assert body["segments_created"] > 1
    assert body["evidence_created"] == body["segments_created"]

    segments = crud.list_segments_by_asset(db_session, asset_id)
    assert all(segment.segment_type == "text_chunk" for segment in segments)
    assert segments[0].metadata_json["source_extension"] == ".txt"
    evidence = crud.list_evidence_by_segment(db_session, segments[0].segment_id)
    assert evidence[0].evidence_type == "text_chunk"

    search = client.post(
        "/api/v1/search",
        json={"query": "red motorbike", "filters": {"asset_type": ["text"]}},
    )
    assert search.status_code == 200
    result = search.json()["results"][0]
    assert result["source_type"] == "text"
    assert "red motorbike" in result["matched_evidence"]["text"]


@pytest.mark.parametrize(
    ("filename", "content", "expected"),
    [
        ("story.md", b"# Title\nVietnamese multimedia search", "Vietnamese multimedia"),
        ("data.json", b'{"topic": "audio transcript", "count": 2}', "audio transcript"),
        ("table.csv", b"name,value\nquery planner,ready\n", "query planner"),
    ],
)
def test_ingest_md_json_csv_success(audio_text_client, monkeypatch, filename, content, expected):
    client, db_session, _storage_root = audio_text_client
    upload = client.post(
        "/api/v1/assets/upload",
        files={"file": (filename, content, "text/plain")},
    )
    assert upload.status_code == 200

    def fail_qdrant(*_args, **_kwargs):
        raise RuntimeError("qdrant unavailable")

    monkeypatch.setattr("app.ingestion.text_processor.ensure_collection", fail_qdrant)
    ingest = client.post(f"/api/v1/assets/{upload.json()['asset_id']}/ingest", json={})
    assert ingest.status_code == 200

    segments = crud.list_segments_by_asset(db_session, upload.json()["asset_id"])
    assert segments
    assert expected in " ".join(segment.transcript for segment in segments)


def test_ingest_pdf_returns_not_supported(audio_text_client):
    client, _db_session, _storage_root = audio_text_client
    upload = client.post(
        "/api/v1/assets/upload",
        files={"file": ("paper.pdf", b"%PDF fake", "application/pdf")},
    )
    assert upload.status_code == 200

    response = client.post(f"/api/v1/assets/{upload.json()['asset_id']}/ingest", json={})

    assert response.status_code == 400
    assert response.json()["detail"]["warnings"][0] == "not_supported_yet:.pdf"


def test_text_chunking_is_deterministic(db_session, tmp_path):
    settings = Settings(
        database_url="sqlite:///:memory:",
        storage_root=tmp_path / "raw",
        text_chunk_size=10,
        text_chunk_overlap=2,
    )
    processor = TextProcessor(db_session, settings)

    assert processor._chunk_text("abcdefghij12345") == ["abcdefghij", "ij12345"]
    assert processor._chunk_text("abcdefghij12345") == ["abcdefghij", "ij12345"]
