# VietMIRA

Vietnamese Multimedia Intelligent Retrieval Assistant.

## Multi-Agent Workflow Productization

This repository also contains a thesis-oriented multi-agent workflow core in `src/`. It is not a generic chatbot and not a clone of coding assistants. Its focus is senior-like software workflow management: requirement intake, context packaging, BA artifacts, visual modeling, task planning, test planning, verification, code review, traceability, and final reporting.

### App Mode (Web UI)

Start the local web server and open the UI:

```bash
cd src
npm install
npm run build
cd ..
node src/dist/server/server.js
```

Open http://localhost:3456 in your browser. Enter a requirement in the chat panel and click "Run". See [docs/app_mode.md](docs/app_mode.md) for details.

Key commands:

```bash
cd src
npm run lint
npx tsc -p tsconfig.test.json
npm test
npm run build
cd ..
node src/dist/cli.js --help
node src/dist/demo/run_demo.js
node src/dist/evaluation/run_evaluation.js
```

### CLI Commands

The CLI provides five commands. All workflow commands (`run`, `demo`, `validate`, `report`) generate `report.html` in the run directory.

```bash
# Run workflow from requirement text — generates all artifacts + report.html
node src/dist/cli.js run --requirement "Add GET /health/details returning app_name, version, and environment."

# Run workflow from a requirement file
node src/dist/cli.js run --requirement-file path/to/requirement.md

# Run with a custom run ID
node src/dist/cli.js run --requirement "..." --run-id my-run

# Run the standard end-to-end demo
node src/dist/demo/run_demo.js

# Run workflow and print final validation JSON
node src/dist/cli.js validate --requirement "..."

# Run workflow and write workflow-report.md + report.html
node src/dist/cli.js report --requirement "..."

# Inspect repository files
node src/dist/cli.js inspect
```

Generated workflow artifacts are written under `.ai_runs/<runId>/`. Each run produces 11 markdown artifacts plus `report.html` for human review.

Thesis documentation:

- `docs/problem_statement.md`
- `docs/system_design.md`
- `docs/agent_workflow.md`
- `docs/evaluation_method.md`
- `docs/demo_script.md`

Current limitations: core agents are deterministic; real LLM calls, OCR, ASR, and external integrations are future work.

VietMIRA is a local-first multimedia retrieval system for image, video, audio, and text collections. It supports two competition workflows:

- Interactive mode: users search and inspect evidence through the Next.js UI.
- Auto mode: external systems call the API and receive top-k JSON answers.

The MVP is designed to run without GPU or heavy model downloads. OCR, captioning, embeddings, ASR, and reranking are deterministic mock implementations behind replaceable interfaces.

## Architecture

```text
User query
  -> QueryPlanner
  -> Retriever set selected by modality
  -> RRF fusion
  -> EvidenceValidator
  -> AnswerComposer
  -> UI result grid or auto JSON response
```

Services:

- Backend: FastAPI, SQLAlchemy, Alembic, pytest.
- Frontend: Next.js, TypeScript, Tailwind CSS.
- Metadata DB: PostgreSQL.
- Vector DB: Qdrant, optional/degraded in local tests.
- Queue/cache: Redis scaffold.
- Storage: local filesystem under `data/raw` and `data/processed`; MinIO is configured in Docker Compose for future object storage.

## Requirements

- Python 3.11+ for Docker images. Local tests in this workspace were run with Python 3.10.
- Node.js compatible with the installed Next.js toolchain.
- Docker Desktop for full Compose runtime.

Docker daemon note: if Docker Desktop is stopped, `docker compose up --build` cannot be verified. This is tracked as an environment limitation, not a code failure.

## Environment

Copy `.env.example` to `.env` for local overrides:

```bash
cp .env.example .env
```

Important variables:

- `DATABASE_URL`
- `QDRANT_URL`
- `REDIS_URL`
- `STORAGE_ROOT`
- `PROCESSED_ROOT`
- `IMAGE_COLLECTION_NAME`
- `TEXT_COLLECTION_NAME`
- `AUDIO_COLLECTION_NAME`
- `NEXT_PUBLIC_API_BASE_URL`

No API keys are hard-coded.

## Run With Docker Compose

```bash
docker compose up --build
```

Services:

- Backend API: http://localhost:8000/api/v1/health
- Frontend: http://localhost:3000
- Qdrant dashboard: http://localhost:6333/dashboard
- MinIO console: http://localhost:9001

## Local Development

Backend:

```bash
cd backend
python -m pip install -e ".[dev]"
pytest
alembic upgrade head --sql
```

Frontend:

```bash
cd frontend
npm install
npm run lint
npm run build
```

Repo-level verification used for this MVP:

```bash
pytest
cd backend && alembic upgrade head --sql
cd .. && docker compose config --quiet
cd frontend && npm run lint && npm run build && npm audit --omit=dev
```

## Upload Media

```bash
curl -X POST "http://localhost:8000/api/v1/assets/upload" \
  -F "file=@sample.jpg" \
  -F "language_hint=vi" \
  -F "source=local_test"
```

