# NEXT STEP

## Current Actionable Next Step

**Phase:** Phase 10 - Evaluation Dataset for Agent Workflow

**Priority:** HIGH

**Action:** Create small benchmark tasks to evaluate workflow quality.

---

### Required:

- Add `examples/evaluation_tasks/`.
- Include at least 5 requirement files:
  1. add health details endpoint
  2. add validation rule
  3. update API response field
  4. add UI button requirement
  5. add error handling requirement
- Add expected artifact checklist per task.
- Add evaluation script:
  - checks artifacts generated
  - checks required headings
  - checks finalValidation
- Add tests.

---

### Verification:

- `npm run lint`
- `npx tsc -p tsconfig.test.json`
- `npm test`
- `npm run build`
- evaluation script runs on sample tasks

---

### Commit:

`feat: add workflow evaluation task set`
