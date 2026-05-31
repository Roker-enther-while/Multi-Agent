import { PMOrchestrator, type PMOrchestratorOptions, type PMWorkflowResult } from "./pm_orchestrator";

export interface WorkflowRunnerOptions extends PMOrchestratorOptions {}

export function runWorkflow(
  requirement: string,
  options: WorkflowRunnerOptions = {}
): PMWorkflowResult {
  const orchestrator = new PMOrchestrator(options);
  return orchestrator.run(requirement, options);
}
