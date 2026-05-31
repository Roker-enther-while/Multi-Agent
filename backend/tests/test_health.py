from fastapi.testclient import TestClient

from app.api import routes_health
from app.main import app


async def fake_check_services(_settings):
    return {
        "postgres": "ok",
        "qdrant": "ok",
        "redis": "ok",
        "storage": "ok",
    }


def test_health_response(monkeypatch):
    monkeypatch.setattr(routes_health, "check_services", fake_check_services)

    client = TestClient(app)
    response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "services": {
            "postgres": "ok",
            "qdrant": "ok",
            "redis": "ok",
            "storage": "ok",
        },
    }


async def degraded_check_services(_settings):
    return {
        "postgres": "unavailable: OperationalError",
        "qdrant": "ok",
        "redis": "ok",
        "storage": "ok",
    }


def test_health_degraded_response_does_not_crash(monkeypatch):
    monkeypatch.setattr(routes_health, "check_services", degraded_check_services)

    client = TestClient(app)
    response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json()["status"] == "degraded"
    assert response.json()["services"]["postgres"] == "unavailable: OperationalError"
