import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { addArtifact, addDecision, addVerificationResult, createInitialProjectState } from "../state/project_state";
import { generateWorkflowReport } from "./report_generator";

describe("report_generator", () => {
  it("should generate a traceability-focused workflow report", () => {
    let state = createInitialProjectState({
      requirement: "Add structured reports",
      runId: "report-test",
    });

    state = addArtifact(state, {
      id: "artifact-1",
      type: "traceability_report",
      path: "/tmp/report.md",
      createdAt: "2026-05-31T00:00:00.000Z",
      producedBy: "reporter_traceability",
    });
    state = addVerificationResult(state, {
      command: "npm test",
      passed: true,
      exitCode: 0,
      stdout: "pass",
      stderr: "",
      runAt: "2026-05-31T00:00:00.000Z",
      durationMs: 10,
    });
    state = addDecision(state, {
      id: "decision-1",
      madeBy: "project_manager",
      decision: "Generate Markdown",
      rationale: "Markdown is easy to inspect.",
      madeAt: "2026-05-31T00:00:00.000Z",
    });

    const report = generateWorkflowReport(state);

    assert.match(report, /# Workflow Traceability Report/);
    assert.match(report, /Add structured reports/);
    assert.match(report, /traceability_report: artifact-1/);
    assert.match(report, /PASS: npm test/);
    assert.match(report, /Generate Markdown/);
    assert.match(report, /No blockers recorded/);
  });
});
