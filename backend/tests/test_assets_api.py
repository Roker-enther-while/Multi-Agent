from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.db import crud
from app.db.postgres import get_db
from app.main import app


@pytest.fixture()
def asset_client(db_session: Session, tmp_path: Path):
    storage_root = tmp_path / "raw"

    def override_get_db():
        yield db_session

    def override_get_settings():
        return Settings(
            database_url="sqlite:///:memory:",
            storage_root=storage_root,
            health_fail_on_dependency_error=False,
        )

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_settings] = override_get_settings

    with TestClient(app) as client:
        yield client, db_session, storage_root

    app.dependency_overrides.clear()


def test_upload_image_creates_db_record_and_file(asset_client):
    client, db_session, storage_root = asset_client

    response = client.post(
        "/api/v1/assets/upload",
        files={"file": ("sample.jpg", b"fake image bytes", "image/jpeg")},
        data={"language_hint": "vi", "source": "local_test"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "uploaded"
    assert body["asset_type"] == "image"
    assert body["original_filename"] == "sample.jpg"
    assert body["next_step"] == "run_ingestion"

    asset = crud.get_asset(db_session, body["asset_id"])
    assert asset is not None
    assert asset.asset_type == "image"
    assert asset.language_hint == "vi"
    assert asset.source == "local_test"
    assert asset.media_path == body["media_path"]
    assert (storage_root / asset.media_path).read_bytes() == b"fake image bytes"


def test_upload_text_file_success(asset_client):
    client, db_session, storage_root = asset_client

    response = client.post(
        "/api/v1/assets/upload",
        files={"file": ("notes.txt", b"xin chao", "text/plain")},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["asset_type"] == "text"
    assert crud.get_asset(db_session, body["asset_id"]) is not None
    assert (storage_root / body["media_path"]).read_text(encoding="utf-8") == "xin chao"


def test_upload_rejects_unsupported_extension(asset_client):
    client, _db_session, _storage_root = asset_client

    response = client.post(
        "/api/v1/assets/upload",
        files={"file": ("archive.exe", b"not allowed", "application/octet-stream")},
    )

    assert response.status_code == 400
    assert "Unsupported file extension" in response.json()["detail"]


def test_upload_rejects_path_traversal_filename(asset_client):
    client, _db_session, storage_root = asset_client

    response = client.post(
        "/api/v1/assets/upload",
        files={"file": ("../evil.jpg", b"bad", "image/jpeg")},
    )

    assert response.status_code == 400
    assert "path components" in response.json()["detail"]
    assert not (storage_root.parent / "evil.jpg").exists()


def test_list_get_and_media_endpoints(asset_client):
    client, _db_session, _storage_root = asset_client

    upload = client.post(
        "/api/v1/assets/upload",
        files={"file": ("frame.png", b"png bytes", "image/png")},
    )
    assert upload.status_code == 200
    uploaded = upload.json()

    list_response = client.get("/api/v1/assets?asset_type=image&limit=10&offset=0")
    assert list_response.status_code == 200
    items = list_response.json()["items"]
    assert [item["asset_id"] for item in items] == [uploaded["asset_id"]]

    detail_response = client.get(f"/api/v1/assets/{uploaded['asset_id']}")
    assert detail_response.status_code == 200
    assert detail_response.json()["asset_id"] == uploaded["asset_id"]
    assert detail_response.json()["metadata"]["original_filename"] == "frame.png"

    media_response = client.get(f"/api/v1/assets/{uploaded['asset_id']}/media")
    assert media_response.status_code == 200
    assert media_response.content == b"png bytes"


def test_get_missing_asset_returns_404(asset_client):
    client, _db_session, _storage_root = asset_client

    response = client.get("/api/v1/assets/missing")

    assert response.status_code == 404
