# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**DevMIRA** (Developer Multi-Agent Intelligent Retrieval Assistant) — a multi-agent AI system that automates software development workflows from requirement to report, with full traceability.

This is NOT a chatbot or coding assistant. It is a **workflow engine** that simulates a senior-like software development process through 11 sequential agents, producing traceable artifacts at each step.

## Build, Test, Lint Commands

All commands run from `src/` unless noted:

```bash
cd src
npm install          # install dependencies
npm run lint         # TypeScript type-check (tsc --noEmit)
npm run build        # compile to dist/
npm test             # run 77 tests (node --test dist/**/*.test.js)
cd ..
```

CLI and demo (run from project root):
```bash
node src/dist/cli.js --help                                        # show commands
node src/dist/cli.js run --requirement "Add GET /health/details"   # run workflow
node src/dist/demo/run_demo.js                                     # run end-to-end demo
node src/dist/evaluation/run_evaluation.js                         # run 5 evaluation tasks
```

Web server:
```bash
node src/dist/server/server.js    # starts on http://localhost:3456
```

Single test: Tests run via Node.js built-in test runner from compiled `dist/`. Build before testing.

## Architecture

### Three Components

1. **Workflow Engine** (`src/`) — TypeScript multi-agent orchestration system
2. **Web UI** (`src/server/public/`) — Single-page chat interface served by the HTTP server
3. **Backend API** (`src/server/`) — Plain Node.js HTTP server (no Express) with 25+ REST endpoints

### Agent Pipeline (11 sequential agents)

```
Requirement → Context Reader → BA Artifact → Visual Model → Senior Review
→ Planner → Test Designer → Implementation → Verification
→ Code Reviewer → Traceability Reporter → Final Reporter → report.html
```

Each agent produces a markdown artifact. The orchestrator (`src/orchestrator/agent_coordinator.ts`) runs them sequentially, passing accumulated context to each.

### Key Directories

| Directory | Purpose |
|---|---|
| `src/agents/` | Agent implementations (mock_agents.ts is the main one) |
| `src/orchestrator/` | Workflow coordination (agent_coordinator.ts, full_workflow_runner.ts) |
| `src/tools/` | Utilities (artifact_store, patch_applicator, html_report_generator, etc.) |
| `src/server/` | HTTP API server, model providers, collaboration, run store |
| `src/prompts/` | System prompts and prompt assembler for LLM mode |
| `src/types/` | TypeScript type definitions (agents, artifacts, workflow) |
| `src/state/` | Immutable project state management |
| `src/integrations/github/` | GitHub client (mock + real) |
| `src/benchmark/` | Multi-repo benchmark runner |
| `examples/` | Patch targets, benchmark repos, evaluation tasks |

### Execution Modes

Configured via `AGENT_EXECUTION_MODE` env var:
- **mock** (default): Deterministic agents, no LLM calls
- **real**: Calls LLM provider for each agent
- **hybrid**: Mock generates first, LLM refines

### Model Providers

Configured via `MODEL_PROVIDER` env var: mock, openai_compatible, anthropic, gemini, ollama, lmstudio.

### State Management

All state mutations return new objects (immutable pattern). `ProjectState` (aliased as `WorkflowRun`) is the single source of truth. `ScopeLock` defines what is in/out of scope for each run.

### Artifact Storage

Artifacts stored under `.ai_runs/<runId>/` as markdown files with `.meta.json` sidecars. Path traversal protection via `assertInsideBaseDir()`.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| PORT | 3456 | Server port |
| AGENT_EXECUTION_MODE | mock | mock/real/hybrid |
| MODEL_PROVIDER | mock | LLM provider |
| MODEL_BASE_URL | | Provider base URL |
| MODEL_API_KEY | | Provider API key (never logged) |
| MODEL_NAME | mock-model | Model name |
| GITHUB_TOKEN | | GitHub token (optional) |
| GITHUB_PR_MODE | manual | disabled/manual/auto |
| BROWSER_AUTOMATION_ENABLED | false | Playwright E2E |

## Conventions

- **TypeScript**: Strict mode, ES2022/CommonJS target, `camelCase` for functions, `PascalCase` for types
- **No framework dependencies**: Server uses raw `http.createServer()`, no Express. GitHub client uses raw `fetch()`, no Octokit.
- **Mock-first**: Every external dependency has a mock implementation
- **Markdown artifacts**: All agent outputs are markdown. Reports are markdown or HTML.
- **Immutable state**: All state mutations return new objects (Redux-like pattern)
- **Commits**: Conventional prefixes (`feat:`, `docs:`, `fix:`), imperative mood

## Current Status

RELEASE FREEZE DONE. 77/77 tests pass. v1.0.0 tagged. See `FINAL_RELEASE_AUDIT.md` for details.
