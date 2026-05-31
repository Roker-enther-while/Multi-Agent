# CLAUDE.md — Project Charter

## Project Name

Multi-Agent AI hỗ trợ phát triển phần mềm từ yêu cầu đến test case và review code

## Project Goal

Build a workflow-oriented AI assistant that manages and verifies software changes with full traceability:

```
Requirement → Context → Spec → Task Plan → Test Cases → Implementation → Verification → Review → Report
```

## Non-Negotiable Rules

1. **Never report DONE without evidence**
2. **Always inspect context before modifying files**
3. **Always run verification before marking complete**
4. **Always produce traceability from requirement to test to code**
5. **Do not skip tests**
6. **Do not skip review**
7. **Do not hide failures**

## Project Structure

```
src/
├── prompts/          # Agent prompts (project_manager.md, etc.)
├── orchestrator/     # PM workflow orchestration
├── agents/           # Logical agent implementations
├── tools/            # Tool interfaces and implementations
└── state/            # Project state management
```

## Key Files

| File | Purpose |
|---|---|
| CLAUDE.md | Permanent rules and project charter |
| NEXT_STEP.md | Current actionable next step |
| AGENT_REPORT.md | Latest execution report |
| PHASE_LOG.md | Chronological project history |

## Current Phase

**Phase 0 — Project Manager Orchestrator Scaffold**

See NEXT_STEP.md for immediate actions.

## Final Done Condition

The project is DONE only when:

1. End-to-end demo works: requirement → report
2. Traceability is proven
3. All verification passes
4. Code review is generated
5. All reports/logs are updated
