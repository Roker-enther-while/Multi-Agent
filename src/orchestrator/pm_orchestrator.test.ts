import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { PMOrchestrator } from "./pm_orchestrator";
import { runWorkflow } from "./workflow_runner";
import { listArtifacts, readArtifact } from "../tools/artifact_store";

let tempDir: string;

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "pm-orchestrator-test-"));
}

function cleanupTempDir(dir: string): void {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe("PMOrchestrator", () => {
  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
  });

  it("should run requirement to context pack, task plan, and traceability report", () => {
    const orchestrator = new PMOrchestrator({ baseDir: tempDir });
    const result = orchestrator.run("Add password reset with email verification", {
      runId: "phase-0-demo",
    });

    assert.equal(result.state.runId, "phase-0-demo");
    assert.equal(result.state.status, "completed");
    assert.equal(result.state.requirement, "Add password reset with email verification");
    assert.ok(result.state.scopeLock);
    assert.equal(result.state.steps.length, 3);
    assert.ok(result.state.steps.every((step) => step.status === "completed"));

    const artifactTypes = result.artifacts.map((artifact) => artifact.type);
    assert.deepEqual(artifactTypes, [
      "requirement",
      "context_pack",
      "task_plan",
      "traceability_report",
    ]);

    for (const artifact of result.artifacts) {
      assert.ok(artifact.path.startsWith(path.resolve(tempDir)));
      assert.ok(fs.existsSync(artifact.path));
      assert.ok(fs.existsSync(artifact.path + ".meta.json"));
    }

    const files = listArtifacts(result.runDir);
    assert.equal(files.length, 4);
  });

  it("should produce structured and traceable artifact content", () => {
    const result = runWorkflow("Create an audit trail for agent decisions", {
      baseDir: tempDir,
      runId: "traceable-run",
    });

    const contextPack = result.artifacts.find((artifact) => artifact.type === "context_pack");
    const taskPlan = result.artifacts.find((artifact) => artifact.type === "task_plan");
    const report = result.artifacts.find((artifact) => artifact.type === "traceability_report");

    assert.ok(contextPack);
    assert.ok(taskPlan);
    assert.ok(report);

    const contextContent = readArtifact(contextPack.path);
    assert.match(contextContent, /# Context Pack/);
    assert.match(contextContent, /Project Manager prompt: available/);

    const taskPlanContent = JSON.parse(readArtifact(taskPlan.path));
    assert.equal(taskPlanContent.requirement, "Create an audit trail for agent decisions");
    assert.equal(taskPlanContent.contextPackArtifactId, contextPack.id);
    assert.equal(taskPlanContent.steps.length, 3);

    const reportContent = readArtifact(report.path);
    assert.match(reportContent, /# Traceability Report/);
    assert.match(reportContent, new RegExp(contextPack.id));
    assert.match(reportContent, new RegExp(taskPlan.id));
  });

  it("should reject an empty requirement", () => {
    const orchestrator = new PMOrchestrator({ baseDir: tempDir });

    assert.throws(
      () => orchestrator.run("   "),
      /Requirement is required/
    );
  });
});
