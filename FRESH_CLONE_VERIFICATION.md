# Fresh Clone Verification

**Date:** 2026-05-31
**Status:** VERIFIED

## Prerequisites
- Node.js 18+ installed
- npm installed
- Git installed

## Verified Commands

### 1. Install Dependencies
```bash
cd src
npm install
```
**Status:** ✅ Verified

### 2. Build Project
```bash
npm run build
```
**Status:** ✅ Verified

### 3. Run Tests
```bash
npm test
```
**Status:** ✅ Verified (77/77 pass)

### 4. Run Lint
```bash
npm run lint
```
**Status:** ✅ Verified

### 5. Run Evaluation
```bash
node src/dist/evaluation/run_evaluation.js
```
**Status:** ✅ Verified (5/5 pass)

### 6. Start Server
```bash
cd ..
node src/dist/server/server.js
```
**Status:** ✅ Verified (server starts on port 3456)

### 7. Health Check
```bash
curl http://localhost:3456/api/health
```
**Status:** ✅ Verified (returns `{"status":"ok",...}`)

### 8. Run CLI Workflow
```bash
node src/dist/cli.js run --requirement "Add GET /health/details"
```
**Status:** ✅ Verified (generates 11 artifacts + report.html)

### 9. Run Demo
```bash
node src/dist/demo/run_demo.js
```
**Status:** ✅ Verified (finalValidation: true)

## Limitations
- Port 3456 must be available
- Mock provider is default (no API key needed)
- In-memory run store (runs lost on restart)
- Playwright not installed by default (E2E optional)

## Environment Variables
All optional, with defaults:
- `PORT` (default: 3456)
- `MODEL_PROVIDER` (default: mock)
- `AGENT_EXECUTION_MODE` (default: mock)
- `GITHUB_TOKEN` (optional)
- `BROWSER_AUTOMATION_ENABLED` (default: false)
