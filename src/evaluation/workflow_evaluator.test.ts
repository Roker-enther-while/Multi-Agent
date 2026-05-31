import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { evaluateWorkflowTasks } from "./workflow_evaluator";

let tempDir: string;
let tasksDir: string;

describe("workflow evaluator", () => {
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "workflow-eval-test-"));
    tasksDir = path.join(tempDir, "tasks");
    fs.mkdirSync(tasksDir, { recursive: true });
    fs.writeFileSync(path.join(tempDir, "AGENT_REPORT.md"), "# report\n", "utf-8");
    fs.writeFileSync(path.join(tempDir, "PHASE_LOG.md"), "# log\n", "utf-8");
    fs.writeFileSync(path.join(tempDir, "NEXT_STEP.md"), "# next\n", "utf-8");
    fs.writeFileSync(path.join(tasksDir, "sample.md"), "# Sample\n\nAdd evaluation coverage.\n", "utf-8");
    fs.writeFileSync(path.join(tasksDir, "expected_checklist.json"), JSON.stringify({
      requiredArtifacts: [
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
        "final_report"
      ],
      requiredHeadings: {
        ba_requirement_package: ["## User Stories", "## Acceptance Criteria"],
        visual_model_package: ["```mermaid"],
        senior_review: ["traceability_score"],
        final_report: ["## Senior Value Gates"]
      }
    }), "utf-8");
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("should evaluate tasks against artifact and heading checks", async () => {
    const summary = await evaluateWorkflowTasks({
      tasksDir,
      repoRoot: tempDir,
      baseDir: path.join(tempDir, ".ai_runs/evaluation"),
    });

    assert.equal(summary.taskCount, 1);
    assert.equal(summary.passed, true);
    assert.equal(summary.results[0].passed, true);
    assert.equal(summary.results[0].finalValidationPassed, true);
  });
});
