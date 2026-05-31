from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel
from qdrant_client import QdrantClient
from redis import Redis

from app.core.config import Settings, get_settings
from app.db.postgres import ping_database

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    status: str
    services: dict[str, str]


def _ok_or_error(fn) -> str:
    try:
        fn()
        return "ok"
    except Exception as exc:  # pragma: no cover - exact driver errors vary.
        return f"unavailable: {exc.__class__.__name__}"


def _check_postgres(settings: Settings) -> None:
    ping_database(settings.database_url)


def _check_qdrant(settings: Settings) -> None:
    client = QdrantClient(url=settings.qdrant_url, timeout=3)
    client.get_collections()


def _check_redis(settings: Settings) -> None:
    client = Redis.from_url(settings.redis_url, socket_connect_timeout=3, socket_timeout=3)
    client.ping()


def _check_storage(settings: Settings) -> None:
    media_root = Path(settings.media_root)
    media_root.mkdir(parents=True, exist_ok=True)
    probe = media_root / ".healthcheck"
    probe.write_text("ok", encoding="utf-8")
    probe.unlink(missing_ok=True)


async def check_services(settings: Settings) -> dict[str, str]:
    return await run_in_threadpool(
        lambda: {
            "postgres": _ok_or_error(lambda: _check_postgres(settings)),
            "qdrant": _ok_or_error(lambda: _check_qdrant(settings)),
            "redis": _ok_or_error(lambda: _check_redis(settings)),
            "storage": _ok_or_error(lambda: _check_storage(settings)),
        }
    )


@router.get("/health", response_model=HealthResponse)
async def health(settings: Settings = Depends(get_settings)) -> HealthResponse:
    services = await check_services(settings)
    status = "ok" if all(value == "ok" for value in services.values()) else "degraded"
    response = HealthResponse(status=status, services=services)
    if status != "ok" and settings.health_fail_on_dependency_error:
        raise HTTPException(status_code=503, detail=response.model_dump())
    return response
