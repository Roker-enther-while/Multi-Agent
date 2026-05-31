import type { AgentName, AgentInput, AgentRunResult } from "../types/agents";
import type { ModelProvider } from "../server/model_provider";
import { runLlmAgent } from "./llm_agent";
import { validateAgentOutput } from "./output_validator";

export type ExecutionMode = "mock" | "real" | "hybrid";

export interface AgentRunnerConfig {
  mode: ExecutionMode;
  provider: ModelProvider;
  modelName: string;
}

export function getExecutionMode(): ExecutionMode {
  const mode = process.env.AGENT_EXECUTION_MODE || "mock";
  if (mode === "real" || mode === "hybrid") return mode;
  return "mock";
}

export async function runAgentWithMode(
  agentName: AgentName,
  input: AgentInput,
  mockExecute: (input: AgentInput) => AgentRunResult,
  config: AgentRunnerConfig
): Promise<AgentRunResult> {
  // In mock mode, always use mock
  if (config.mode === "mock") {
    return mockExecute(input);
  }

  // In real mode, try LLM first
  if (config.mode === "real") {
    try {
      const result = await runLlmAgent(
        {
          agentName,
          requirement: input.requirement || "",
          artifacts: [],
          codeSummary: input.extra?.codeSummary,
          verificationResults: input.extra?.verificationResults as unknown[],
          extra: input.extra as Record<string, unknown>,
        },
        config.provider,
        config.modelName
      );

      if (result.status === "done" || result.status === "blocked") {
        return {
          agent: agentName,
          status: result.status === "done" ? "completed" : "blocked",
          startedAt: new Date(Date.now() - (result.latencyMs || 0)).toISOString(),
          endedAt: new Date().toISOString(),
          output: {
            report: result.content,
            artifacts: [],
            decisions: [],
            findings: result.validation.warnings.map((w) => ({
              severity: "info" as const,
              category: "other" as const,
              description: w,
            })),
          },
        };
      }
    } catch (err) {
      // Fall through to error
    }

    return {
      agent: agentName,
      status: "failed",
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      error: "LLM agent execution failed",
    };
  }

  // Hybrid mode: mock first, then refine with LLM
  if (config.mode === "hybrid") {
    const mockResult = mockExecute(input);

    if (!mockResult.output) return mockResult;

    try {
      const llmResult = await runLlmAgent(
        {
          agentName,
          requirement: input.requirement || "",
          artifacts: [],
          codeSummary: input.extra?.codeSummary,
          verificationResults: input.extra?.verificationResults as unknown[],
          extra: input.extra as Record<string, unknown>,
        },
        config.provider,
        config.modelName
      );

      if (llmResult.status === "done" && llmResult.content.length > mockResult.output.report.length) {
        return {
          ...mockResult,
          output: {
            ...mockResult.output,
            report: llmResult.content,
          },
        };
      }
    } catch {
      // Fall back to mock result
    }

    return mockResult;
  }

  return mockExecute(input);
}
