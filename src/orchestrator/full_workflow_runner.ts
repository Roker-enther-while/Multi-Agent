import { AgentCoordinator, type AgentCoordinatorOptions, type AgentCoordinatorResult } from "./agent_coordinator";

export interface FullWorkflowRunnerOptions extends AgentCoordinatorOptions {}

export async function runFullWorkflow(
  requirement: string,
  options: FullWorkflowRunnerOptions = {}
): Promise<AgentCoordinatorResult> {
  const coordinator = new AgentCoordinator(options);
  return coordinator.run(requirement, options);
}
