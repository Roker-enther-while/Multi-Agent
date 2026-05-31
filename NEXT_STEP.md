# NEXT STEP

## Phase A — Backend API

**Goal:** Create API around existing workflow engine.

**Endpoints:**
- GET /api/health
- GET /api/settings
- POST /api/settings
- POST /api/runs
- GET /api/runs/:runId
- GET /api/runs/:runId/artifacts
- GET /api/runs/:runId/artifacts/:artifactName
- GET /api/runs/:runId/report
- POST /api/files/upload

**Files to create:**
- `src/server/server.ts` — HTTP server with routing
- `src/server/routes.ts` — API route handlers
- `src/server/run_store.ts` — Run state management

**Verification:** Server starts, API responds, workflow runs from API.
