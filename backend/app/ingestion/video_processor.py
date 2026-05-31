from pathlib import Path

import cv2
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


class VideoProcessor:
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
        if asset.asset_type != "video":
            return self._failed(asset.asset_id, "asset_type_not_supported")
        if not asset.media_path:
            return self._failed(asset.asset_id, "asset_media_path_missing")

        try:
            video_path = self.storage.resolve_media_path(asset.media_path)
        except UnsafeFilenameError as exc:
            return self._failed(asset.asset_id, f"unsafe_media_path: {exc}")
        if not video_path.is_file():
            return self._failed(asset.asset_id, "media_file_missing")

        capture = cv2.VideoCapture(str(video_path))
        if not capture.isOpened():
            return self._failed(asset.asset_id, "video_open_failed")

        try:
            metadata = self._read_metadata(capture)
            crud.update_asset_media_metadata(
                self.db,
                asset,
                duration_seconds=metadata["duration_seconds"],
                fps=metadata["fps"],
                width=int(metadata["width"]),
                height=int(metadata["height"]),
            )

            frame_paths = self._extract_keyframes(capture, asset.asset_id, metadata)
        finally:
            capture.release()

        if not frame_paths:
            return self._failed(asset.asset_id, "no_keyframes_extracted")

        segments_created = 0
        evidence_created = 0
        qdrant_indexed_count = 0
        interval = self.settings.video_keyframe_interval_seconds

        for index, (timestamp, frame_path) in enumerate(frame_paths):
            segment_id = f"{asset.asset_id}_frame_{index}"
            existing_segment = crud.get_segment(self.db, segment_id)
            if existing_segment is not None:
                warnings.append(f"segment_already_exists:{segment_id}")
                segment = existing_segment
            else:
                ocr_result = self.ocr_model.extract_text(str(frame_path)) if request.run_ocr else None
                caption_result = (
                    self.captioning_model.generate_caption(str(frame_path))
                    if request.run_captioning
                    else None
                )
                transcript = f"Mock transcript for video file {Path(asset.original_path).name} at {timestamp:.2f}s"
                relative_frame_path = self._relative_processed_path(frame_path)
                segment = crud.create_segment(
                    self.db,
                    SegmentCreate(
                        segment_id=segment_id,
                        asset_id=asset.asset_id,
                        segment_type="video_frame",
                        start_time=timestamp,
                        end_time=min(timestamp + interval, metadata["duration_seconds"]),
                        representative_frame_path=relative_frame_path,
                        caption_en=caption_result.caption if caption_result else None,
                        ocr_text=ocr_result.text if ocr_result else None,
                        transcript=transcript,
                        objects=[],
                        audio_events=[],
                        metadata={
                            "ingestion_type": "video_mvp",
                            "frame_index": index,
                            "timestamp": timestamp,
                        },
                    ),
                )
                segments_created += 1

                if caption_result:
                    crud.create_evidence_item(
                        self.db,
                        EvidenceItemCreate(
                            evidence_id=f"{segment.segment_id}_caption",
                            segment_id=segment.segment_id,
                            evidence_type="caption",
                            content=caption_result.caption,
                            confidence=caption_result.confidence,
                            timestamp_start=segment.start_time,
                            timestamp_end=segment.end_time,
                            model_name=caption_result.model_name,
                        ),
                    )
                    evidence_created += 1
                if request.run_ocr:
                    crud.create_evidence_item(
                        self.db,
                        EvidenceItemCreate(
                            evidence_id=f"{segment.segment_id}_ocr",
                            segment_id=segment.segment_id,
                            evidence_type="ocr",
                            content=ocr_result.text if ocr_result else "",
                            confidence=ocr_result.confidence if ocr_result else 0.0,
                            timestamp_start=segment.start_time,
                            timestamp_end=segment.end_time,
                            model_name=ocr_result.model_name if ocr_result else "mock-ocr",
                        ),
                    )
                    evidence_created += 1
                crud.create_evidence_item(
                    self.db,
                    EvidenceItemCreate(
                        evidence_id=f"{segment.segment_id}_transcript",
                        segment_id=segment.segment_id,
                        evidence_type="transcript",
                        content=transcript,
                        confidence=0.4,
                        timestamp_start=segment.start_time,
                        timestamp_end=segment.end_time,
                        model_name="mock-video-transcript",
                    ),
                )
                evidence_created += 1

            if request.index_after_processing and self.settings.enable_qdrant_indexing:
                try:
                    vector = self.embedding_model.embed_image(str(frame_path))
                    ensure_collection(self.settings.image_collection_name, self.embedding_model.dimension)
                    upsert_point(
                        self.settings.image_collection_name,
                        segment.segment_id,
                        vector,
                        {
                            "segment_id": segment.segment_id,
                            "asset_id": asset.asset_id,
                            "asset_type": "video",
                            "start_time": segment.start_time,
                            "end_time": segment.end_time,
                            "caption": segment.caption_en or "",
                            "ocr": segment.ocr_text or "",
                            "transcript": segment.transcript or "",
                            "objects": segment.objects or [],
                            "preview_image": segment.representative_frame_path,
                        },
                    )
                    qdrant_indexed_count += 1
                except Exception as exc:  # pragma: no cover - exact network errors vary.
                    warnings.append(f"qdrant_indexing_skipped:{segment.segment_id}:{exc.__class__.__name__}")

        status = "completed" if not warnings else "completed_with_warnings"
        return IngestionResult(
            asset_id=asset.asset_id,
            status=status,
            segments_created=segments_created,
            evidence_created=evidence_created,
            qdrant_indexed=qdrant_indexed_count == len(frame_paths),
            warnings=warnings,
        )

    def _read_metadata(self, capture) -> dict[str, float]:
        fps = float(capture.get(cv2.CAP_PROP_FPS) or 0.0)
        frame_count = float(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0.0)
        width = float(capture.get(cv2.CAP_PROP_FRAME_WIDTH) or 0.0)
        height = float(capture.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0.0)
        duration = frame_count / fps if fps > 0 else 0.0
        return {
            "fps": fps,
            "frame_count": frame_count,
            "duration_seconds": duration,
            "width": width,
            "height": height,
        }

    def _extract_keyframes(
        self,
        capture,
        asset_id: str,
        metadata: dict[str, float],
    ) -> list[tuple[float, Path]]:
        interval = max(float(self.settings.video_keyframe_interval_seconds), 0.1)
        duration = max(float(metadata["duration_seconds"]), 0.0)
        max_keyframes = max(int(self.settings.video_max_keyframes), 1)
        timestamps = [0.0]
        next_timestamp = interval
        while next_timestamp < duration and len(timestamps) < max_keyframes:
            timestamps.append(next_timestamp)
            next_timestamp += interval

        output_dir = self._processed_keyframe_dir(asset_id)
        output_dir.mkdir(parents=True, exist_ok=True)

        frame_paths: list[tuple[float, Path]] = []
        for index, timestamp in enumerate(timestamps):
            capture.set(cv2.CAP_PROP_POS_MSEC, timestamp * 1000.0)
            ok, frame = capture.read()
            if not ok:
                continue
            output_path = output_dir / f"frame_{index:04d}.jpg"
            if cv2.imwrite(str(output_path), frame):
                frame_paths.append((timestamp, output_path))
        return frame_paths

    def _processed_keyframe_dir(self, asset_id: str) -> Path:
        root = self.settings.processed_root.resolve(strict=False)
        path = (root / asset_id / "keyframes").resolve(strict=False)
        try:
            path.relative_to(root)
        except ValueError as exc:
            raise UnsafeFilenameError("Processed path escapes processed root") from exc
        return path

    def _relative_processed_path(self, frame_path: Path) -> str:
        return str(frame_path.relative_to(self.settings.processed_root.resolve(strict=False))).replace("\\", "/")

    def _failed(self, asset_id: str, warning: str) -> IngestionResult:
        return IngestionResult(
            asset_id=asset_id,
            status="failed",
            segments_created=0,
            evidence_created=0,
            qdrant_indexed=False,
            warnings=[warning],
        )
