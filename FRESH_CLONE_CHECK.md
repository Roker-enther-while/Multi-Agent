# Fresh Clone Verification Checklist

**Date:** 2026-05-31

## Prerequisites
- Node.js 18+ installed
- npm installed
- Git installed

## Steps

### 1. Clone Repository
```bash
git clone <repo-url>
cd Chat-Bot-Read-data-by-Text
```

### 2. Install Dependencies
```bash
cd src
npm install
```
✅ Expected: Dependencies installed, no errors

### 3. Build Project
```bash
npm run build
```
✅ Expected: TypeScript compiles, no errors

### 4. Run Tests
```bash
npm test
```
✅ Expected: 77/77 tests pass

### 5. Run Evaluation
```bash
node src/dist/evaluation/run_evaluation.js
```
✅ Expected: 5/5 tasks pass

### 6. Start Server
```bash
cd ..
node src/dist/server/server.js
```
✅ Expected: "Multi-Agent Workflow API running on http://localhost:3456"

### 7. Open UI
Open http://localhost:3456 in browser
✅ Expected: Chat interface loads

### 8. Test Health API
```bash
curl http://localhost:3456/api/health
```
✅ Expected: `{"status":"ok","version":"1.0.0",...}`

### 9. Run Demo Workflow
Enter in chat: "Add GET /health/details returning app_name, version, and environment."
Click Run
✅ Expected: Status changes to completed, 11 artifacts generated

### 10. View Artifacts
Click the completed run in sidebar
Click any artifact
✅ Expected: Artifact content displays

### 11. View Report
Click "Open Report"
✅ Expected: HTML report opens in new tab

### 12. Test Patch Mode
Select "Patch Mode"
Enter workspace: examples/patch_targets/ts_mini_app
Enter: "Add email validation to createUser()"
Click Run
✅ Expected: Patch applied, tests pass, diff shown

### 13. Export Run
Click "Download Run Package (JSON)"
✅ Expected: JSON file downloads with all artifacts

## Verification Commands Summary

```bash
cd src && npm run lint      # PASS
cd src && npm run build     # PASS
cd src && npm test          # PASS, 77/77
cd .. && node src/dist/evaluation/run_evaluation.js  # PASS, 5/5
curl http://localhost:3456/api/health  # PASS
```

## Known Issues
- Mock provider generates deterministic content (no real LLM)
- In-memory run store (runs lost on server restart)
- No authentication
- Port 3456 must be available

## Status
All steps verified on 2026-05-31.
