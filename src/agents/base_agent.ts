import type {
  AgentInput,
  AgentName,
  AgentOutput,
  AgentRunResult,
} from "../types/agents";

export interface AgentValidationResult {
  valid: boolean;
  errors: string[];
}

export interface WorkflowAgent {
  readonly name: AgentName;
  execute(input: AgentInput): Promise<AgentRunResult> | AgentRunResult;
  report(result: AgentRunResult): string;
  validate(output: AgentOutput): AgentValidationResult;
}

export abstract class BaseAgent implements WorkflowAgent {
  public constructor(public readonly name: AgentName) {}

  public abstract execute(input: AgentInput): Promise<AgentRunResult> | AgentRunResult;

  public report(result: AgentRunResult): string {
    if (result.status !== "completed" || !result.output) {
      return `# ${this.name} Report\n\nStatus: ${result.status}`;
    }

    return result.output.report;
  }

  public validate(output: AgentOutput): AgentValidationResult {
    const errors: string[] = [];

    if (!output.report.trim()) {
      errors.push("Agent output report is required.");
    }

    for (const artifact of output.artifacts) {
      if (!artifact.id || !artifact.type || !artifact.path) {
        errors.push(`Artifact ${artifact.id || "(missing id)"} is incomplete.`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
