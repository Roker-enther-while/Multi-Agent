# NEXT STEP

## Current Actionable Next Step

**Phase:** Phase 2 - Full Agent Implementation

**Priority:** HIGH

**Action:** Implement deterministic logical agents and coordinator wiring on top of the Phase 0 orchestrator and Phase 1 local tools.

---

### What to Build:

1. **src/agents/mock_agents.ts**
   - Implement local deterministic agents for context reading, planning, test design, implementation summary, verification, code review, and traceability.
   - Extend `BaseAgent`.
   - Use structured `AgentInput`, `AgentOutput`, and `AgentRunResult`.

2. **src/orchestrator/agent_coordinator.ts**
   - Execute logical agents sequentially.
   - Pass artifact paths between agents.
   - Track state, decisions, findings, and blockers.

3. **src/orchestrator/full_workflow_runner.ts**
   - Run requirement -> context -> plan -> tests -> implementation summary -> verification -> review -> final report.
   - Use local tools only.
   - Write all artifacts to `.ai_runs/`.

---

### Success Criteria:

- [ ] Agents return structured `AgentRunResult` objects.
- [ ] Coordinator runs agents sequentially with traceable inputs/outputs.
- [ ] Workflow writes context pack, task plan, test plan, implementation summary, verification report, code review report, traceability report, and final report.
- [ ] Verification command results are recorded in `ProjectState`.
- [ ] Code review is generated.
- [ ] Unit tests cover successful full workflow and failure/blocker behavior.
- [ ] TypeScript build passes.
- [ ] Tests pass.

---

### Do NOT:

- Add real LLM calls yet.
- Add network-dependent tools.
- Add parallel agent execution.
- Modify application product features outside the workflow core.

**First prove the complete agent chain deterministically before adding real LLM integration.**

---

### Prerequisites Met:

- Type contracts
- Project state model
- Artifact store
- Prompt registry
- Project Manager orchestrator scaffold
- Local tool integration
- Phase 1 tests passing (54/54)
