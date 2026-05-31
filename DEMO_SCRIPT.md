# Demo Script

## Setup (2 minutes)

```bash
# Clone and install
cd src
npm install
npm run build
cd ..

# Start server
node src/dist/server/server.js
```

Open http://localhost:3456

## Demo Flow (5 minutes)

### 1. Show the UI (30s)
- Point out chat panel, run list sidebar, settings button
- Explain: "This is a local web tool for running multi-agent software workflows"

### 2. Configure Model (30s)
- Click Settings
- Show mock provider (default)
- Show provider options (OpenAI, Anthropic, Gemini, Ollama, LM Studio)
- Click Test Connection → "Mock provider always available"
- Close settings

### 3. Run a Workflow (1 minute)
- Enter: "Add GET /health/details returning app_name, version, and environment."
- Click Run
- Show progress (status changes from queued → running → completed)
- Show run appearing in sidebar

### 4. Inspect Artifacts (1.5 minutes)
- Click the completed run in sidebar
- Show 11 artifacts listed
- Click context_pack → show requirement analysis and relevant files
- Click test_plan → show positive/negative/edge/regression tests
- Click code_review_report → show type-specific findings
- Click "Open Report" → show HTML report in new tab

### 5. Patch Mode (1 minute)
- Select "Patch Mode" from dropdown
- Enter workspace: examples/patch_targets/ts_mini_app
- Enter: "Add email validation to createUser()"
- Click Run
- Show patch result: applied, tests pass, diff
- Click "View Diff" → show unified diff

### 6. Export (30s)
- Click "Download Run Package (JSON)"
- Show exported JSON contains all artifacts

## Key Talking Points

1. **Not a chatbot**: This is a structured workflow engine that produces traceable artifacts
2. **Deterministic by default**: Mock provider generates consistent, reproducible output
3. **Real code patching**: Can apply patches to real codebases and verify with tests
4. **Full traceability**: Every run links requirement → context → plan → test → implementation → review → report
5. **Local-first**: No cloud dependencies, runs entirely on your machine

## Expected Output

After the demo query, the user should see:
- 11 markdown artifacts
- HTML report with all sections
- Requirement-specific content in every artifact
- Context pack with relevant files identified
- Test plan with 4 categories (positive, negative, edge, regression)
