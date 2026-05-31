import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { createInitialProjectState, addArtifact, addVerificationResult } from "../state/project_state";
import { buildDemoManifest } from "./demo_manifest";
import type { AgentCoordinatorResult } from "../orchestrator/agent_coordinator";
import type { ArtifactType } from "../types/artifacts";

const REQUIRED_TYPES: ArtifactType[] = [
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

describe("buildDemoManifest", () => {
  it("should summarize artifacts, verification, blockers, and final prerequisites", () => {
    let state = createInitialProjectState({
      requirement: "Demo requirement",
      runId: "demo",
    });
    state = { ...state, status: "completed" };

    for (const type of REQUIRED_TYPES) {
      state = addArtifact(state, {
        id: `${type}-id`,
        type,
        path: `/runs/demo/${type}.md`,
        createdAt: "2026-05-31T00:00:00.000Z",
        producedBy: "reporter_traceability",
      });
    }

    state = addVerificationResult(state, {
      command: "npm test",
      passed: true,
      exitCode: 0,
      stdout: "pass",
      stderr: "",
      runAt: "2026-05-31T00:00:00.000Z",
      durationMs: 25,
    });

    const result: AgentCoordinatorResult = {
      state,
      runDir: "/runs/demo",
      artifacts: state.artifacts,
      agentResults: [],
      findings: [],
    };

    const manifest = buildDemoManifest(result);

    assert.equal(manifest.runId, "demo");
    assert.equal(manifest.artifactCount, 11);
    assert.equal(manifest.artifacts.final_report, "/runs/demo/final_report.md");
    assert.equal(manifest.verification.allPassed, true);
    assert.equal(manifest.blockers.count, 0);
    assert.deepEqual(manifest.finalProjectDonePrerequisites, {
      traceabilityProven: true,
      verificationPassed: true,
      codeReviewGenerated: true,
      finalReportGenerated: true,
    });
    assert.equal(manifest.finalValidation.passed, true);
  });
});