Uploaded files are stored under:

```text
data/raw/{asset_id}/{safe_filename}
```

Supported upload extensions:

- Images: `.jpg`, `.jpeg`, `.png`, `.webp`, `.bmp`
- Videos: `.mp4`, `.avi`, `.mov`, `.mkv`, `.webm`
- Audio: `.wav`, `.mp3`, `.m4a`, `.flac`, `.ogg`
- Text/documents: `.txt`, `.json`, `.csv`, `.md`, `.pdf`, `.docx`

`.pdf` and `.docx` uploads are accepted as assets, but ingestion returns `not_supported_yet` in this MVP.

## Ingest Media

Image/video/audio/text ingestion uses one endpoint:

```bash
curl -X POST "http://localhost:8000/api/v1/assets/{asset_id}/ingest" \
  -H "Content-Type: application/json" \
  -d '{
    "extract_keyframes": true,
    "run_ocr": true,
    "run_asr": true,
    "run_captioning": true,
    "run_object_detection": true,
    "index_after_processing": true
  }'
```

Implemented ingestion:

- Image: width/height, one image segment, mock OCR/caption evidence, deterministic image embedding.
- Video: OpenCV metadata, interval keyframes under `data/processed/{asset_id}/keyframes`, timestamped `video_frame` segments, mock OCR/caption/transcript evidence.
- Audio: one audio segment with deterministic mock ASR transcript.
- Text: `.txt`, `.md`, `.json`, `.csv` parsing, deterministic chunking, `text_chunk` evidence.

Qdrant indexing is attempted when enabled. If Qdrant is unavailable, ingestion returns `completed_with_warnings` instead of crashing.

## Interactive Search

```bash
curl -X POST "http://localhost:8000/api/v1/search" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Tim canh nguoi mac ao do dung gan xe may",
    "mode": "interactive",
    "top_k": 10,
    "filters": {"asset_type": ["image", "video"]}
  }'
```

Search response includes:

- `parsed_query`: rule-based planner output.
- `component_scores`: retriever-level scores.
- `matched_evidence`: caption, OCR, transcript, objects, audio events, and text evidence.
- `validation`: modality evidence checks, missing conditions, validation score.
- `explanation`: evidence-based explanation without hallucinated fields.

Retrievers:

- `TextSparseRetriever`
- `OCRRetriever`
- `TranscriptRetriever`
- `ObjectRetriever`
- `ImageTextRetriever`
- `MetadataRetriever`
- `AudioEventRetriever`
- `TemporalRetriever`

Fusion uses Reciprocal Rank Fusion. Search logs persist parsed query, retriever outputs, final results, and latency.

## Frontend UI

Set:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1
```

The UI provides:

- Backend health and local asset list.
- Search input, top-k, asset type, and modality focus controls.
- Parsed query viewer.
- Result grid with score, timestamps, validation score, and missing evidence badges.
- Evidence panel with captions, OCR, transcript, text, objects, audio events, validation, and explanation.
- Video player that opens `/api/v1/assets/{asset_id}/media` and seeks to `timestamp_start`.
- Auto mode panel for `/api/v1/auto/search`.

## Auto Challenge Mode

```bash
curl -X POST "http://localhost:8000/api/v1/auto/search" \
  -H "Content-Type: application/json" \
  -d '{
    "query_id": "q_001",
    "query": "Find a person in a red shirt near a motorbike.",
    "top_k": 10,
    "return_format": "challenge_json",
    "speed_mode": "balanced"
  }'
```

Batch and export:

```bash
python scripts/batch_search.py --queries data/queries.sample.json --api-url http://localhost:8000 --output reports/answers.json
python scripts/export_submission.py --answers reports/answers.json --output reports/challenge_submission.json
```

## Evaluation

```bash
python scripts/run_eval.py --queries data/eval.sample.json --api-url http://localhost:8000 --top-k 10 --output-dir reports
```

Metrics:

- `Recall@1`
- `Recall@5`
- `Recall@10`
- `MRR`
- `latency_avg`
- `latency_p50`
- `latency_p95`

Reports:

- `reports/eval_report.json`
- `reports/eval_report.csv`
- `reports/eval_predictions.json`

## Known Limitations

- Docker end-to-end runtime remains pending until the Docker daemon is available.
- OCR, captioning, embeddings, ASR, object detection, and reranking are deterministic mock implementations.
- Qdrant indexing/search degrades safely when Qdrant is unavailable.
- Video ingestion uses fixed-interval keyframes, not scene-boundary detection.
- Temporal reasoning is MVP rule-based.
- Upload size limits are not enforced by application-level config yet.
- `.pdf` and `.docx` ingestion is intentionally `not_supported_yet`.
- Evaluation validates API/metric plumbing, not real model quality.

## Documentation

- `docs/architecture.md`
- `docs/api.md`
- `docs/data_schema.md`
- `docs/evaluation.md`
- `NOTICE.md`
