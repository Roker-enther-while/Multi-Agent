import * as fs from "fs";
import * as path from "path";

import type { AgentCoordinatorResult } from "../orchestrator/agent_coordinator";
import type { ArtifactType } from "../types/artifacts";
import { readArtifact } from "./artifact_store";

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

export interface ProductizationValidatorOptions extends FinalDoneValidatorOptions {
  cliHelpOutput?: string;
  htmlReportPath?: string;
  evaluationPassed?: boolean;
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

export function validateProductizationDone(
  result: AgentCoordinatorResult,
  options: ProductizationValidatorOptions = {}
): FinalDoneValidation {
  const base = validateFinalDone(result, options);
  const artifactTypes = new Set(result.artifacts.map((artifact) => artifact.type));
  const artifactByType = new Map(result.artifacts.map((artifact) => [artifact.type, artifact]));
  const repoRoot = options.repoRoot;
  const requiredDocs = [
    "docs/problem_statement.md",
    "docs/system_design.md",
    "docs/agent_workflow.md",
    "docs/evaluation_method.md",
    "docs/demo_script.md",
    "README.md",
    "AGENTS.md",
  ];
  const missingDocs = repoRoot
    ? requiredDocs.filter((file) => !fs.existsSync(path.join(repoRoot, file)))
    : [];
  const tasksDir = repoRoot ? path.join(repoRoot, "examples/evaluation_tasks") : undefined;
  const taskFiles = tasksDir && fs.existsSync(tasksDir)
    ? fs.readdirSync(tasksDir).filter((file) => file.endsWith(".md"))
    : [];
  const seniorReview = artifactByType.get("senior_review");
  const finalReport = artifactByType.get("final_report");
  const seniorContent = seniorReview ? readArtifact(seniorReview.path) : "";
  const finalContent = finalReport ? readArtifact(finalReport.path) : "";
  const seniorMarkers = [
    "problem_framing",
    "scope_decision",
    "risk_assessment",
    "architecture_judgment",
    "priority_decision",
    "quality_gate",
    "handoff",
    "traceability_score",
    "test_readiness_score",
    "scope_risk_score",
    "architecture_fit_score",
  ];
  const missingSeniorMarkers = seniorMarkers.filter((marker) => {
    return !seniorContent.includes(marker) && !finalContent.includes(marker);
  });

  const checks: FinalDoneCheck[] = [
    ...base.checks,
    {
      id: "cli_help",
      label: "CLI help works",
      passed: Boolean(options.cliHelpOutput)
        && ["run", "demo", "validate", "inspect", "report"].every((command) => options.cliHelpOutput?.includes(command)),
      evidence: options.cliHelpOutput ? "CLI help output contains required commands" : "CLI help output not provided",
    },
    {
      id: "html_report",
      label: "HTML report generated",
      passed: Boolean(options.htmlReportPath) && fs.existsSync(options.htmlReportPath as string),
      evidence: options.htmlReportPath ?? "HTML report path not provided",
    },
    {
      id: "ba_visual_artifacts",
      label: "BA and visual artifacts generated",
      passed: artifactTypes.has("ba_requirement_package") && artifactTypes.has("visual_model_package"),
      evidence: `ba=${artifactTypes.has("ba_requirement_package")}, visual=${artifactTypes.has("visual_model_package")}`,
    },
    {
      id: "senior_gates",
      label: "Senior gates and scores generated",
      passed: missingSeniorMarkers.length === 0,
      evidence: missingSeniorMarkers.length === 0
        ? "all senior gates and scores present"
        : `missing markers: ${missingSeniorMarkers.join(", ")}`,
    },
    {
      id: "evaluation_task_set",
      label: "Evaluation task set exists and passes",
      passed: taskFiles.length >= 5
        && Boolean(repoRoot && fs.existsSync(path.join(repoRoot, "examples/evaluation_tasks/expected_checklist.json")))
        && options.evaluationPassed === true,
      evidence: `tasks=${taskFiles.length}, evaluationPassed=${options.evaluationPassed === true}`,
    },
    {
      id: "docs_ready",
      label: "Thesis and demo docs are ready",
      passed: repoRoot ? missingDocs.length === 0 : false,
      evidence: repoRoot
        ? `missing=${missingDocs.join(", ") || "(none)"}`
        : "repoRoot not provided",
    },
  ];

  return {
    passed: checks.every((check) => check.passed),
    checks,
  };
}
