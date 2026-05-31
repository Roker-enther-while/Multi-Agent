# Architecture

VietMIRA is a local-first multimedia retrieval assistant for images, videos, audio, and text.

## System Diagram

```text
Frontend Next.js
  -> FastAPI /api/v1
      -> PostgreSQL metadata and evidence
      -> Local media storage
      -> Qdrant vector collections
      -> Redis queue/cache scaffold
      -> MinIO optional object storage

Search request
  -> QueryPlanner
  -> modality retrievers
  -> Reciprocal Rank Fusion
  -> EvidenceValidator
  -> AnswerComposer
  -> SearchLog
  -> UI response or auto challenge response
```

## Component Responsibilities

- `backend/app/api`: HTTP routes for health, assets, ingestion, search, auto mode, and eval scaffold.
- `backend/app/db`: SQLAlchemy models, PostgreSQL session, CRUD helpers, Qdrant client wrapper.
- `backend/app/ingestion`: image, video, audio, and text processors.
- `backend/app/models`: replaceable model interfaces and deterministic mock implementations.
- `backend/app/search`: query planner, retrievers, fusion, validation, answer composition, and shared search service.
- `frontend/src`: interactive retrieval console.
- `scripts`: ingestion/evaluation/submission helper CLIs.

## Data Flow

1. Upload creates an `assets` row and stores the original file under `STORAGE_ROOT`.
2. Ingestion reads the file, creates `segments`, creates `evidence_items`, and attempts vector indexing.
3. Search uses a rule-based planner to select target modalities and retrievers.
4. Retriever outputs are fused with Reciprocal Rank Fusion.
5. Evidence validation marks missing modality conditions.
6. Answer composition returns evidence-first results and stores a `search_logs` row.

## Ingestion Flow

Image:

```text
asset image -> Pillow metadata -> image segment -> OCR/caption evidence -> image embedding -> image_frames_clip
```

Video:

```text
asset video -> OpenCV metadata -> interval keyframes -> video_frame segments -> OCR/caption/transcript evidence -> image_frames_clip
```

Audio:

```text
asset audio -> mock ASR transcript -> audio segment -> transcript evidence -> audio_text_dense
```

Text:

```text
asset text -> parse txt/md/json/csv -> chunks -> text_chunk segments -> text_chunk evidence -> text_chunks_dense
```

If Qdrant is unavailable, processors return warnings and continue.

## Search Flow

1. `QueryPlanner` detects language, intent, target modalities, object filters, temporal hints, and metadata filters.
2. `SearchService` selects retrievers:
   - visual: image-text and object retrievers
   - OCR: OCR retriever
   - audio: transcript and audio-event retrievers
   - text: sparse text retriever
   - temporal: temporal retriever
   - metadata: metadata retriever
3. `TextSparseRetriever` is always included as fallback.
4. `reciprocal_rank_fusion` produces final ranked candidates with `component_scores`.
5. `EvidenceValidator` computes required evidence checks and missing conditions.
6. `AnswerComposer` returns `matched_evidence`, `validation`, and `explanation`.

## Auto Mode Flow

`POST /api/v1/auto/search` uses the same `SearchService` as interactive search and maps results to challenge JSON:

```text
query_id + query -> SearchService -> top-k SearchResult -> ranked answers
```

Speed modes:

- `fast`: fewer candidate retrievers.
- `balanced`: standard hybrid pipeline.
- `accurate`: larger candidate set with the same deterministic MVP models.

## Model Replacement Points

Current implementations are deterministic mocks:

- OCR: `backend/app/models/ocr.py`
- Captioning: `backend/app/models/captioning.py`
- Image/text embeddings: `backend/app/models/embedding.py`
- ASR: `backend/app/models/asr.py`
- Object detection and reranking: interface placeholders

Real PaddleOCR/VietOCR, Whisper/PhoWhisper, CLIP/SigLIP, BGE/e5, YOLO, or reranker integrations should replace these interfaces without changing route contracts.

## Operational Notes

- Unit tests use SQLite and temporary storage; they do not require Docker, PostgreSQL, Redis, Qdrant, or MinIO.
- Docker Compose config is valid, but full runtime requires Docker daemon.
- No API keys are hard-coded.
