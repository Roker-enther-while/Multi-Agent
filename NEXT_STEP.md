# NEXT STEP

## Mini-Phase: Align docs with actual CLI behavior

**Problem:**
1. `docs/e2e_demo.md` lists 8 artifacts but demo now produces 11 (added ba_requirement_package, visual_model_package, senior_review).
2. README does not document that `cli run` generates `report.html`.
3. README does not document `report` or `validate` CLI commands.

**Improvement:** Update docs/e2e_demo.md artifact list. Update README to document all CLI commands and their outputs including report.html.

**Files likely affected:**
- `docs/e2e_demo.md` — fix artifact list
- `README.md` — add CLI commands section with report.html output

**Verification commands:**
- Review docs match actual CLI output

**Done condition:** docs/e2e_demo.md lists all 11 artifacts. README documents cli run/validate/report with report.html output.
