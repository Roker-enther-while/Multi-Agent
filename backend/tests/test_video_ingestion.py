from pathlib import Path

import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.db import crud
from app.db.postgres import get_db
from app.main import app


@pytest.fixture()
def video_client(db_session: Session, tmp_path: Path):
    storage_root = tmp_path / "raw"
    processed_root = tmp_path / "processed"

    def override_get_db():
        yield db_session

    def override_get_settings():
        return Settings(
            database_url="sqlite:///:memory:",
            storage_root=storage_root,
            processed_root=processed_root,
            video_keyframe_interval_seconds=1,
            video_max_keyframes=3,
            image_embedding_dim=64,
            enable_qdrant_indexing=True,
            health_fail_on_dependency_error=False,
        )

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_settings] = override_get_settings

    with TestClient(app) as client:
        yield client, db_session, storage_root, processed_root

    app.dependency_overrides.clear()


def make_test_video(path: Path, width: int = 32, height: int = 24, fps: float = 5.0, frames: int = 12) -> None:
    writer = cv2.VideoWriter(
        str(path),
        cv2.VideoWriter_fourcc(*"MJPG"),
        fps,
        (width, height),
    )
    assert writer.isOpened()
    for index in range(frames):
        frame = np.zeros((height, width, 3), dtype=np.uint8)
        frame[:, :, 2] = 120 + index
        frame[:, :, 1] = 20
        writer.write(frame)
    writer.release()


def upload_test_video(client: TestClient, tmp_path: Path) -> dict:
    video_path = tmp_path / "red_motorbike_scene.avi"
    make_test_video(video_path)
    response = client.post(
        "/api/v1/assets/upload",
        files={"file": ("red_motorbike_scene.avi", video_path.read_bytes(), "video/x-msvideo")},
    )
    assert response.status_code == 200
    assert response.json()["asset_type"] == "video"
    return response.json()


def test_ingest_video_creates_keyframes_segments_evidence_and_metadata(video_client, tmp_path, monkeypatch):
    client, db_session, _storage_root, processed_root = video_client
    uploaded = upload_test_video(client, tmp_path)

    def fail_qdrant(*_args, **_kwargs):
        raise RuntimeError("qdrant unavailable")

    monkeypatch.setattr("app.ingestion.video_processor.ensure_collection", fail_qdrant)

    response = client.post(
        f"/api/v1/assets/{uploaded['asset_id']}/ingest",
        json={"run_ocr": True, "run_captioning": True, "index_after_processing": True},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "completed_with_warnings"
    assert body["segments_created"] >= 2
    assert body["evidence_created"] == body["segments_created"] * 3
    assert body["qdrant_indexed"] is False
    assert all("qdrant_indexing_skipped" in warning for warning in body["warnings"])

    asset = crud.get_asset(db_session, uploaded["asset_id"])
    assert asset.duration_seconds and asset.duration_seconds > 0
    assert asset.fps and asset.fps > 0
    assert asset.width == 32
    assert asset.height == 24

    keyframe_dir = processed_root / uploaded["asset_id"] / "keyframes"
    assert keyframe_dir.is_dir()
    assert len(list(keyframe_dir.glob("*.jpg"))) == body["segments_created"]

    segments = crud.list_segments_by_asset(db_session, uploaded["asset_id"])
    assert len(segments) == body["segments_created"]
    assert all(segment.segment_type == "video_frame" for segment in segments)
    assert segments[0].start_time == 0
    assert segments[0].end_time is not None
    assert segments[0].representative_frame_path.endswith("frame_0000.jpg")
    assert segments[0].metadata_json["ingestion_type"] == "video_mvp"
    assert "Mock transcript for video file red_motorbike_scene.avi" in segments[0].transcript

    evidence = crud.list_evidence_by_segment(db_session, segments[0].segment_id)
    assert {item.evidence_type for item in evidence} == {"caption", "ocr", "transcript"}


def test_search_returns_video_result_with_timestamp(video_client, tmp_path, monkeypatch):
    client, _db_session, _storage_root, _processed_root = video_client
    uploaded = upload_test_video(client, tmp_path)

    def fail_qdrant(*_args, **_kwargs):
        raise RuntimeError("qdrant unavailable")

    monkeypatch.setattr("app.ingestion.video_processor.ensure_collection", fail_qdrant)
    ingest = client.post(f"/api/v1/assets/{uploaded['asset_id']}/ingest", json={})
    assert ingest.status_code == 200

    response = client.post(
        "/api/v1/search",
        json={
            "query": "red motorbike",
            "top_k": 5,
            "filters": {"asset_type": ["video"]},
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["results"]
    result = body["results"][0]
    assert result["asset_id"] == uploaded["asset_id"]
    assert result["segment_id"].startswith(f"{uploaded['asset_id']}_frame_")
    assert result["timestamp_start"] is not None
    assert result["timestamp_end"] is not None
    assert result["preview_image"].endswith(".jpg")
    assert "red_motorbike_scene.avi" in result["matched_evidence"]["transcript"]


def test_ingest_missing_video_asset_returns_404(video_client):
    client, _db_session, _storage_root, _processed_root = video_client

    response = client.post("/api/v1/assets/missing/ingest", json={})

    assert response.status_code == 404
