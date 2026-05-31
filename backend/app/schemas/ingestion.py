from pydantic import BaseModel


class IngestionRequest(BaseModel):
    extract_keyframes: bool = True
    run_ocr: bool = True
    run_asr: bool = True
    run_captioning: bool = True
    run_object_detection: bool = True
    index_after_processing: bool = True


class IngestionResult(BaseModel):
    asset_id: str
    status: str
    segments_created: int
    evidence_created: int
    qdrant_indexed: bool
    warnings: list[str] = []
