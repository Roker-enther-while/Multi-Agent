# Thesis Solution Design

## Solution Overview

A multi-agent AI system that automates the software development workflow from requirement to report, with full traceability and verification.

## Architecture Principles

1. **Deterministic by Default**: Mock agents produce consistent, reproducible output
2. **Pluggable Providers**: Real LLM providers can be swapped in without changing the workflow
3. **Artifact-Centric**: Every step produces a persistent, traceable artifact
4. **Verification-First**: Every workflow includes verification commands
5. **Safety-First**: Path guards, file type limits, token protection

## Agent Design

Each agent has:
- A specific responsibility (context reading, BA analysis, test design, etc.)
- A system prompt defining output format
- Input from previous artifacts
- Output validation with retry on failure

### Agent Types

| Agent | Responsibility |
|---|---|
| Context Reader | Analyze repository, identify relevant files |
| BA Artifact | Generate user stories, acceptance criteria |
| Visual Model | Create Mermaid diagrams |
| Senior Review | Apply value gates, compute scores |
| Planner | Create implementation steps |
| Test Designer | Generate test cases (4 categories) |
| Implementation | Provide file-level guidance |
| Verification | Execute commands, record results |
| Code Reviewer | Generate findings with risk assessment |
| Traceability | Link all artifacts |
| Final Report | Summarize workflow |

## Workflow Modes

### Plan Only
- Runs all 11 agents
- Generates all artifacts
- No code changes applied

### Patch Mode
- Runs all 11 agents
- Applies code patches to workspace
- Runs tests on patched code
- Generates diff and test results

## Execution Modes

| Mode | Description |
|---|---|
| Mock | Deterministic agents, no LLM calls |
| Real | LLM provider for each agent |
| Hybrid | Mock generates, LLM refines |

## Data Flow

```
User Input (text/files/images/voice)
→ Requirement Fusion
→ Workflow Orchestrator
→ Agent Pipeline (11 agents)
→ Artifact Store (.ai_runs/)
→ HTML Report
→ Export Package
```

## Integration Points

- **GitHub**: Import issues, create PRs
- **Browser**: E2E testing with Playwright
- **Model Providers**: OpenAI, Anthropic, Gemini, Ollama, LM Studio
