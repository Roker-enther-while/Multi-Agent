# NEXT STEP

## Mini-Phase: CLI run/report/validate should generate HTML report

**Problem:** The `cli run` command runs the full workflow and produces all markdown artifacts, but does NOT generate `report.html`. Only `run_demo.js` generates it. A real user using `cli run` gets no HTML report.

**Improvement:** Add `writeHtmlWorkflowReport(result)` call to `runCommand`, `validateCommand`, and `reportCommand` in `cli.ts`. Include `htmlReportPath` in CLI output.

**Files likely affected:**
- `src/cli.ts` — add HTML report generation to run/validate/report commands

**Verification commands:**
- `cd src && npm run lint`
- `cd src && npx tsc -p tsconfig.test.json`
- `cd src && npm test`
- `cd src && npm run build`
- `node src/dist/cli.js run --requirement "Test HTML report generation" --run-id html-test`
- Verify `.ai_runs/html-test/report.html` exists

**Done condition:** All three CLI commands (run, validate, report) generate `report.html` in the run directory. All tests pass. Output includes `htmlReportPath`.
