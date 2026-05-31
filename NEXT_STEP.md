# NEXT STEP

## Current Actionable Next Step

**Phase:** Phase 4 - Polish & Extend

**Priority:** HIGH

**Action:** Add final workflow validation and polish so the project can explicitly prove FINAL PROJECT DONE.

---

### What to Build:

1. **src/tools/final_done_validator.ts**
   - Validate final project done conditions from `CLAUDE.md`.
   - Check completed status, required artifacts, passing verification, code review, final report, and unresolved blockers.
   - Return structured pass/fail results with evidence.

2. **src/demo/demo_manifest.ts**
   - Include final validator output in the demo manifest.
   - Keep the JSON summary automation-friendly.

3. **docs/e2e_demo.md**
   - Add final validation evidence and troubleshooting notes.

---

### Success Criteria:

- [ ] Final done validator returns structured checks.
- [ ] Demo manifest includes final validation checks.
- [ ] Validator detects missing artifacts and failed verification.
- [ ] Documentation explains final done proof.
- [ ] TypeScript build passes.
- [ ] Tests pass.
- [ ] Demo command passes and shows final validation success.

---

### Do NOT:

- Add real LLM calls.
- Add network dependencies.
- Add unrelated product features.
- Expand beyond final validation polish.

**Finish by making FINAL PROJECT DONE mechanically verifiable.**

---

### Prerequisites Met:

- Type contracts
- Project state model
- Artifact store
- Prompt registry
- Project Manager orchestrator scaffold
- Local tool integration
- Full deterministic agent workflow
- Repeatable end-to-end demo
- Phase 3 tests passing (57/57)
