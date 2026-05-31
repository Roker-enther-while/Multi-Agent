import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import { applyPatch, revertPatch, snapshotFiles, getDiff, type PatchOperation } from "./patch_applicator";
import { runFullWorkflow } from "../orchestrator/full_workflow_runner";
import { writeHtmlWorkflowReport } from "./html_report_generator";

export interface PatchScenario {
  id: string;
  requirement: string;
  description: string;
  sourcePatch: PatchOperation;
  sourcePatch2?: PatchOperation;
  testPatch: PatchOperation;
  importPatch?: PatchOperation;
}

export interface PatchScenarioResult {
  id: string;
  requirement: string;
  status: "pass" | "fail";
  patchApplied: boolean;
  testsAdded: boolean;
  testsPass: boolean;
  diffWithinScope: boolean;
  reviewUseful: boolean;
  traceabilityComplete: boolean;
  score: number;
  error?: string;
  diff?: string;
  testOutput?: string;
  workflowRunDir?: string;
}

const SCORES = {
  patchApplied: 20,
  testsAdded: 15,
  testsPass: 25,
  diffWithinScope: 15,
  reviewUseful: 10,
  traceabilityComplete: 15,
};

export async function runPatchScenario(
  scenario: PatchScenario,
  projectDir: string,
  baseDir: string
): Promise<PatchScenarioResult> {
  const result: PatchScenarioResult = {
    id: scenario.id,
    requirement: scenario.requirement,
    status: "fail",
    patchApplied: false,
    testsAdded: false,
    testsPass: false,
    diffWithinScope: false,
    reviewUseful: false,
    traceabilityComplete: false,
    score: 0,
  };

  // 1. Snapshot original files
  const allFiles = [scenario.sourcePatch.file, scenario.testPatch.file];
  if (scenario.importPatch) allFiles.push(scenario.importPatch.file);
  const uniqueFiles = [...new Set(allFiles)];
  const original = snapshotFiles(projectDir, uniqueFiles);

  try {
    // 2. Apply patches
    const operations: PatchOperation[] = [scenario.sourcePatch];
    if (scenario.sourcePatch2) operations.push(scenario.sourcePatch2);
    if (scenario.importPatch) operations.push(scenario.importPatch);
    operations.push(scenario.testPatch);

    const patchResult = applyPatch(projectDir, operations);
    result.patchApplied = patchResult.success;
    if (!patchResult.success) {
      result.error = patchResult.error;
      return result;
    }

    // 3. Get diff
    result.diff = getDiff(projectDir, uniqueFiles, original);
    result.diffWithinScope = result.diff.split("\n").filter((l) => l.startsWith("+")).length < 50;

    // 4. Build the mini app
    try {
      execSync("npm run build", { cwd: projectDir, stdio: "pipe" });
    } catch (buildError: unknown) {
      const msg = buildError instanceof Error ? buildError.message : String(buildError);
      result.error = `Build failed: ${msg}`;
      revertPatch(projectDir, original);
      return result;
    }

    // 5. Run tests
    try {
      const testOutput = execSync("npm test", { cwd: projectDir, encoding: "utf-8", stdio: "pipe" });
      result.testOutput = testOutput;
      result.testsPass = !testOutput.includes("# fail") || testOutput.includes("# fail 0");
      result.testsAdded = testOutput.split("\n").filter((l) => l.includes("ok ")).length > 7;
    } catch (testError: unknown) {
      const msg = testError instanceof Error ? testError.message : String(testError);
      result.testOutput = msg;
      result.testsPass = false;
    }

    // 6. Run workflow
    const workflowResult = await runFullWorkflow(scenario.requirement, {
      runId: scenario.id,
      baseDir,
      rootDir: projectDir,
      verificationCommands: [
        {
          command: "npm test",
          description: "Run sample app tests",
          timeoutMs: 30000,
        },
      ],
    });

    result.workflowRunDir = workflowResult.runDir;

    // 7. Generate HTML report
    writeHtmlWorkflowReport(workflowResult);

    // 8. Check review usefulness
    const reviewArtifact = workflowResult.artifacts.find((a) => a.type === "code_review_report");
    if (reviewArtifact) {
      const reviewContent = fs.readFileSync(reviewArtifact.path, "utf-8");
      result.reviewUseful = reviewContent.includes(scenario.requirement.slice(0, 30));
    }

    // 9. Check traceability
    const traceArtifact = workflowResult.artifacts.find((a) => a.type === "traceability_report");
    if (traceArtifact) {
      const traceContent = fs.readFileSync(traceArtifact.path, "utf-8");
      result.traceabilityComplete = traceContent.includes("Context Pack") && traceContent.includes("Verification Report");
    }

    // 10. Calculate score
    let score = 0;
    if (result.patchApplied) score += SCORES.patchApplied;
    if (result.testsAdded) score += SCORES.testsAdded;
    if (result.testsPass) score += SCORES.testsPass;
    if (result.diffWithinScope) score += SCORES.diffWithinScope;
    if (result.reviewUseful) score += SCORES.reviewUseful;
    if (result.traceabilityComplete) score += SCORES.traceabilityComplete;
    result.score = score;

    result.status = result.patchApplied && result.testsPass ? "pass" : "fail";

  } finally {
    // Always revert to original state
    revertPatch(projectDir, original);
  }

  return result;
}
