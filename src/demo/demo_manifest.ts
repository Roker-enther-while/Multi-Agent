import type { AgentCoordinatorResult } from "../orchestrator/agent_coordinator";
import type { ArtifactType } from "../types/artifacts";
import { validateFinalDone, type FinalDoneValidation } from "../tools/final_done_validator";

export interface DemoManifestOptions {
  repoRoot?: string;
}

export interface DemoManifest {
  runId: string;
  status: string;
  requirement: string;
  runDir: string;
  artifactCount: number;
  artifacts: Record<string, string>;
  verification: {
    total: number;
    passed: number;
    failed: number;
    allPassed: boolean;
  };
  blockers: {
    count: number;
    reasons: string[];
  };
  finalProjectDonePrerequisites: {
    traceabilityProven: boolean;
    verificationPassed: boolean;
    codeReviewGenerated: boolean;
    finalReportGenerated: boolean;
  };
  finalValidation: FinalDoneValidation;
}

const REQUIRED_ARTIFACTS: ArtifactType[] = [
  "context_pack",
  "task_plan",
  "test_plan",
  "implementation_summary",
  "verification_report",
  "code_review_report",
  "traceability_report",
  "final_report",
];

export function buildDemoManifest(
  result: AgentCoordinatorResult,
  options: DemoManifestOptions = {}
): DemoManifest {
  const artifacts = Object.fromEntries(
    result.artifacts.map((artifact) => [artifact.type, artifact.path])
  );
  const failed = result.state.verificationResults.filter((item) => !item.passed);
  const passed = result.state.verificationResults.filter((item) => item.passed);

  return {
    runId: result.state.runId,
    status: result.state.status,
    requirement: result.state.requirement,
    runDir: result.runDir,
    artifactCount: result.artifacts.length,
    artifacts,
    verification: {
      total: result.state.verificationResults.length,
      passed: passed.length,
      failed: failed.length,
      allPassed: failed.length === 0 && result.state.verificationResults.length > 0,
    },
    blockers: {
      count: result.state.blockers.filter((blocker) => !blocker.resolved).length,
      reasons: result.state.blockers.filter((blocker) => !blocker.resolved).map((blocker) => blocker.reason),
    },
    finalProjectDonePrerequisites: {
      traceabilityProven: REQUIRED_ARTIFACTS.every((type) => Boolean(artifacts[type])),
      verificationPassed: failed.length === 0 && result.state.verificationResults.length > 0,
      codeReviewGenerated: Boolean(artifacts.code_review_report),
      finalReportGenerated: Boolean(artifacts.final_report),
    },
    finalValidation: validateFinalDone(result, { repoRoot: options.repoRoot }),
  };
}
