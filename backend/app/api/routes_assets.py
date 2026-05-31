from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.db import crud
from app.db.postgres import get_db
from app.schemas.asset import AssetCreate, AssetListResponse, AssetRead, AssetUploadResponse
from app.storage.local import (
    LocalStorage,
    UnsafeFilenameError,
    UnsupportedAssetTypeError,
    detect_asset_type,
    sanitize_filename,
)

router = APIRouter(prefix="/assets", tags=["assets"])


@router.post("/upload", response_model=AssetUploadResponse)
async def upload_asset(
    file: UploadFile = File(...),
    language_hint: str | None = Form(default=None),
    source: str | None = Form(default=None),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> AssetUploadResponse:
    try:
        safe_filename = sanitize_filename(file.filename)
        asset_type = detect_asset_type(safe_filename)
    except UnsafeFilenameError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except UnsupportedAssetTypeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    asset_id = f"{asset_type}_{uuid4().hex}"
    storage = LocalStorage(settings.storage_root)
    try:
        media_path = storage.save_upload(
            asset_id=asset_id,
            upload_file=file,
            safe_filename=safe_filename,
        )
    except UnsafeFilenameError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    original_filename = file.filename or safe_filename
    crud.create_asset(
        db,
        AssetCreate(
            asset_id=asset_id,
            asset_type=asset_type,
            original_path=original_filename,
            media_path=media_path,
            language_hint=language_hint,
            source=source,
            metadata={"original_filename": original_filename},
        ),
    )

    return AssetUploadResponse(
        asset_id=asset_id,
        status="uploaded",
        asset_type=asset_type,
        original_filename=original_filename,
        media_path=media_path,
    )


@router.get("", response_model=AssetListResponse)
def list_assets(
    asset_type: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> AssetListResponse:
    assets = crud.list_assets(db, asset_type=asset_type, limit=limit, offset=offset)
    return AssetListResponse(items=assets, limit=limit, offset=offset)


@router.get("/{asset_id}", response_model=AssetRead)
def get_asset(asset_id: str, db: Session = Depends(get_db)) -> AssetRead:
    asset = crud.get_asset_by_id(db, asset_id)
    if asset is None:
        raise HTTPException(status_code=404, detail="Asset not found")
    return asset


@router.get("/{asset_id}/media")
def get_asset_media(
    asset_id: str,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> FileResponse:
    asset = crud.get_asset_by_id(db, asset_id)
    if asset is None:
        raise HTTPException(status_code=404, detail="Asset not found")
    if not asset.media_path:
        raise HTTPException(status_code=404, detail="Asset media not found")

    storage = LocalStorage(settings.storage_root)
    try:
        media_file = storage.resolve_media_path(asset.media_path)
    except UnsafeFilenameError as exc:
        raise HTTPException(status_code=404, detail="Asset media not found") from exc

    if not media_file.is_file():
        raise HTTPException(status_code=404, detail="Asset media not found")

    return FileResponse(
        path=media_file,
        filename=Path(asset.original_path).name,
        media_type="application/octet-stream",
    )
