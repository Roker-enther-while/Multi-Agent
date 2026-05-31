# NEXT STEP

## Current Actionable Next Step

**Phase:** Phase 9 - Report Viewer Artifact

**Priority:** HIGH

**Action:** Generate a single human-readable HTML report for demo/reporting.

---

### Required:

- Create HTML report generator.
- Input: artifacts from one run.
- Output: `.ai_runs/<runId>/report.html`
- Include requirement, context pack, BA package, visual diagrams as Mermaid code blocks, task plan, test plan, verification, review, traceability matrix, final status.
- No frontend app required.
- Add tests for report generation.

---

### Verification:

- `npm run lint`
- `npx tsc -p tsconfig.test.json`
- `npm test`
- `npm run build`
- demo generates `report.html`

---

### Commit:

`feat: add HTML workflow report generator`
