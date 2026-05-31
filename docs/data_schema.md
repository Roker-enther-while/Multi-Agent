# Data Schema

The PostgreSQL schema is implemented with SQLAlchemy models and Alembic migration `0001_initial_schema`.

## assets

| Column | Type | Notes |
|---|---|---|
| asset_id | TEXT | Primary key |
| asset_type | TEXT | Required |
| original_path | TEXT | Required |
| media_path | TEXT | Optional stored/served path |
| duration_seconds | DOUBLE PRECISION | Optional |
| width | INT | Optional |
| height | INT | Optional |
| fps | DOUBLE PRECISION | Optional |
| language_hint | TEXT | Optional |
| source | TEXT | Optional |
| created_at | TIMESTAMP | Defaults to now |
| metadata | JSONB | Defaults to `{}`; mapped in Python as `metadata_json` |

## segments

| Column | Type | Notes |
|---|---|---|
| segment_id | TEXT | Primary key |
| asset_id | TEXT | References `assets.asset_id` |
| segment_type | TEXT | Required |
| start_time | DOUBLE PRECISION | Optional |
| end_time | DOUBLE PRECISION | Optional |
| representative_frame_path | TEXT | Optional |
| caption_vi | TEXT | Optional |
| caption_en | TEXT | Optional |
| transcript | TEXT | Optional |
| ocr_text | TEXT | Optional |
| objects | JSONB | Defaults to `[]` |
| audio_events | JSONB | Defaults to `[]` |
| metadata | JSONB | Defaults to `{}`; mapped in Python as `metadata_json` |
| created_at | TIMESTAMP | Defaults to now |

## evidence_items

| Column | Type | Notes |
|---|---|---|
| evidence_id | TEXT | Primary key |
| segment_id | TEXT | References `segments.segment_id` |
| evidence_type | TEXT | Required |
| content | TEXT | Optional |
| confidence | DOUBLE PRECISION | Optional |
| bbox | JSONB | Optional |
| timestamp_start | DOUBLE PRECISION | Optional |
| timestamp_end | DOUBLE PRECISION | Optional |
| model_name | TEXT | Optional |
| created_at | TIMESTAMP | Defaults to now |

## search_logs

| Column | Type | Notes |
|---|---|---|
| search_id | TEXT | Primary key |
| query | TEXT | Required |
| parsed_query | JSONB | Optional |
| retriever_outputs | JSONB | Optional |
| final_results | JSONB | Optional |
| latency_ms | INT | Optional |
| mode | TEXT | Optional |
| created_at | TIMESTAMP | Defaults to now |

## Segment Semantics

- `image`: one segment per uploaded image.
- `video_frame`: one segment per extracted keyframe with `start_time` and `end_time`.
- `audio`: one segment per uploaded audio file in the MVP.
- `text_chunk`: one segment per parsed text chunk.

Every search result must include `asset_id`, `segment_id`, `score`, `source_type`, and evidence details. Missing evidence is represented in response-level validation, not by omitting the result.

## Evidence Types

MVP evidence types include:

- `caption`
- `ocr`
- `transcript`
- `text_chunk`

Future real model integrations can add additional evidence types while preserving the `evidence_items` table.

## Qdrant Collections

Configured collections:

- `image_frames_clip`
- `text_chunks_dense`
- `audio_text_dense`
- `scene_text_dense`
- `object_tags_sparse`
- `multimodal_scene`

MVP ingestion actively attempts:

- `image_frames_clip` for image and video keyframe embeddings.
- `text_chunks_dense` for text chunks.
- `audio_text_dense` for audio transcripts.

If Qdrant is unavailable, ingestion and search degrade safely and tests still pass without Docker.

## Qdrant Payload Example

```json
{
  "segment_id": "video_001_frame_0",
  "asset_id": "video_001",
  "asset_type": "video",
  "start_time": 0.0,
  "end_time": 5.0,
  "caption": "Mock caption for keyframe",
  "ocr": "",
  "transcript": "Mock transcript",
  "objects": [],
  "preview_image": "data/processed/video_001/keyframes/frame_000.jpg"
}
```
