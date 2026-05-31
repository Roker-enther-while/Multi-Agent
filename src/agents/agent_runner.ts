/**
 * AGENT RUNNER — Dispatcher chọn mock/real/hybrid để chạy agent
 *
 * [1] Nguồn tham khảo:
 *   - Strategy Pattern (GoF): runtime mode selection
 *   - 12-Factor App: configuration qua environment variables
 *   - Self-Refine (Madaan et al., 2023): LLM tự sửa output
 *
 * [2] Điểm khác biệt:
 *   - Hybrid mode: mock-first, LLM-refine. Chỉ dùng output LLM nếu dài hơn mock (original heuristic)
 *   - Fallback chain: real fail → error; hybrid fail → mock (custom resilience)
 *
 * [3] Mục tiêu: Hỗ trợ 3 chế độ chạy agent (mock/real/hybrid)
 */

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

/**
 * Đọc chế độ thực thi từ env var AGENT_EXECUTION_MODE
 * [1] Nguồn: 12-Factor App config pattern
 * [2] Khác biệt: Mặc định "mock" (không cần API key)
 * [3] Mục tiêu: Xác định agent chạy bằng mock, real LLM, hay hybrid
 */
export function getExecutionMode(): ExecutionMode {
  const mode = process.env.AGENT_EXECUTION_MODE || "mock";
  if (mode === "real" || mode === "hybrid") return mode;
  return "mock";
}

/**
 * Chạy agent với chế độ đã cấu hình
 * [1] Nguồn: Strategy Pattern (GoF), Self-Refine pattern
 * [2] Khác biệt: Hybrid mode — mock-first, LLM-refine gated by output length (original)
 * [3] Mục tiêu: Dispatch tới mock, real LLM, hoặc hybrid execution
 */
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
