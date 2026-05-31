from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.db import crud
from app.db.postgres import get_db
from app.ingestion.audio_processor import AudioProcessor
from app.ingestion.image_processor import ImageProcessor
from app.ingestion.text_processor import TextProcessor
from app.ingestion.video_processor import VideoProcessor
from app.schemas.ingestion import IngestionRequest, IngestionResult

router = APIRouter(prefix="/assets", tags=["ingestion"])


@router.post("/{asset_id}/ingest", response_model=IngestionResult)
def ingest_asset(
    asset_id: str,
    request: IngestionRequest,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> IngestionResult:
    asset = crud.get_asset_by_id(db, asset_id)
    if asset is None:
        raise HTTPException(status_code=404, detail="Asset not found")

    if asset.asset_type == "image":
        processor = ImageProcessor(db=db, settings=settings)
    elif asset.asset_type == "video":
        processor = VideoProcessor(db=db, settings=settings)
    elif asset.asset_type == "audio":
        processor = AudioProcessor(db=db, settings=settings)
    elif asset.asset_type == "text":
        processor = TextProcessor(db=db, settings=settings)
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Ingestion not supported for asset_type={asset.asset_type}",
        )

    result = processor.process(asset, request)
    if result.status == "failed":
        raise HTTPException(status_code=400, detail=result.model_dump())
    return result
