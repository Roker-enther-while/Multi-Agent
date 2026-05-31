import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { buildSeniorValueAssessment, renderSeniorValueAssessment } from "./senior_value_gates";

describe("senior value gates", () => {
  it("should create all required gates and score fields", () => {
    const assessment = buildSeniorValueAssessment("Add traceability");
    const gateIds = assessment.gates.map((gate) => gate.id);

    assert.deepEqual(gateIds, [
      "problem_framing",
      "scope_decision",
      "risk_assessment",
      "architecture_judgment",
      "priority_decision",
      "quality_gate",
      "handoff",
    ]);
    assert.equal(typeof assessment.scores.traceability_score, "number");
    assert.equal(typeof assessment.scores.test_readiness_score, "number");
    assert.equal(typeof assessment.scores.scope_risk_score, "number");
    assert.equal(typeof assessment.scores.architecture_fit_score, "number");
  });

  it("should render gates and scores for reports", () => {
    const rendered = renderSeniorValueAssessment(buildSeniorValueAssessment("Add traceability"));

    assert.match(rendered, /## Senior Value Gates/);
    assert.match(rendered, /Problem Framing/);
    assert.match(rendered, /traceability_score/);
    assert.match(rendered, /architecture_fit_score/);
  });
});
