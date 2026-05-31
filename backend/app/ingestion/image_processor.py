from pathlib import Path

from PIL import Image
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.db import crud
from app.db.models import Asset
from app.db.qdrant import ensure_collection, upsert_point
from app.models.captioning import CaptioningModel
from app.models.embedding import ImageEmbeddingModel
from app.models.ocr import OCRModel
from app.schemas.asset import SegmentCreate
from app.schemas.evidence import EvidenceItemCreate
from app.schemas.ingestion import IngestionRequest, IngestionResult
from app.storage.local import LocalStorage, UnsafeFilenameError


class ImageProcessor:
    def __init__(
        self,
        db: Session,
        settings: Settings,
        *,
        ocr_model: OCRModel | None = None,
        captioning_model: CaptioningModel | None = None,
        embedding_model: ImageEmbeddingModel | None = None,
    ) -> None:
        self.db = db
        self.settings = settings
        self.ocr_model = ocr_model or OCRModel()
        self.captioning_model = captioning_model or CaptioningModel()
        self.embedding_model = embedding_model or ImageEmbeddingModel(settings.image_embedding_dim)
        self.storage = LocalStorage(settings.storage_root)

    def process(self, asset: Asset, request: IngestionRequest) -> IngestionResult:
        warnings: list[str] = []
        if asset.asset_type != "image":
            return IngestionResult(
                asset_id=asset.asset_id,
                status="failed",
                segments_created=0,
                evidence_created=0,
                qdrant_indexed=False,
                warnings=["asset_type_not_supported"],
            )
        if not asset.media_path:
            return IngestionResult(
                asset_id=asset.asset_id,
                status="failed",
                segments_created=0,
                evidence_created=0,
                qdrant_indexed=False,
                warnings=["asset_media_path_missing"],
            )

        try:
            image_path = self.storage.resolve_media_path(asset.media_path)
        except UnsafeFilenameError as exc:
            return self._failed(asset.asset_id, f"unsafe_media_path: {exc}")

        if not image_path.is_file():
            return self._failed(asset.asset_id, "media_file_missing")

        width, height = self._read_image_size(image_path)
        if asset.width is None or asset.height is None:
            crud.update_asset_size(self.db, asset, width=width, height=height)

        ocr_result = self.ocr_model.extract_text(str(image_path)) if request.run_ocr else None
        caption_result = (
            self.captioning_model.generate_caption(str(image_path)) if request.run_captioning else None
        )

        segment_id = f"{asset.asset_id}_image_0"
        existing_segment = crud.get_segment(self.db, segment_id)
        segments_created = 0
        if existing_segment is None:
            segment = crud.create_segment(
                self.db,
                SegmentCreate(
                    segment_id=segment_id,
                    asset_id=asset.asset_id,
                    segment_type="image",
                    start_time=0,
                    end_time=0,
                    representative_frame_path=asset.media_path,
                    caption_en=caption_result.caption if caption_result else None,
                    ocr_text=ocr_result.text if ocr_result else None,
                    objects=[],
                    audio_events=[],
                    metadata={"ingestion_type": "image_mvp"},
                ),
            )
            segments_created = 1
        else:
            segment = existing_segment
            warnings.append("segment_already_exists")

        evidence_created = 0
        if caption_result and existing_segment is None:
            crud.create_evidence_item(
                self.db,
                EvidenceItemCreate(
                    evidence_id=f"{segment.segment_id}_caption",
                    segment_id=segment.segment_id,
                    evidence_type="caption",
                    content=caption_result.caption,
                    confidence=caption_result.confidence,
                    model_name=caption_result.model_name,
                ),
            )
            evidence_created += 1

        if request.run_ocr and existing_segment is None:
            crud.create_evidence_item(
                self.db,
                EvidenceItemCreate(
                    evidence_id=f"{segment.segment_id}_ocr",
                    segment_id=segment.segment_id,
                    evidence_type="ocr",
                    content=ocr_result.text if ocr_result else "",
                    confidence=ocr_result.confidence if ocr_result else 0.0,
                    model_name=ocr_result.model_name if ocr_result else "mock-ocr",
                ),
            )
            evidence_created += 1

        qdrant_indexed = False
        if request.index_after_processing and self.settings.enable_qdrant_indexing:
            vector = self.embedding_model.embed_image(str(image_path))
            payload = {
                "segment_id": segment.segment_id,
                "asset_id": asset.asset_id,
                "asset_type": "image",
                "caption": segment.caption_en or "",
                "ocr": segment.ocr_text or "",
                "objects": segment.objects or [],
                "preview_image": asset.media_path,
            }
            try:
                ensure_collection(self.settings.image_collection_name, self.embedding_model.dimension)
                upsert_point(self.settings.image_collection_name, segment.segment_id, vector, payload)
                qdrant_indexed = True
            except Exception as exc:  # pragma: no cover - exact network errors vary.
                warnings.append(f"qdrant_indexing_skipped: {exc.__class__.__name__}")

        status = "completed" if not warnings else "completed_with_warnings"
        return IngestionResult(
            asset_id=asset.asset_id,
            status=status,
            segments_created=segments_created,
            evidence_created=evidence_created,
            qdrant_indexed=qdrant_indexed,
            warnings=warnings,
        )

    def _read_image_size(self, image_path: Path) -> tuple[int, int]:
        with Image.open(image_path) as image:
            return image.size

    def _failed(self, asset_id: str, warning: str) -> IngestionResult:
        return IngestionResult(
            asset_id=asset_id,
            status="failed",
            segments_created=0,
            evidence_created=0,
            qdrant_indexed=False,
            warnings=[warning],
        )
