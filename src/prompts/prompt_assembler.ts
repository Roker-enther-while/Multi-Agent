import type { AgentName } from "../types/agents";
import type { ArtifactRef } from "../types/artifacts";

export interface PromptContext {
  requirement: string;
  artifacts: ArtifactRef[];
  codeSummary?: unknown;
  verificationResults?: unknown[];
  extra?: Record<string, unknown>;
}

export interface AssembledPrompt {
  system: string;
  user: string;
  maxTokens: number;
}

const AGENT_SYSTEM_PROMPTS: Partial<Record<AgentName, string>> = {
  project_manager: `You are a Project Manager agent. Your job is to orchestrate the workflow and manage project state.
Output format: Markdown with workflow status, decisions, and next steps.`,

  context_reader: `You are a Context Reader agent. Your job is to analyze a software requirement and identify relevant files, modules, and context from the repository.
Output format: Markdown with sections for Requirement, Requirement Analysis (type, subject, endpoints, fields, constraints), Likely Relevant Files, and Repository Context.`,

  ba_artifact: `You are a Business Analyst agent. Your job is to create a BA Requirement Package from a software requirement.
Output format: Markdown with sections for Requirement Summary, User Stories, Acceptance Criteria, Flow, API Draft, Data Draft, UI Draft.
Each user story must follow: "As a [role], I want [feature] so that [benefit]."
Acceptance criteria must be testable: "Given [context], when [action], then [result]."`,

  visual_modeling: `You are a Visual Modeling agent. Your job is to create visual diagrams for a software requirement.
Output format: Markdown with Mermaid code blocks for Workflow Diagram, State Diagram, and Data Relationship diagram.
Diagrams must be specific to the requirement, not generic.`,

  senior_layer: `You are a Senior Software Engineer agent. Your job is to evaluate a requirement using structured value gates.
Output format: Markdown with gates (problem_framing, scope_decision, risk_assessment, architecture_judgment, priority_decision, quality_gate, handoff) and scores (traceability_score, test_readiness_score, scope_risk_score, architecture_fit_score).`,

  planner: `You are a Planner agent. Your job is to create a task plan from a requirement and context.
Output format: Markdown with numbered steps specific to the requirement type (endpoint, validation, bug fix, etc.).`,

  test_designer: `You are a Test Designer agent. Your job is to create comprehensive test cases for a requirement.
Output format: Markdown with sections: Positive Tests, Negative Tests, Edge Cases, Regression Tests, Requirement-Specific Scenarios.
Each test case must have: ID, description, and specific steps.`,

  implementation: `You are an Implementation agent. Your job is to provide implementation guidance for a requirement.
Output format: Markdown with Target, Files to create or modify, and Implementation steps specific to the requirement type.`,

  test_runner_debugger: `You are a Test Runner agent. Your job is to execute verification commands and report results.
Output format: Markdown with pass/fail status for each command.`,

  code_reviewer: `You are a Code Reviewer agent. Your job is to review a requirement and its implementation for quality, correctness, and risk.
Output format: Markdown with Requirement Coverage, Type-Specific Findings, and Risk Assessment sections.`,

  reporter_traceability: `You are a Traceability Reporter agent. Your job is to create a traceability report linking requirement to all artifacts.
Output format: Markdown with Requirement and Artifact Chain sections linking context, plan, test, implementation, verification, and review.`,
};

const MAX_CONTEXT_LENGTH = 8000;

export function assemblePrompt(
  agentName: AgentName,
  context: PromptContext
): AssembledPrompt {
  const system = AGENT_SYSTEM_PROMPTS[agentName] || `You are a ${agentName} agent.`;

  const userParts: string[] = [];
  userParts.push(`## Requirement\n${context.requirement}`);

  // Add relevant artifacts
  if (context.artifacts.length > 0) {
    userParts.push("\n## Previous Artifacts");
    for (const artifact of context.artifacts.slice(-5)) {
      userParts.push(`- ${artifact.type}: ${artifact.path}`);
    }
  }

  // Add code summary if available
  if (context.codeSummary && typeof context.codeSummary === "object") {
    const summary = context.codeSummary as { totalFiles?: number; files?: string[] };
    userParts.push(`\n## Repository Context\n- Total files: ${summary.totalFiles ?? "unknown"}`);
    if (summary.files && summary.files.length > 0) {
      userParts.push(`- Key files: ${summary.files.slice(0, 20).join(", ")}`);
    }
  }

  // Add verification results if available
  if (context.verificationResults && context.verificationResults.length > 0) {
    userParts.push("\n## Verification Results");
    for (const result of context.verificationResults) {
      const r = result as { command?: string; passed?: boolean };
      userParts.push(`- ${r.command}: ${r.passed ? "PASS" : "FAIL"}`);
    }
  }

  // Add output format instruction
  userParts.push("\n## Output Format");
  userParts.push("Respond in valid Markdown. Include all required sections. Do not include explanations outside the Markdown output.");

  let user = userParts.join("\n");

  // Truncate if too long
  if (user.length > MAX_CONTEXT_LENGTH) {
    user = user.slice(0, MAX_CONTEXT_LENGTH) + "\n\n[Context truncated due to length]";
  }

  return {
    system,
    user,
    maxTokens: 4096,
  };
}

export function getAgentNames(): AgentName[] {
  return Object.keys(AGENT_SYSTEM_PROMPTS) as AgentName[];
}
