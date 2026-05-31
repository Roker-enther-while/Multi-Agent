# App Mode Demo Result

**Date:** 2026-05-31

## How to Run

### Install

```bash
cd src
npm install
npm run build
```

### Start Server

```bash
# From the project root
node src/dist/server/server.js

# Or with custom port
PORT=3456 node src/dist/server/server.js
```

### Open UI

Open http://localhost:3456 in your browser.

### Model Configuration

Default: mock provider (no API key needed).

To use a real provider, click "Settings" in the UI or set env vars:

```bash
MODEL_PROVIDER=openai_compatible \
MODEL_BASE_URL=https://api.openai.com \
MODEL_API_KEY=sk-... \
MODEL_NAME=gpt-4 \
node src/dist/server/server.js
```

Supported providers: mock, openai_compatible, anthropic, gemini, ollama, lmstudio.

## Demo Query

Enter in the chat panel:

```
Add GET /health/details returning app_name, version, and environment.
```

## Expected Result

1. Workflow starts automatically
2. Progress bar shows running status
3. After ~1 second, workflow completes
4. Run appears in sidebar with "completed" badge
5. Click run to see 11 artifacts
6. Click any artifact to view content
7. Click "Open Report" to view report.html

## Generated Run Path

`.ai_runs/run-<timestamp>-<random>/`

Contains:
- context_pack.md
- ba_requirement_package.md
- visual_model_package.md
- senior_review.md
- task_plan.md
- test_plan.md
- implementation_summary.md
- verification_report.md
- code_review_report.md
- traceability_report.md
- final_report.md
- report.html

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | /api/health | Server health check |
| GET | /api/settings | Get model settings |
| POST | /api/settings | Update model settings |
| POST | /api/models/test-connection | Test provider connection |
| POST | /api/runs | Create workflow run |
| GET | /api/runs | List all runs |
| GET | /api/runs/:runId | Get run details |
| GET | /api/runs/:runId/artifacts | List run artifacts |
| GET | /api/runs/:runId/artifacts/:name | Read artifact content |
| GET | /api/runs/:runId/report | Get HTML report |

## Known Limitations

- Mock provider generates deterministic content (no real LLM calls)
- In-memory run store (runs lost on server restart)
- No authentication
- No file upload in UI (API endpoint exists)
- Single-user, single-session
- No WebSocket streaming (polling only)
