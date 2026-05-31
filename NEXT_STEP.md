# NEXT STEP

## Current Actionable Next Step

**Phase:** Phase 1 - Tool Integration

**Priority:** HIGH

**Action:** Add deterministic local tools that agents and the orchestrator can use for file reading, code inspection, test execution, and report generation.

---

### What to Build:

1. **src/tools/file_reader.ts**
   - Read UTF-8 text files safely inside the repository.
   - Return structured file metadata and content.
   - Reject path traversal and missing files clearly.

2. **src/tools/code_inspector.ts**
   - Inspect project files using configured include/exclude patterns.
   - Produce a compact repository summary for context packs.
   - Avoid `node_modules`, `dist`, `.git`, and generated run artifacts.

3. **src/tools/command_runner.ts**
   - Run verification commands with timeout support.
   - Return `VerificationResult` objects.
   - Capture stdout, stderr, exit code, duration, and timestamp.

4. **src/tools/report_generator.ts**
   - Generate Markdown reports from workflow state and artifacts.
   - Include traceability, verification evidence, blockers, and decisions.

---

### Success Criteria:

- [ ] Tools are deterministic and local-only.
- [ ] File reads are constrained to the repository root.
- [ ] Code inspection excludes generated/dependency directories.
- [ ] Command runner returns structured verification results.
- [ ] Report generator produces a traceability-focused Markdown report.
- [ ] Unit tests cover success and failure paths.
- [ ] TypeScript build passes.
- [ ] Tests pass.

---

### Do NOT:

- Add real LLM calls.
- Add network-dependent tools.
- Add parallel agent execution.
- Execute destructive shell commands.

**First give agents safe local tools before implementing real agent coordination.**

---

### Prerequisites Met:

- Type contracts
- Project state model
- Artifact store
- Prompt registry
- Project Manager orchestrator scaffold
- Phase 0 tests passing (44/44)
