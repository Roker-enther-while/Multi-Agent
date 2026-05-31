import type { ArtifactRef } from "../types/artifacts";
import type { ProjectState } from "../state/project_state";

export interface ReportGeneratorOptions {
  title?: string;
  artifacts?: ArtifactRef[];
}

export function generateWorkflowReport(
  state: ProjectState,
  options: ReportGeneratorOptions = {}
): string {
  const artifacts = options.artifacts ?? state.artifacts;
  const lines: string[] = [
    `# ${options.title ?? "Workflow Traceability Report"}`,
    "",
    "## Requirement",
    state.requirement,
    "",
    "## Run Summary",
    `- Run ID: ${state.runId}`,
    `- Status: ${state.status}`,
    `- Steps: ${state.steps.length}`,
    `- Artifacts: ${artifacts.length}`,
    `- Decisions: ${state.decisions.length}`,
    `- Blockers: ${state.blockers.length}`,
    "",
    "## Traceability",
  ];

  if (artifacts.length === 0) {
    lines.push("- No artifacts recorded.");
  } else {
    for (const artifact of artifacts) {
      lines.push(`- ${artifact.type}: ${artifact.id} -> ${artifact.path}`);
    }
  }

  lines.push("", "## Verification Evidence");
  if (state.verificationResults.length === 0) {
    lines.push("- No verification results recorded.");
  } else {
    for (const result of state.verificationResults) {
      lines.push(`- ${result.passed ? "PASS" : "FAIL"}: ${result.command} (exit ${result.exitCode})`);
    }
  }

  lines.push("", "## Decisions");
  if (state.decisions.length === 0) {
    lines.push("- No decisions recorded.");
  } else {
    for (const decision of state.decisions) {
      lines.push(`- ${decision.decision}: ${decision.rationale}`);
    }
  }

  lines.push("", "## Blockers");
  if (state.blockers.length === 0) {
    lines.push("- No blockers recorded.");
  } else {
    for (const blocker of state.blockers) {
      lines.push(`- ${blocker.resolved ? "RESOLVED" : "OPEN"}: ${blocker.reason}`);
    }
  }

  return lines.join("\n");
}
