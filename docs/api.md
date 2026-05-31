# API

## GET /api/v1/health

Returns service health for PostgreSQL, Qdrant, Redis, and storage.

```json
{
  "status": "ok",
  "services": {
    "postgres": "ok",
    "qdrant": "ok",
    "redis": "ok",
    "storage": "ok"
  }
}
```

If a dependency is unavailable and `HEALTH_FAIL_ON_DEPENDENCY_ERROR=false`, the endpoint returns HTTP 200 with `status: "degraded"` and the service value set to an explicit `unavailable: <ErrorType>` string. In Docker, `HEALTH_FAIL_ON_DEPENDENCY_ERROR=true` makes container health fail until dependencies are ready.

## POST /api/v1/assets/upload

Uploads one supported media file using `multipart/form-data`.

Fields:

- `file`: required upload file
- `language_hint`: optional
- `source`: optional

Example response:

```json
{
  "asset_id": "image_...",
  "status": "uploaded",
  "asset_type": "image",
  "original_filename": "sample.jpg",
  "media_path": "image_.../sample.jpg",
  "next_step": "run_ingestion"
}
```

Unsupported extensions and unsafe filenames return HTTP 400.

## GET /api/v1/assets

Lists assets.

Query parameters:

- `asset_type`: optional exact filter
- `limit`: default `100`
- `offset`: default `0`

## GET /api/v1/assets/{asset_id}

Returns one asset detail or HTTP 404.

## GET /api/v1/assets/{asset_id}/media

Serves the stored local media file for an asset. The client supplies only `asset_id`; arbitrary filesystem paths are never accepted.

## POST /api/v1/assets/{asset_id}/ingest

Runs ingestion for an asset. The MVP supports image, video, audio, and basic text assets.

Request:

```json
{
  "extract_keyframes": true,
  "run_ocr": true,
  "run_asr": true,
  "run_captioning": true,
  "run_object_detection": true,
  "index_after_processing": true
}
```

Response:

```json
{
  "asset_id": "image_...",
  "status": "completed_with_warnings",
  "segments_created": 1,
  "evidence_created": 2,
  "qdrant_indexed": false,
  "warnings": ["qdrant_indexing_skipped: ResponseHandlingException"]
}
```

Text ingestion supports `.txt`, `.md`, `.json`, and `.csv`. `.pdf` and `.docx` return HTTP 400 with a `not_supported_yet` warning.

## POST /api/v1/search

Runs interactive hybrid retrieval over captions, OCR, transcripts, objects, metadata, temporal hints, and text chunk evidence.

Request:

```json
{
  "query": "red motorbike",
  "mode": "interactive",
  "top_k": 20,
  "filters": {
    "asset_type": ["image"]
  }
}
```

Response includes `search_id`, `parsed_query`, `results`, and `latency_ms`.

Video/audio results include `timestamp_start` and `timestamp_end` when available. Text results include `matched_evidence.text`.

`parsed_query` uses the rule-based planner schema:

```json
{
  "intent": "video_moment_retrieval",
  "query_language": "vi",
  "target_modalities": ["visual", "audio", "temporal"],
  "visual_query": "...",
  "text_query": "...",
  "ocr_query": "",
  "audio_query": "...",
  "object_filters": ["person", "motorbike"],
  "temporal_constraints": [{"type": "after", "raw": "..."}],
  "metadata_filters": {"asset_type": ["video"]},
  "search_strategy": "hybrid_multimodal",
  "confidence": 0.92
}
```

Search results include hybrid retrieval scores and evidence validation:

```json
{
  "asset_id": "image_...",
  "segment_id": "image_..._image_0",
  "source_type": "image",
  "score": 0.0325,
  "component_scores": {
    "text_sparse": 0.5,
    "ocr": 1.0
  },
  "matched_evidence": {
    "caption": "...",
    "ocr": "...",
    "transcript": "",
    "objects": [],
    "audio_events": [],
    "text": ""
  },
  "validation": {
    "checks": {
      "visual_condition_met": true,
      "ocr_condition_met": true,
      "audio_condition_met": false,
      "text_condition_met": true,
      "temporal_condition_met": true
    },
    "missing": [],
    "validation_score": 1.0
  },
  "explanation": "Ket qua dua tren bang chung: caption, OCR. Cac dieu kien bat buoc co bang chung phu hop."
}
```

Results with weak or missing evidence are still returned when their retrieval score is high, but the missing checks are listed in `validation.missing` and described in `explanation`.

## POST /api/v1/auto/search

Runs challenge-style automatic search and returns top-k answers without UI-specific fields.

Request:

```json
{
  "query_id": "q_001",
  "query": "Find the moment where a person in red stands next to a motorbike.",
  "top_k": 10,
  "return_format": "challenge_json",
  "speed_mode": "balanced"
}
```

## Script CLIs

Batch auto search:

```bash
python scripts/batch_search.py --queries data/queries.sample.json --api-url http://localhost:8000 --output reports/answers.json --top-k 10 --speed-mode balanced
```

Export submission rows:

```bash
python scripts/export_submission.py --answers reports/answers.json --output reports/challenge_submission.json
```

Run evaluation:

```bash
python scripts/run_eval.py --queries data/eval.sample.json --api-url http://localhost:8000 --top-k 10 --output-dir reports
```

`speed_mode` accepts `fast`, `balanced`, or `accurate`. Fast uses fewer candidate retrievers, balanced uses the standard hybrid pipeline, and accurate uses a larger candidate set with the same deterministic MVP models.

Response:

```json
{
  "query_id": "q_001",
  "answers": [
    {
      "rank": 1,
      "asset_id": "video_001",
      "segment_id": "video_001_frame_0",
      "timestamp_start": 0.0,
      "timestamp_end": 5.0,
      "score": 0.0325,
      "evidence": {
        "frame": "data/processed/video_001/keyframes/frame_000.jpg",
        "caption": "...",
        "transcript": "...",
        "ocr": "...",
        "text": ""
      }
    }
  ],
  "latency_ms": 12
}
```
