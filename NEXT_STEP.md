# NEXT STEP

## Current Actionable Next Step

**Phase:** Phase 0 — Project Manager Orchestrator Scaffold

**Priority:** HIGH

**Action:** Create the minimal orchestrator scaffold to prove the PM workflow can manage and document the process.

---

### What to Build:

1. **src/orchestrator/pm_orchestrator.ts**
   - Main orchestrator that coordinates the PM workflow
   - Implements: requirement → context pack → task plan → report

2. **src/agents/base_agent.ts**
   - Base class/interface for all logical agents
   - Common methods: execute(), report(), validate()

3. **src/tools/index.ts**
   - Tool interfaces for file reading, code inspection, test running
   - Abstract tool registry

4. **src/state/project_state.ts**
   - Project state management
   - Tracks: current phase, completed steps, evidence, blockers

---

### Success Criteria:

- [ ] Orchestrator can receive a requirement string
- [ ] Orchestrator creates a Context Pack
- [ ] Orchestrator generates a Task Plan
- [ ] Orchestrator produces a Report
- [ ] All outputs are structured and traceable

---

### Do NOT:

- Implement full code editing yet
- Build real agent integrations yet
- Add complex tool execution yet

**First prove the system can manage and document the process.**
