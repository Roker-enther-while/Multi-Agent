import * as fs from "fs";
import * as path from "path";

import type { AgentCoordinatorResult } from "../orchestrator/agent_coordinator";
import type { ArtifactType } from "../types/artifacts";
import { readArtifact } from "./artifact_store";

export interface HtmlReportResult {
  path: string;
  html: string;
}

const SECTION_ORDER: Array<{ type: ArtifactType; title: string }> = [
  { type: "context_pack", title: "Context Pack" },
  { type: "ba_requirement_package", title: "BA Requirement Package" },
  { type: "visual_model_package", title: "Visual Model Package" },
  { type: "senior_review", title: "Senior Review" },
  { type: "task_plan", title: "Task Plan" },
  { type: "test_plan", title: "Test Plan" },
  { type: "verification_report", title: "Verification" },
  { type: "code_review_report", title: "Review" },
  { type: "traceability_report", title: "Traceability Report" },
  { type: "final_report", title: "Final Report" },
];

export function writeHtmlWorkflowReport(result: AgentCoordinatorResult): HtmlReportResult {
  const html = generateHtmlWorkflowReport(result);
  const reportPath = path.join(result.runDir, "report.html");
  fs.writeFileSync(reportPath, html, "utf-8");
  return { path: reportPath, html };
}

export function generateHtmlWorkflowReport(result: AgentCoordinatorResult): string {
  const artifactByType = new Map(result.artifacts.map((artifact) => [artifact.type, artifact]));
  const sections = SECTION_ORDER.map(({ type, title }) => {
    const artifact = artifactByType.get(type);
    const content = artifact ? readArtifact(artifact.path) : "Artifact missing.";
    const body = type === "visual_model_package"
      ? renderVisualModel(content)
      : `<pre>${escapeHtml(content)}</pre>`;
    return `<section id="${type}"><h2>${title}</h2>${body}</section>`;
  }).join("\n");

  const traceabilityRows = result.artifacts.map((artifact) => [
    artifact.type,
    artifact.producedBy,
    artifact.path,
  ]);

  return [
    "<!doctype html>",
    "<html lang=\"en\">",
    "<head>",
    "  <meta charset=\"utf-8\">",
    "  <title>Workflow Report</title>",
    "  <style>",
    "    body { font-family: Arial, sans-serif; margin: 32px; line-height: 1.5; color: #17202a; }",
    "    h1, h2 { color: #102a43; }",
    "    section { border-top: 1px solid #d9e2ec; padding-top: 16px; margin-top: 24px; }",
    "    pre { background: #f6f8fa; border: 1px solid #d9e2ec; padding: 12px; overflow: auto; }",
    "    table { border-collapse: collapse; width: 100%; }",
    "    th, td { border: 1px solid #d9e2ec; padding: 8px; text-align: left; vertical-align: top; }",
    "    th { background: #f0f4f8; }",
    "  </style>",
    "</head>",
    "<body>",
    "  <h1>Workflow Report</h1>",
    `  <p><strong>Run ID:</strong> ${escapeHtml(result.state.runId)}</p>`,
    `  <p><strong>Final Status:</strong> ${escapeHtml(result.state.status)}</p>`,
    "  <h2>Requirement</h2>",
    `  <pre>${escapeHtml(result.state.requirement)}</pre>`,
    sections,
    "  <section id=\"traceability-matrix\">",
    "    <h2>Traceability Matrix</h2>",
    renderTraceabilityTable(traceabilityRows),
    "  </section>",
    "</body>",
    "</html>",
  ].join("\n");
}

function renderVisualModel(content: string): string {
  const mermaidBlocks = [...content.matchAll(/```mermaid\n([\s\S]*?)```/g)]
    .map((match) => match[1].trim());

  if (mermaidBlocks.length === 0) {
    return `<pre>${escapeHtml(content)}</pre>`;
  }

  return mermaidBlocks
    .map((block) => `<h3>Mermaid Diagram</h3><pre><code class="language-mermaid">${escapeHtml(block)}</code></pre>`)
    .join("\n");
}

function renderTraceabilityTable(rows: string[][]): string {
  return [
    "<table>",
    "<thead><tr><th>Artifact</th><th>Produced By</th><th>Path</th></tr></thead>",
    "<tbody>",
    ...rows.map((row) => `<tr><td>${escapeHtml(row[0])}</td><td>${escapeHtml(row[1])}</td><td>${escapeHtml(row[2])}</td></tr>`),
    "</tbody>",
    "</table>",
  ].join("\n");
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
