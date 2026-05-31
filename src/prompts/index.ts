/**
 * Prompt registry for the Multi-Agent AI workflow.
 *
 * Exports all available prompt constants.
 * Agents that do not have prompts yet (BA Artifact, Visual Modeling)
 * are reserved in types but not exported here.
 */

export { PROJECT_MANAGER_PROMPT } from "./projectManagerPrompt";
export { SENIOR_LAYER_PROMPT } from "./seniorLayerPrompt";
export { CONTEXT_READER_PROMPT } from "./contextReaderPrompt";
export { PLANNER_PROMPT } from "./plannerPrompt";
export { TEST_DESIGNER_PROMPT } from "./testDesignerPrompt";
export { IMPLEMENTATION_AGENT_PROMPT } from "./implementationAgentPrompt";
export { TEST_RUNNER_DEBUGGER_PROMPT } from "./testRunnerDebuggerPrompt";
export { CODE_REVIEWER_PROMPT } from "./codeReviewerPrompt";
export { REPORTER_TRACEABILITY_PROMPT } from "./reporterTraceabilityPrompt";

/**
 * Map from agent name to its prompt constant.
 * Useful for dynamic prompt lookup by the orchestrator.
 */
import { PROJECT_MANAGER_PROMPT } from "./projectManagerPrompt";
import { SENIOR_LAYER_PROMPT } from "./seniorLayerPrompt";
import { CONTEXT_READER_PROMPT } from "./contextReaderPrompt";
import { PLANNER_PROMPT } from "./plannerPrompt";
import { TEST_DESIGNER_PROMPT } from "./testDesignerPrompt";
import { IMPLEMENTATION_AGENT_PROMPT } from "./implementationAgentPrompt";
import { TEST_RUNNER_DEBUGGER_PROMPT } from "./testRunnerDebuggerPrompt";
import { CODE_REVIEWER_PROMPT } from "./codeReviewerPrompt";
import { REPORTER_TRACEABILITY_PROMPT } from "./reporterTraceabilityPrompt";

import type { AgentName } from "../types/agents";

/**
 * Lookup table from AgentName to prompt string.
 * Agents without prompts (ba_artifact, visual_modeling) map to undefined.
 */
export const PROMPT_REGISTRY: Partial<Record<AgentName, string>> = {
  project_manager: PROJECT_MANAGER_PROMPT,
  senior_layer: SENIOR_LAYER_PROMPT,
  context_reader: CONTEXT_READER_PROMPT,
  planner: PLANNER_PROMPT,
  test_designer: TEST_DESIGNER_PROMPT,
  implementation: IMPLEMENTATION_AGENT_PROMPT,
  test_runner_debugger: TEST_RUNNER_DEBUGGER_PROMPT,
  code_reviewer: CODE_REVIEWER_PROMPT,
  reporter_traceability: REPORTER_TRACEABILITY_PROMPT,
};

/**
 * Get the prompt for a given agent name.
 *
 * @param agentName - The agent to get the prompt for.
 * @returns The prompt string, or undefined if no prompt exists for this agent.
 */
export function getPrompt(agentName: AgentName): string | undefined {
  return PROMPT_REGISTRY[agentName];
}
