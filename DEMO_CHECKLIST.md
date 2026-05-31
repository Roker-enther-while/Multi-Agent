# Demo Checklist

## Pre-Demo Setup
- [ ] Node.js 18+ installed
- [ ] Repository cloned
- [ ] `cd src && npm install && npm run build` completed
- [ ] Server starts: `node src/dist/server/server.js`
- [ ] UI accessible at http://localhost:3456

## Demo Flow

### 1. Show the UI (30s)
- [ ] Open http://localhost:3456
- [ ] Point out: chat panel, run list, settings button
- [ ] Explain: "Local web tool for multi-agent software workflows"

### 2. Configure Model (30s)
- [ ] Click Settings
- [ ] Show execution mode: Mock (default)
- [ ] Show provider options
- [ ] Click Test Connection → "Mock provider always available"
- [ ] Close settings

### 3. Run Plan-Only Workflow (1.5min)
- [ ] Enter: "Add GET /health/details returning app_name, version, and environment."
- [ ] Click Run
- [ ] Show status: queued → running → completed
- [ ] Click completed run in sidebar
- [ ] Show 11 artifacts
- [ ] Click context_pack → show relevant files
- [ ] Click test_plan → show 4 test categories
- [ ] Click "Open Report" → show HTML report

### 4. Run Patch Mode (1.5min)
- [ ] Select "Patch Mode"
- [ ] Enter workspace: examples/patch_targets/ts_mini_app
- [ ] Enter: "Add email validation to createUser()"
- [ ] Click Run
- [ ] Show patch result: applied, tests pass
- [ ] Click "View Diff" → show unified diff

### 5. Export and Collaboration (30s)
- [ ] Click "Download Run Package (JSON)"
- [ ] Show exported JSON contains all artifacts

### 6. Optional: GitHub Flow (if configured)
- [ ] Show GitHub settings
- [ ] Import issue as requirement
- [ ] Create PR from run

## Post-Demo
- [ ] Show DEMO_APP_RESULT.md
- [ ] Show docs/ directory
- [ ] Show evaluation/benchmark reports
