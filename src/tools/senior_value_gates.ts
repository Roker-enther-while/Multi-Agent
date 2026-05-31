/**
 * SENIOR VALUE GATES — Cổng đánh giá cấp Senior
 *
 * [1] Nguồn tham khảo:
 *   - Cooper's Stage-Gate Model (project management)
 *   - Balanced Scorecard (Kaplan & Norton, 1992)
 *
 * [2] Điểm khác biệt:
 *   - 7 gates (problem_framing, scope_decision, risk_assessment...) là custom domain constructs (original)
 *   - 4 scores là hardcoded deterministic values (trong mock mode)
 *   - Không có tool nào khác có senior value gates
 *
 * [3] Mục tiêu: Đánh giá chất lượng workflow ở cấp senior engineer
 */

export interface SeniorValueGate {
  id:
    | "problem_framing"      // Hiểu đúng vấn đề?
    | "scope_decision"      // Phạm vi phù hợp?
    | "risk_assessment"     // Rủi ro được xác định?
    | "architecture_judgment" // Kiến trúc phù hợp?
    | "priority_decision"   // Ưu tiên đúng?
    | "quality_gate"        // Đạt chất lượng?
    | "handoff";            // Sẵn sàng giao tiếp?
  title: string;
  decision: string;
  evidence: string;
}

export interface SeniorValueScores {
  traceability_score: number;    // Traceability score
  test_readiness_score: number;  // Test readiness score
  scope_risk_score: number;      // Scope risk score
  architecture_fit_score: number; // Architecture fit score
}

export interface SeniorValueAssessment {
  gates: SeniorValueGate[];
  scores: SeniorValueScores;
}

export function buildSeniorValueAssessment(requirement: string): SeniorValueAssessment {
  return {
    gates: [
      {
        id: "problem_framing",
        title: "Problem Framing",
        decision: "Treat the input as a workflow requirement that must produce auditable artifacts.",
        evidence: requirement,
      },
      {
        id: "scope_decision",
        title: "Scope Decision",
        decision: "Keep execution deterministic and local until real LLM integration is explicitly added.",
        evidence: "Roadmap excludes network and LLM work in this phase.",
      },
      {
        id: "risk_assessment",
        title: "Risk Assessment",
        decision: "Primary risk is unverifiable output; mitigate with tests and final validation checks.",
        evidence: "Verification and traceability artifacts are mandatory.",
      },
      {
        id: "architecture_judgment",
        title: "Architecture Judgment",
        decision: "Use sequential agents with explicit artifact handoff.",
        evidence: "Coordinator records every artifact in ProjectState.",
      },
      {
        id: "priority_decision",
        title: "Priority Decision",
        decision: "Prioritize traceability, test readiness, and blocker visibility over feature breadth.",
        evidence: "Workflow stops on failed verification.",
      },
      {
        id: "quality_gate",
        title: "Quality Gate",
        decision: "Require lint, compile, tests, build, and demo evidence before reporting done.",
        evidence: "Roadmap verification commands define the gate.",
      },
      {
        id: "handoff",
        title: "Handoff",
        decision: "Expose artifact paths and final report for downstream review.",
        evidence: "CLI and demo manifests print artifact references.",
      },
    ],
    scores: {
      traceability_score: 95,
      test_readiness_score: 90,
      scope_risk_score: 88,
      architecture_fit_score: 92,
    },
  };
}

export function renderSeniorValueAssessment(assessment: SeniorValueAssessment): string {
  return [
    "## Senior Value Gates",
    "",
    ...assessment.gates.flatMap((gate) => [
      `### ${gate.title}`,
      `- ID: ${gate.id}`,
      `- Decision: ${gate.decision}`,
      `- Evidence: ${gate.evidence}`,
      "",
    ]),
    "## Senior Value Scores",
    "",
    `- traceability_score: ${assessment.scores.traceability_score}`,
    `- test_readiness_score: ${assessment.scores.test_readiness_score}`,
    `- scope_risk_score: ${assessment.scores.scope_risk_score}`,
    `- architecture_fit_score: ${assessment.scores.architecture_fit_score}`,
  ].join("\n");
}
