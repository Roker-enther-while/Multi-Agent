# NEXT STEP

## Current Actionable Next Step

**Phase:** Phase 0 — Project Manager Orchestrator Scaffold

**Priority:** HIGH

**Action:** Create the minimal orchestrator scaffold to prove the PM workflow can manage and document the process.

---

### What to Build:

1. **src/orchestrator/pm_orchestrator.ts**
   - Main orchestrator that coordinates the PM workflow
   - Uses: ProjectState, ArtifactStore, PromptRegistry
   - Implements: requirement → context pack → task plan → report

2. **src/agents/base_agent.ts**
   - Base class/interface for all logical agents
   - Uses: AgentInput, AgentOutput, AgentRunResult
   - Common methods: execute(), report(), validate()

3. **src/orchestrator/workflow_runner.ts**
   - Runs a complete workflow from requirement to final report
   - Creates steps, tracks state, writes artifacts

---

### Success Criteria:

- [ ] Orchestrator can receive a requirement string
- [ ] Orchestrator creates a ProjectState
- [ ] Orchestrator creates a Context Pack (mocked or real)
- [ ] Orchestrator generates a Task Plan (mocked or real)
- [ ] Orchestrator produces a Traceability Report
- [ ] All artifacts are written to .ai_runs/
- [ ] All outputs are structured and traceable
- [ ] Tests pass

---

### Do NOT:

- Implement real LLM calls yet
- Build complex tool execution yet
- Add parallel agent execution yet

**First prove the system can manage and document the process.**

---

### Prerequisites Met:

- ✅ Type contracts (agents, artifacts, workflow)
- ✅ Project state model (pure functions)
- ✅ Artifact store (filesystem)
- ✅ Prompt registry (all 9 agents)
- ✅ Tests passing (39/39)
