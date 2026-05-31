from app.core.config import Settings
from app.db import crud
from app.db.models import Asset
from app.db.qdrant import ensure_collection, upsert_point
from app.models.asr import ASRModel
from app.models.embedding import TextEmbeddingModel
from app.schemas.asset import SegmentCreate
from app.schemas.evidence import EvidenceItemCreate
from app.schemas.ingestion import IngestionRequest, IngestionResult
from app.storage.local import LocalStorage, UnsafeFilenameError
from sqlalchemy.orm import Session


class AudioProcessor:
    def __init__(
        self,
        db: Session,
        settings: Settings,
        *,
        asr_model: ASRModel | None = None,
        embedding_model: TextEmbeddingModel | None = None,
    ) -> None:
        self.db = db
        self.settings = settings
        self.asr_model = asr_model or ASRModel()
        self.embedding_model = embedding_model or TextEmbeddingModel(settings.text_embedding_dim)
        self.storage = LocalStorage(settings.storage_root)

    def process(self, asset: Asset, request: IngestionRequest) -> IngestionResult:
        if asset.asset_type != "audio":
            return self._failed(asset.asset_id, "asset_type_not_supported")
        if not asset.media_path:
            return self._failed(asset.asset_id, "asset_media_path_missing")

        try:
            audio_path = self.storage.resolve_media_path(asset.media_path)
        except UnsafeFilenameError as exc:
            return self._failed(asset.asset_id, f"unsafe_media_path: {exc}")
        if not audio_path.is_file():
            return self._failed(asset.asset_id, "media_file_missing")

        asr_result = self.asr_model.transcribe(str(audio_path)) if request.run_asr else None
        transcript = asr_result.text if asr_result else ""
        segment_id = f"{asset.asset_id}_audio_0"
        existing_segment = crud.get_segment(self.db, segment_id)
        warnings: list[str] = []
        segments_created = 0
        evidence_created = 0

        if existing_segment is None:
            segment = crud.create_segment(
                self.db,
                SegmentCreate(
                    segment_id=segment_id,
                    asset_id=asset.asset_id,
                    segment_type="audio",
                    start_time=0,
                    end_time=asset.duration_seconds or 0,
                    transcript=transcript,
                    objects=[],
                    audio_events=[],
                    metadata={"ingestion_type": "audio_mvp"},
                ),
            )
            segments_created = 1
            crud.create_evidence_item(
                self.db,
                EvidenceItemCreate(
                    evidence_id=f"{segment.segment_id}_transcript",
                    segment_id=segment.segment_id,
                    evidence_type="transcript",
                    content=transcript,
                    confidence=asr_result.confidence if asr_result else 0.0,
                    timestamp_start=0,
                    timestamp_end=asset.duration_seconds or 0,
                    model_name=asr_result.model_name if asr_result else "mock_asr",
                ),
            )
            evidence_created = 1
        else:
            segment = existing_segment
            warnings.append("segment_already_exists")

        qdrant_indexed = False
        if request.index_after_processing and self.settings.enable_qdrant_indexing:
            try:
                vector = self.embedding_model.embed_text(segment.transcript or transcript)
                ensure_collection(self.settings.audio_collection_name, self.embedding_model.dimension)
                upsert_point(
                    self.settings.audio_collection_name,
                    segment.segment_id,
                    vector,
                    {
                        "segment_id": segment.segment_id,
                        "asset_id": asset.asset_id,
                        "asset_type": "audio",
                        "start_time": segment.start_time,
                        "end_time": segment.end_time,
                        "transcript": segment.transcript or "",
                    },
                )
                qdrant_indexed = True
            except Exception as exc:  # pragma: no cover - exact network errors vary.
                warnings.append(f"qdrant_indexing_skipped: {exc.__class__.__name__}")

        return IngestionResult(
            asset_id=asset.asset_id,
            status="completed" if not warnings else "completed_with_warnings",
            segments_created=segments_created,
            evidence_created=evidence_created,
            qdrant_indexed=qdrant_indexed,
            warnings=warnings,
        )

    def _failed(self, asset_id: str, warning: str) -> IngestionResult:
        return IngestionResult(
            asset_id=asset_id,
            status="failed",
            segments_created=0,
            evidence_created=0,
            qdrant_indexed=False,
            warnings=[warning],
        )
