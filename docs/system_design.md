# System Design

The system is a deterministic multi-agent workflow engine for software requirements. It accepts a requirement, creates structured artifacts, verifies the run, and produces reports.

## Main Components

- `src/orchestrator/`: coordinates workflow execution.
- `src/agents/`: deterministic logical agents for context, BA artifact, visual modeling, planning, testing, implementation summary, verification, review, and reporting.
- `src/tools/`: local tools for artifact storage, input normalization, command execution, report generation, HTML report generation, senior gates, and final validation.
- `src/state/`: immutable project state helpers.
- `.ai_runs/`: generated run artifacts and reports.

## Workflow

```text
Requirement
  -> Context Pack
  -> BA Requirement Package
  -> Visual Model Package
  -> Senior Review Gates
  -> Task Plan
  -> Test Plan
  -> Implementation Summary
  -> Verification Report
  -> Code Review Report
  -> Traceability Report
  -> Final Report
```

## Design Principles

- Local first: no network dependency is required for the core demo.
- Evidence first: no done status is accepted without verification output.
- Traceable by default: every artifact is written with metadata.
- Failure visible: failed verification creates a blocker and returns a nonzero CLI result.

## Outputs

The workflow produces Markdown artifacts, metadata sidecars, a JSON demo manifest, and a single `report.html` for human review.
