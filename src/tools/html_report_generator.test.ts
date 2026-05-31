import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { runFullWorkflow } from "../orchestrator/full_workflow_runner";
import { writeHtmlWorkflowReport } from "./html_report_generator";

let tempDir: string;
let rootDir: string;

describe("html report generator", () => {
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "html-report-runs-"));
    rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "html-report-root-"));
    fs.writeFileSync(path.join(rootDir, "AGENT_REPORT.md"), "# report\n", "utf-8");
    fs.writeFileSync(path.join(rootDir, "PHASE_LOG.md"), "# log\n", "utf-8");
    fs.writeFileSync(path.join(rootDir, "NEXT_STEP.md"), "# next\n", "utf-8");
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.rmSync(rootDir, { recursive: true, force: true });
  });

  it("should write a human-readable HTML report with required sections", async () => {
    const result = await runFullWorkflow("Add HTML report coverage", {
      baseDir: tempDir,
      rootDir,
      runId: "html-report-test",
    });

    const report = writeHtmlWorkflowReport(result);

    assert.ok(fs.existsSync(report.path));
    assert.equal(path.basename(report.path), "report.html");
    assert.match(report.html, /<h2>Requirement<\/h2>/);
    assert.match(report.html, /Context Pack/);
    assert.match(report.html, /BA Requirement Package/);
    assert.match(report.html, /language-mermaid/);
    assert.match(report.html, /Task Plan/);
    assert.match(report.html, /Test Plan/);
    assert.match(report.html, /Verification/);
    assert.match(report.html, /Review/);
    assert.match(report.html, /Traceability Matrix/);
    assert.match(report.html, /Final Status/);
  });
});
