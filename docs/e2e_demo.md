# End-to-End Demo

This demo proves the deterministic requirement-to-report workflow without LLM calls or network access.

## Command

Run from the repository root:

```bash
cd src
npm run build
cd ..
node src/dist/demo/run_demo.js
```

Optional custom requirement:

```bash
node src/dist/demo/run_demo.js "Add audit logging with traceability and verification evidence"
```

## Expected Output

The command prints a JSON manifest with:

- `status: "completed"`
- `runId: "end-to-end-demo"`
- all eight artifacts: `context_pack`, `task_plan`, `test_plan`, `implementation_summary`, `verification_report`, `code_review_report`, `traceability_report`, `final_report`
- `verification.allPassed: true`
- `blockers.count: 0`
- final done prerequisite flags set to `true`

Artifacts are written to:

```text
.ai_runs/end-to-end-demo/
```

Each artifact has a `.meta.json` sidecar for traceability.

## Evidence for Final Done Prerequisites

- Requirement to report: the demo starts from one requirement string and produces `final_report`.
- Traceability: `traceability_report` links the generated workflow artifacts.
- Verification: `verification_report` records the local smoke command result.
- Code review: `code_review_report` is generated before final reporting.
- Reports/logs: `AGENT_REPORT.md`, `PHASE_LOG.md`, and `NEXT_STEP.md` track phase evidence.
