import type { AgentName } from "../types/agents";
import type { ArtifactRef } from "../types/artifacts";
import type { ModelProvider } from "../server/model_provider";
import { assemblePrompt, type PromptContext } from "../prompts/prompt_assembler";
import { validateAgentOutput, buildCorrectionPrompt, type ValidationResult } from "./output_validator";

export interface LlmAgentRequest {
  agentName: AgentName;
  requirement: string;
  artifacts: ArtifactRef[];
  codeSummary?: unknown;
  verificationResults?: unknown[];
  extra?: Record<string, unknown>;
}

export interface LlmAgentResponse {
  status: "done" | "failed" | "blocked";
  content: string;
  validation: ValidationResult;
  provider?: string;
  model?: string;
  latencyMs?: number;
  retries: number;
}

export async function runLlmAgent(
  request: LlmAgentRequest,
  provider: ModelProvider,
  modelName: string
): Promise<LlmAgentResponse> {
  const context: PromptContext = {
    requirement: request.requirement,
    artifacts: request.artifacts,
    codeSummary: request.codeSummary,
    verificationResults: request.verificationResults,
    extra: request.extra,
  };

  const startTime = Date.now();
  let retries = 0;
  let content = "";
  let validation: ValidationResult = { valid: false, missingSections: [], warnings: [] };

  // First attempt
  try {
    const prompt = assemblePrompt(request.agentName, context);
    const response = await provider.generate(prompt.system + "\n\n" + prompt.user);
    content = response.content;
    validation = validateAgentOutput(request.agentName, content);
  } catch (err) {
    return {
      status: "failed",
      content: "",
      validation: { valid: false, missingSections: [], warnings: [err instanceof Error ? err.message : "Unknown error"] },
      provider: provider.name,
      model: modelName,
      latencyMs: Date.now() - startTime,
      retries: 0,
    };
  }

  // Retry with correction if validation fails
  if (!validation.valid && retries < 1) {
    retries = 1;
    try {
      const correctionPrompt = buildCorrectionPrompt(request.agentName, content, validation);
      const response = await provider.generate(correctionPrompt);
      content = response.content;
      validation = validateAgentOutput(request.agentName, content);
    } catch {
      // Keep original content if retry fails
    }
  }

  return {
    status: validation.valid ? "done" : "blocked",
    content,
    validation,
    provider: provider.name,
    model: modelName,
    latencyMs: Date.now() - startTime,
    retries,
  };
}
