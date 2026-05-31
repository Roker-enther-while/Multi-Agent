import { BaseAgent } from "./base_agent";
import type {
  AgentDecision,
  AgentFinding,
  AgentInput,
  AgentName,
  AgentOutput,
  AgentRunResult,
} from "../types/agents";
import type { VerificationResult } from "../types/workflow";

function completedResult(
  agent: AgentName,
  report: string,
  decisions: AgentDecision[] = [],
  findings: AgentFinding[] = []
): AgentRunResult {
  const startedAt = new Date().toISOString();

  const output: AgentOutput = {
    report,
    artifacts: [],
    decisions,
    findings,
  };

  return {
    agent,
    status: "completed",
    startedAt,
    endedAt: new Date().toISOString(),
    output,
  };
}

function requireText(input: AgentInput, field: "requirement"): string {
  const value = input[field];
  if (!value?.trim()) {
    throw new Error(`${field} is required.`);
  }
  return value;
}

export class MockContextReaderAgent extends BaseAgent {
  public constructor() {
    super("context_reader");
  }

  public execute(input: AgentInput): AgentRunResult {
    const requirement = requireText(input, "requirement");
    const files = input.extra?.codeSummary && typeof input.extra.codeSummary === "object"
      ? JSON.stringify(input.extra.codeSummary, null, 2)
      : "No code summary provided.";

    return completedResult(
      this.name,
      [
        "# Context Pack",
        "",
        "## Requirement",
        requirement,
        "",
        "## Repository Context",
        "```json",
        files,
        "```",
      ].join("\n")
    );
  }
}

export class MockPlannerAgent extends BaseAgent {
  public constructor() {
    super("planner");
  }

  public execute(input: AgentInput): AgentRunResult {
    const requirement = requireText(input, "requirement");

    return completedResult(
      this.name,
      [
        "# Task Plan",
        "",
        `Requirement: ${requirement}`,
        "",
        "1. Read context pack.",
        "2. Design tests.",
        "3. Summarize implementation scope.",
        "4. Run verification.",
        "5. Review and report traceability.",
        "",
        `Context Pack: ${input.contextPackPath ?? "missing"}`,
      ].join("\n"),
      [
        {
          decision: "Use sequential deterministic execution.",
          rationale: "Phase 2 excludes parallel execution and real LLM calls.",
          alternatives: ["Parallel agent execution", "Real LLM orchestration"],
          risk: "low",
        },
      ]
    );
  }
}

export class MockTestDesignerAgent extends BaseAgent {
  public constructor() {
    super("test_designer");
  }

  public execute(input: AgentInput): AgentRunResult {
    const commands = Array.isArray(input.extra?.verificationCommands)
      ? input.extra.verificationCommands
      : [];

    return completedResult(
      this.name,
      [
        "# Test Plan",
        "",
        `Task Plan: ${input.taskPlanPath ?? "missing"}`,
        "",
        "## Verification Commands",
        commands.length === 0
          ? "- No commands configured."
          : commands.map((command) => `- ${JSON.stringify(command)}`).join("\n"),
      ].join("\n")
    );
  }
}

export class MockImplementationAgent extends BaseAgent {
  public constructor() {
    super("implementation");
  }

  public execute(input: AgentInput): AgentRunResult {
    return completedResult(
      this.name,
      [
        "# Implementation Summary",
        "",
        "Phase 2 uses deterministic mock implementation output.",
        "",
        `Test Plan: ${input.testPlanPath ?? "missing"}`,
        "",
        "No product feature files were modified by this workflow run.",
      ].join("\n")
    );
  }
}

export class MockVerificationAgent extends BaseAgent {
  public constructor() {
    super("test_runner_debugger");
  }

  public execute(input: AgentInput): AgentRunResult {
    const results = (input.extra?.verificationResults ?? []) as VerificationResult[];
    const failed = results.filter((result) => !result.passed);
    const findings: AgentFinding[] = failed.map((result) => ({
      severity: "high",
      category: "test",
      description: `Verification failed: ${result.command}`,
      suggestion: result.stderr || "Inspect command output.",
    }));

    return completedResult(
      this.name,
      [
        "# Verification Report",
        "",
        results.length === 0
          ? "No verification commands were run."
          : results.map((result) => {
              const status = result.passed ? "PASS" : "FAIL";
              return `- ${status}: ${result.command} (exit ${result.exitCode}, ${result.durationMs}ms)`;
            }).join("\n"),
      ].join("\n"),
      [],
      findings
    );
  }
}

export class MockCodeReviewerAgent extends BaseAgent {
  public constructor() {
    super("code_reviewer");
  }

  public execute(input: AgentInput): AgentRunResult {
    return completedResult(
      this.name,
      [
        "# Code Review Report",
        "",
        "## Findings",
        "- No behavioral code changes were requested by the workflow input.",
        "- Deterministic workflow artifacts are present for review.",
        "",
        `Verification Report: ${input.verificationReportPath ?? "missing"}`,
      ].join("\n"),
      [],
      [
        {
          severity: "info",
          category: "quality",
          description: "Code review generated from deterministic local workflow state.",
        },
      ]
    );
  }
}

export class MockTraceabilityReporterAgent extends BaseAgent {
  public constructor() {
    super("reporter_traceability");
  }

  public execute(input: AgentInput): AgentRunResult {
    return completedResult(
      this.name,
      [
        "# Traceability Report",
        "",
        `Requirement: ${input.requirement ?? "missing"}`,
        "",
        "## Artifact Chain",
        `- Context Pack: ${input.contextPackPath ?? "missing"}`,
        `- Task Plan: ${input.taskPlanPath ?? "missing"}`,
        `- Test Plan: ${input.testPlanPath ?? "missing"}`,
        `- Implementation Summary: ${input.implementationSummaryPath ?? "missing"}`,
        `- Verification Report: ${input.verificationReportPath ?? "missing"}`,
        `- Code Review Report: ${input.codeReviewReportPath ?? "missing"}`,
      ].join("\n")
    );
  }
}

export class MockFinalReporterAgent extends BaseAgent {
  public constructor() {
    super("reporter_traceability");
  }

  public execute(input: AgentInput): AgentRunResult {
    return completedResult(
      this.name,
      [
        "# Final Report",
        "",
        `Requirement: ${input.requirement ?? "missing"}`,
        "",
        "## Result",
        "The deterministic full workflow completed and produced traceable artifacts.",
        "",
        `Traceability Report: ${input.extra?.traceabilityReportPath ?? "missing"}`,
      ].join("\n")
    );
  }
}

export function createDefaultMockAgents(): BaseAgent[] {
  return [
    new MockContextReaderAgent(),
    new MockPlannerAgent(),
    new MockTestDesignerAgent(),
    new MockImplementationAgent(),
    new MockVerificationAgent(),
    new MockCodeReviewerAgent(),
    new MockTraceabilityReporterAgent(),
    new MockFinalReporterAgent(),
  ];
}
