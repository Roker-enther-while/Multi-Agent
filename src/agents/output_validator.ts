import type { AgentName } from "../types/agents";

export interface ValidationResult {
  valid: boolean;
  missingSections: string[];
  warnings: string[];
}

const REQUIRED_SECTIONS: Partial<Record<AgentName, string[]>> = {
  project_manager: ["Status", "Decision"],
  context_reader: ["Requirement", "Requirement Analysis"],
  ba_artifact: ["Requirement Summary", "User Stories", "Acceptance Criteria"],
  visual_modeling: ["Workflow Diagram", "```mermaid"],
  senior_layer: ["problem_framing", "traceability_score"],
  planner: ["Steps", "Requirement"],
  test_designer: ["Test Cases", "Positive Tests"],
  implementation: ["Implementation", "Requirement"],
  test_runner_debugger: ["Verification Report"],
  code_reviewer: ["Findings", "Requirement"],
  reporter_traceability: ["Traceability Report", "Artifact Chain"],
};

export function validateAgentOutput(
  agentName: AgentName,
  content: string
): ValidationResult {
  const required = REQUIRED_SECTIONS[agentName] || [];
  const missingSections: string[] = [];
  const warnings: string[] = [];

  for (const section of required) {
    if (!content.includes(section)) {
      missingSections.push(section);
    }
  }

  // Check for placeholder failures
  if (content.includes("UNKNOWN") || content.includes("NEED_CONFIRMATION")) {
    warnings.push("Output contains placeholder values (UNKNOWN/NEED_CONFIRMATION)");
  }

  // Check minimum length
  if (content.length < 50) {
    warnings.push("Output is suspiciously short");
  }

  // Check for error indicators
  if (content.includes("I cannot") || content.includes("I'm unable to")) {
    warnings.push("Output contains refusal language");
  }

  return {
    valid: missingSections.length === 0,
    missingSections,
    warnings,
  };
}

export function buildCorrectionPrompt(
  agentName: AgentName,
  originalOutput: string,
  validation: ValidationResult
): string {
  const parts: string[] = [];
  parts.push("Your previous output was missing required sections:");
  for (const section of validation.missingSections) {
    parts.push(`- ${section}`);
  }
  parts.push("\nPlease regenerate the output with ALL required sections included.");
  parts.push("\nYour previous output was:");
  parts.push(originalOutput.slice(0, 2000));
  return parts.join("\n");
}
