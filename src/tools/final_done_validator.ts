import * as fs from "fs";
import * as path from "path";

import type { AgentCoordinatorResult } from "../orchestrator/agent_coordinator";
import type { ArtifactType } from "../types/artifacts";

export interface FinalDoneCheck {
  id: string;
  label: string;
  passed: boolean;
  evidence: string;
}

export interface FinalDoneValidation {
  passed: boolean;
  checks: FinalDoneCheck[];
}

export interface FinalDoneValidatorOptions {
  repoRoot?: string;
}

const REQUIRED_ARTIFACTS: ArtifactType[] = [
  "context_pack",
  "ba_requirement_package",
  "visual_model_package",
  "senior_review",
  "task_plan",
  "test_plan",
  "implementation_summary",
  "verification_report",
  "code_review_report",
  "traceability_report",
  "final_report",
];

const REQUIRED_REPORT_FILES = [
  "AGENT_REPORT.md",
  "PHASE_LOG.md",
  "NEXT_STEP.md",
];

export function validateFinalDone(
  result: AgentCoordinatorResult,
  options: FinalDoneValidatorOptions = {}
): FinalDoneValidation {
  const artifactTypes = new Set(result.artifacts.map((artifact) => artifact.type));
  const missingArtifacts = REQUIRED_ARTIFACTS.filter((type) => !artifactTypes.has(type));
  const unresolvedBlockers = result.state.blockers.filter((blocker) => !blocker.resolved);
  const failedVerification = result.state.verificationResults.filter((item) => !item.passed);
  const reportFiles = options.repoRoot
    ? REQUIRED_REPORT_FILES.filter((file) => fs.existsSync(path.join(options.repoRoot as string, file)))
    : [];
  const missingReportFiles = options.repoRoot
    ? REQUIRED_REPORT_FILES.filter((file) => !fs.existsSync(path.join(options.repoRoot as string, file)))
    : [];

  const checks: FinalDoneCheck[] = [
    {
      id: "end_to_end_demo",
      label: "End-to-end demo works: requirement -> report",
      passed: result.state.status === "completed" && artifactTypes.has("final_report") && unresolvedBlockers.length === 0,
      evidence: `status=${result.state.status}, final_report=${artifactTypes.has("final_report")}, unresolved_blockers=${unresolvedBlockers.length}`,
    },
    {
      id: "traceability",
      label: "Traceability is proven",
      passed: missingArtifacts.length === 0 && artifactTypes.has("traceability_report"),
      evidence: missingArtifacts.length === 0
        ? `all required artifacts present (${REQUIRED_ARTIFACTS.length})`
        : `missing artifacts: ${missingArtifacts.join(", ")}`,
    },
    {
      id: "verification",
      label: "All verification passes",
      passed: result.state.verificationResults.length > 0 && failedVerification.length === 0,
      evidence: `total=${result.state.verificationResults.length}, failed=${failedVerification.length}`,
    },
    {
      id: "code_review",
      label: "Code review is generated",
      passed: artifactTypes.has("code_review_report"),
      evidence: `code_review_report=${artifactTypes.has("code_review_report")}`,
    },
    {
      id: "reports_logs",
      label: "Reports and logs are present",
      passed: options.repoRoot ? missingReportFiles.length === 0 : true,
      evidence: options.repoRoot
        ? `present=${reportFiles.join(", ") || "(none)"}; missing=${missingReportFiles.join(", ") || "(none)"}`
        : "repoRoot not provided; report file presence not checked",
    },
  ];

  return {
    passed: checks.every((check) => check.passed),
    checks,
  };
}
