# App Mode

The multi-agent workflow system can run as a local web application.

## Quick Start

```bash
cd src
npm install
npm run build
cd ..
node src/dist/server/server.js
```

Open http://localhost:3456 in your browser.

## Features

- Chat interface to submit software requirements
- Automatic workflow execution
- Real-time run status with progress indicators
- Artifact viewer (click to view any artifact)
- HTML report generation and viewing
- Model provider configuration (mock, OpenAI, Anthropic, Gemini, Ollama, LM Studio)
- Run history sidebar

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| PORT | 3456 | Server port |
| ROOT_DIR | (cwd) | Project root directory |
| BASE_DIR | .ai_runs | Artifact storage directory |
| MODEL_PROVIDER | mock | Model provider |
| MODEL_BASE_URL | | Provider base URL |
| MODEL_API_KEY | | Provider API key |
| MODEL_NAME | mock-model | Model name |
| MODEL_TEMPERATURE | 0.2 | Generation temperature |
| MODEL_MAX_TOKENS | 4096 | Max output tokens |

## Architecture

```
Browser (index.html)
  ↕ HTTP
Node.js Server (server.ts)
  ↕ API calls
Workflow Orchestrator (full_workflow_runner.ts)
  ↕ Agent execution
Mock Agents (mock_agents.ts)
  ↕ Artifact storage
.ai_runs/<runId>/
```
