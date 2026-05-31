# NEXT STEP

## Current Actionable Next Step

**Phase:** Phase 3 - End-to-End Demo

**Priority:** HIGH

**Action:** Create a repeatable demo that proves the complete requirement-to-report workflow with traceability, verification evidence, and review output.

---

### What to Build:

1. **src/demo/run_demo.ts**
   - Run `runFullWorkflow()` with a representative requirement.
   - Write artifacts under `.ai_runs/end-to-end-demo`.
   - Print a concise JSON summary for automation.

2. **src/demo/demo_manifest.ts**
   - Build a structured manifest from workflow output.
   - Include run status, artifact paths, verification status, blocker count, and final report path.

3. **docs/e2e_demo.md**
   - Document how to run the demo.
   - Show expected commands and expected outputs.
   - Define what proves FINAL PROJECT DONE prerequisites.

---

### Success Criteria:

- [ ] Demo runs from a single command after build.
- [ ] Demo writes all required artifacts to `.ai_runs/end-to-end-demo`.
- [ ] Demo summary includes status, traceability report, final report, verification results, and blockers.
- [ ] Documentation explains the demo and evidence.
- [ ] Tests cover manifest generation.
- [ ] TypeScript build passes.
- [ ] Tests pass.

---

### Do NOT:

- Add real LLM calls.
- Add network dependencies.
- Add unrelated product features.

**First make the completed workflow easy to rerun and inspect.**

---

### Prerequisites Met:

- Type contracts
- Project state model
- Artifact store
- Prompt registry
- Project Manager orchestrator scaffold
- Local tool integration
- Full deterministic agent workflow
- Phase 2 tests passing (56/56)
