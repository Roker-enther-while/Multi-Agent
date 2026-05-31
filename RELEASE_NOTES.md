# Release Notes — v1.0.0

**Date:** 2026-05-31

## Overview

DevMIRA (Developer Multi-Agent Intelligent Retrieval Assistant) is a multi-agent AI system for software development workflow automation. It provides structured traceability from requirement to report, with real code patching capability.

## Features

### Workflow Engine
- 11-agent sequential pipeline
- Requirement analysis with type detection
- Context pack with relevant file identification
- BA artifact generation (user stories, acceptance criteria)
- Visual modeling (Mermaid diagrams)
- Senior value gates (7 gates + 4 scores)
- Test plan generation (4 categories: positive, negative, edge, regression)
- Implementation guidance (file-level steps)
- Code review (type-specific findings with risk assessment)
- Traceability report
- HTML report generation

### Web UI
- Chat interface for requirement submission
- Run list sidebar with status badges
- Artifact viewer (click to view)
- Report.html link
- Mode selector (Plan Only / Patch Mode)
- Workspace input for patch mode
- File attachment (multi-file upload)
- Settings modal (model provider, execution mode)
- Export button (JSON download)

### Model Providers
- Mock (default, always available)
- OpenAI Compatible
- Anthropic
- Gemini
- Ollama
- LM Studio

### Execution Modes
- Mock: deterministic agents
- Real: LLM provider for each agent
- Hybrid: mock first, LLM refines

### GitHub Integration
- Import issue as requirement
- Create PR from run
- PR body with summary, tests, review, traceability

### Browser/E2E Automation
- Playwright optional
- E2E scenario format
- Screenshot/trace generation

### Team Collaboration
- Comments per run
- Approval/request changes flow
- Decision log

### Voice/Image Input
- Image understanding (mock)
- Voice transcript support
- Requirement fusion

### Benchmark/Evaluation
- 5 evaluation tasks
- 3 benchmark repos, 12 tasks
- Scoring and reporting

## Installation

```bash
git clone <repo-url>
cd Chat-Bot-Read-data-by-Text/src
npm install
npm run build
cd ..
node src/dist/server/server.js
```

Open http://localhost:3456

## Requirements

- Node.js 18+
- npm
- Port 3456 available

## Known Limitations

- Mock agents by default (no real LLM)
- In-memory run store
- No authentication
- Playwright not installed by default

## Tag Commands

```bash
git tag v1.0.0
git push origin v1.0.0
```
