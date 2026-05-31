import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { AgentCoordinator } from "./agent_coordinator";
import { runFullWorkflow } from "./full_workflow_runner";
import { readArtifact } from "../tools/artifact_store";

let tempDir: string;
let rootDir: string;

function makeTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function cleanup(dir: string): void {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function writeRootFile(relativePath: string, content: string): void {
  const filePath = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf-8");
}

describe("AgentCoordinator", () => {
  beforeEach(() => {
    tempDir = makeTempDir("agent-coordinator-runs-");
    rootDir = makeTempDir("agent-coordinator-root-");
    writeRootFile("src/index.ts", "export const value = 1;\n");
    writeRootFile("README.md", "# Test Project\n");
  });

  afterEach(() => {
    cleanup(tempDir);
    cleanup(rootDir);
  });

  it("should run the complete deterministic workflow", async () => {
    const result = await runFullWorkflow("Add audit logging to workflow reports", {
      baseDir: tempDir,
      rootDir,
      runId: "full-success",
      verificationCommands: [
        {
          command: "node -e \"console.log('phase2 ok')\"",
          description: "Phase 2 smoke check",
          expectedOutput: "phase2 ok",
          timeoutMs: 5000,
        },
      ],
    });

    assert.equal(result.state.status, "completed");
    assert.equal(result.agentResults.length, 8);
    assert.equal(result.state.verificationResults.length, 1);
    assert.equal(result.state.verificationResults[0].passed, true);

    const artifactTypes = result.artifacts.map((artifact) => artifact.type);
    assert.deepEqual(artifactTypes, [
      "context_pack",
      "task_plan",
      "test_plan",
      "implementation_summary",
      "verification_report",
      "code_review_report",
      "traceability_report",
      "final_report",
    ]);

    for (const artifact of result.artifacts) {
      assert.ok(artifact.path.startsWith(path.resolve(tempDir)));
      assert.ok(fs.existsSync(artifact.path));
      assert.ok(fs.existsSync(artifact.path + ".meta.json"));
    }

    const codeReview = result.artifacts.find((artifact) => artifact.type === "code_review_report");
    const finalReport = result.artifacts.find((artifact) => artifact.type === "final_report");

    assert.ok(codeReview);
    assert.ok(finalReport);
    assert.match(readArtifact(codeReview.path), /# Code Review Report/);
    assert.match(readArtifact(finalReport.path), /# Final Report/);
  });

  it("should block the workflow when verification fails", async () => {
    const coordinator = new AgentCoordinator({ baseDir: tempDir, rootDir });
    const result = await coordinator.run("Verify blocker behavior", {
      runId: "full-blocked",
      verificationCommands: [
        {
          command: "node -e \"process.exit(2)\"",
          description: "Intentional failure",
          timeoutMs: 5000,
        },
      ],
    });

    assert.equal(result.state.status, "blocked");
    assert.equal(result.state.blockers.length, 1);
    assert.match(result.state.blockers[0].reason, /verification commands failed/);
    assert.equal(result.state.verificationResults.length, 1);
    assert.equal(result.state.verificationResults[0].passed, false);
    assert.ok(result.findings.some((finding) => finding.category === "test"));

    const artifactTypes = result.artifacts.map((artifact) => artifact.type);
    assert.ok(artifactTypes.includes("verification_report"));
    assert.equal(artifactTypes.includes("code_review_report"), false);
    assert.equal(artifactTypes.includes("final_report"), false);
  });
});
