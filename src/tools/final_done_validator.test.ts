import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { addArtifact, addVerificationResult, createInitialProjectState } from "../state/project_state";
import { validateFinalDone } from "./final_done_validator";
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

let repoRoot: string;

function cleanup(dir: string): void {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function createResult(options: { omit?: ArtifactType[]; verificationPassed?: boolean } = {}): AgentCoordinatorResult {
  let state = createInitialProjectState({
    requirement: "Validate final done",
    runId: "final-done",
  });
  state = { ...state, status: "completed" };

  for (const type of REQUIRED_TYPES) {
    if (options.omit?.includes(type)) continue;
    state = addArtifact(state, {
      id: `${type}-id`,
      type,
      path: `/runs/final-done/${type}.md`,
      createdAt: "2026-05-31T00:00:00.000Z",
      producedBy: "reporter_traceability",
    });
  }

  state = addVerificationResult(state, {
    command: "npm test",
    passed: options.verificationPassed ?? true,
    exitCode: options.verificationPassed === false ? 1 : 0,
    stdout: "",
    stderr: options.verificationPassed === false ? "failed" : "",
    runAt: "2026-05-31T00:00:00.000Z",
    durationMs: 10,
  });

  return {
    state,
    runDir: "/runs/final-done",
    artifacts: state.artifacts,
    agentResults: [],
    findings: [],
  };
}

describe("validateFinalDone", () => {
  beforeEach(() => {
    repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "final-done-validator-"));
    for (const file of ["AGENT_REPORT.md", "PHASE_LOG.md", "NEXT_STEP.md"]) {
      fs.writeFileSync(path.join(repoRoot, file), "# test\n", "utf-8");
    }
  });

  afterEach(() => {
    cleanup(repoRoot);
  });

  it("should pass when all final done evidence is present", () => {
    const validation = validateFinalDone(createResult(), { repoRoot });

    assert.equal(validation.passed, true);
    assert.ok(validation.checks.every((check) => check.passed));
  });

  it("should fail when required artifacts are missing", () => {
    const validation = validateFinalDone(
      createResult({ omit: ["traceability_report"] }),
      { repoRoot }
    );

    assert.equal(validation.passed, false);
    assert.equal(validation.checks.find((check) => check.id === "traceability")?.passed, false);
  });

  it("should fail when verification fails", () => {
    const validation = validateFinalDone(
      createResult({ verificationPassed: false }),
      { repoRoot }
    );

    assert.equal(validation.passed, false);
    assert.equal(validation.checks.find((check) => check.id === "verification")?.passed, false);
  });
});
