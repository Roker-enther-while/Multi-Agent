# NEXT STEP

## v1.1 — Real LLM Execution

**Goal:** Add real LLM agent execution mode alongside existing mock mode.

**Config:**
- AGENT_EXECUTION_MODE=mock|real|hybrid

**Files to create:**
- src/agents/llm_agent.ts — LLM agent runner
- src/agents/agent_runner.ts — Agent execution dispatcher
- src/prompts/prompt_assembler.ts — Prompt assembly from context
- src/agents/output_validator.ts — Validate LLM output format

**Files to modify:**
- src/server/routes.ts — Add agent API endpoints
- src/server/model_provider.ts — Add agent execution mode
- src/server/public/index.html — Add execution mode setting

**Verification:** Tests pass, mock mode works, real mode calls provider abstraction.
