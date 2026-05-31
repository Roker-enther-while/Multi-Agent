import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { addArtifact, addVerificationResult, createInitialProjectState } from "../state/project_state";
import { validateFinalDone, validateProductizationDone } from "./final_done_validator";
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
      path: path.join(repoRoot, "runs", "final-done", `${type}.md`),
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
    fs.mkdirSync(path.join(repoRoot, "runs", "final-done"), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, "docs"), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, "examples/evaluation_tasks"), { recursive: true });
    for (const file of [
      "docs/problem_statement.md",
      "docs/system_design.md",
      "docs/agent_workflow.md",
      "docs/evaluation_method.md",
      "docs/demo_script.md",
      "README.md",
      "AGENTS.md",
    ]) {
      fs.writeFileSync(path.join(repoRoot, file), "# test\n", "utf-8");
    }
    for (let index = 0; index < 5; index += 1) {
      fs.writeFileSync(path.join(repoRoot, "examples/evaluation_tasks", `task-${index}.md`), "# task\n", "utf-8");
    }
    fs.writeFileSync(path.join(repoRoot, "examples/evaluation_tasks/expected_checklist.json"), "{}", "utf-8");
  });

  afterEach(() => {
    cleanup(repoRoot);
  });

  it("should pass when all final done evidence is present", () => {
    const result = createResult();
    writeArtifactFiles(result);
    const validation = validateFinalDone(result, { repoRoot });

    assert.equal(validation.passed, true);
    assert.ok(validation.checks.every((check) => check.passed));
  });

  it("should fail when required artifacts are missing", () => {
    const result = createResult({ omit: ["traceability_report"] });
    writeArtifactFiles(result);
    const validation = validateFinalDone(
      result,
      { repoRoot }
    );

    assert.equal(validation.passed, false);
    assert.equal(validation.checks.find((check) => check.id === "traceability")?.passed, false);
  });

  it("should fail when verification fails", () => {
    const result = createResult({ verificationPassed: false });
    writeArtifactFiles(result);
    const validation = validateFinalDone(
      result,
      { repoRoot }
    );

    assert.equal(validation.passed, false);
    assert.equal(validation.checks.find((check) => check.id === "verification")?.passed, false);
  });

  it("should validate productization evidence", () => {
    const result = createResult();
    writeArtifactFiles(result);
    const htmlReportPath = path.join(repoRoot, "runs", "final-done", "report.html");
    fs.writeFileSync(htmlReportPath, "<html></html>", "utf-8");

    const validation = validateProductizationDone(result, {
      repoRoot,
      htmlReportPath,
      cliHelpOutput: "run demo validate inspect report",
      evaluationPassed: true,
    });

    assert.equal(validation.passed, true);
    assert.equal(validation.checks.find((check) => check.id === "cli_help")?.passed, true);
    assert.equal(validation.checks.find((check) => check.id === "evaluation_task_set")?.passed, true);
  });
});

function writeArtifactFiles(result: AgentCoordinatorResult): void {
  for (const artifact of result.artifacts) {
    let content = `# ${artifact.type}\n`;
    if (artifact.type === "senior_review" || artifact.type === "final_report") {
      content += [
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
      ].join("\n");
    }
    fs.writeFileSync(artifact.path, content, "utf-8");
  }
}
