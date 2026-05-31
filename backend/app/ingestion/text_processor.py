import csv
import json
from io import StringIO
from pathlib import Path
from re import sub

from sqlalchemy.orm import Session

from app.core.config import Settings
from app.db import crud
from app.db.models import Asset
from app.db.qdrant import ensure_collection, upsert_point
from app.models.embedding import TextEmbeddingModel
from app.schemas.asset import SegmentCreate
from app.schemas.evidence import EvidenceItemCreate
from app.schemas.ingestion import IngestionRequest, IngestionResult
from app.storage.local import LocalStorage, UnsafeFilenameError


SUPPORTED_TEXT_EXTENSIONS = {".txt", ".md", ".json", ".csv"}


class TextProcessor:
    def __init__(
        self,
        db: Session,
        settings: Settings,
        *,
        embedding_model: TextEmbeddingModel | None = None,
    ) -> None:
        self.db = db
        self.settings = settings
        self.embedding_model = embedding_model or TextEmbeddingModel(settings.text_embedding_dim)
        self.storage = LocalStorage(settings.storage_root)

    def process(self, asset: Asset, request: IngestionRequest) -> IngestionResult:
        if asset.asset_type != "text":
            return self._failed(asset.asset_id, "asset_type_not_supported")
        if not asset.media_path:
            return self._failed(asset.asset_id, "asset_media_path_missing")

        try:
            text_path = self.storage.resolve_media_path(asset.media_path)
        except UnsafeFilenameError as exc:
            return self._failed(asset.asset_id, f"unsafe_media_path: {exc}")
        if not text_path.is_file():
            return self._failed(asset.asset_id, "media_file_missing")

        extension = text_path.suffix.lower()
        if extension not in SUPPORTED_TEXT_EXTENSIONS:
            return self._failed(asset.asset_id, f"not_supported_yet:{extension or '<none>'}")

        raw_text = text_path.read_text(encoding="utf-8", errors="ignore")
        normalized_text = self._normalize(self._parse_by_extension(raw_text, extension))
        if self.settings.max_text_ingest_chars > 0:
            normalized_text = normalized_text[: self.settings.max_text_ingest_chars]
        chunks = self._chunk_text(normalized_text)
        if not chunks:
            return self._failed(asset.asset_id, "empty_text")

        warnings: list[str] = []
        segments_created = 0
        evidence_created = 0
        qdrant_indexed_count = 0

        for index, chunk in enumerate(chunks):
            segment_id = f"{asset.asset_id}_text_{index}"
            existing_segment = crud.get_segment(self.db, segment_id)
            if existing_segment is not None:
                segment = existing_segment
                warnings.append(f"segment_already_exists:{segment_id}")
            else:
                segment = crud.create_segment(
                    self.db,
                    SegmentCreate(
                        segment_id=segment_id,
                        asset_id=asset.asset_id,
                        segment_type="text_chunk",
                        start_time=0,
                        end_time=0,
                        transcript=chunk,
                        objects=[],
                        audio_events=[],
                        metadata={
                            "ingestion_type": "text_mvp",
                            "chunk_index": index,
                            "source_extension": extension,
                        },
                    ),
                )
                segments_created += 1
                crud.create_evidence_item(
                    self.db,
                    EvidenceItemCreate(
                        evidence_id=f"{segment.segment_id}_text_chunk",
                        segment_id=segment.segment_id,
                        evidence_type="text_chunk",
                        content=chunk,
                        confidence=1.0,
                        model_name="text_processor_mvp",
                    ),
                )
                evidence_created += 1

            if request.index_after_processing and self.settings.enable_qdrant_indexing:
                try:
                    vector = self.embedding_model.embed_text(segment.transcript or chunk)
                    ensure_collection(self.settings.text_collection_name, self.embedding_model.dimension)
                    upsert_point(
                        self.settings.text_collection_name,
                        segment.segment_id,
                        vector,
                        {
                            "segment_id": segment.segment_id,
                            "asset_id": asset.asset_id,
                            "asset_type": "text",
                            "text": segment.transcript or "",
                        },
                    )
                    qdrant_indexed_count += 1
                except Exception as exc:  # pragma: no cover - exact network errors vary.
                    warnings.append(f"qdrant_indexing_skipped:{segment.segment_id}:{exc.__class__.__name__}")

        return IngestionResult(
            asset_id=asset.asset_id,
            status="completed" if not warnings else "completed_with_warnings",
            segments_created=segments_created,
            evidence_created=evidence_created,
            qdrant_indexed=qdrant_indexed_count == len(chunks),
            warnings=warnings,
        )

    def _parse_by_extension(self, raw_text: str, extension: str) -> str:
        if extension in {".txt", ".md"}:
            return raw_text
        if extension == ".json":
            try:
                return json.dumps(json.loads(raw_text), ensure_ascii=False, indent=2)
            except json.JSONDecodeError:
                return raw_text
        if extension == ".csv":
            reader = csv.reader(StringIO(raw_text))
            return "\n".join(" ".join(cell.strip() for cell in row if cell.strip()) for row in reader)
        return raw_text

    def _normalize(self, text: str) -> str:
        return sub(r"\s+", " ", text).strip()

    def _chunk_text(self, text: str) -> list[str]:
        chunk_size = max(int(self.settings.text_chunk_size), 1)
        overlap = max(min(int(self.settings.text_chunk_overlap), chunk_size - 1), 0)
        step = max(chunk_size - overlap, 1)
        chunks: list[str] = []
        start = 0
        while start < len(text):
            chunk = text[start : start + chunk_size].strip()
            if chunk:
                chunks.append(chunk)
            start += step
        return chunks

    def _failed(self, asset_id: str, warning: str) -> IngestionResult:
        return IngestionResult(
            asset_id=asset_id,
            status="failed",
            segments_created=0,
            evidence_created=0,
            qdrant_indexed=False,
            warnings=[warning],
        )
