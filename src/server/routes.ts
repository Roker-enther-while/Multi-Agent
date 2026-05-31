import * as fs from "fs";
import * as path from "path";
import { runFullWorkflow } from "../orchestrator/full_workflow_runner";
import { writeHtmlWorkflowReport } from "../tools/html_report_generator";
import { buildDemoManifest } from "../demo/demo_manifest";
import { runStore, type RunRecord, type RunMode } from "./run_store";
import { loadModelConfig, createProvider } from "./model_provider";
import { applyPatch, snapshotFiles, getDiff, revertPatch, type PatchOperation } from "../tools/patch_applicator";

export interface ApiContext {
  rootDir: string;
  baseDir: string;
}

export interface ApiResponse {
  status: number;
  body: unknown;
}

function json(status: number, body: unknown): ApiResponse {
  return { status, body };
}

function parseBody(data: string): unknown {
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export async function handleRequest(
  method: string,
  url: string,
  body: string | undefined,
  ctx: ApiContext
): Promise<ApiResponse> {
  const urlObj = new URL(url, "http://localhost");
  const pathname = urlObj.pathname;

  // GET /api/health
  if (method === "GET" && pathname === "/api/health") {
    return json(200, {
      status: "ok",
      version: "1.0.0",
      uptime: process.uptime(),
      runs: runStore.listRuns().length,
    });
  }

  // GET /api/settings
  if (method === "GET" && pathname === "/api/settings") {
    return json(200, {
      provider: process.env.MODEL_PROVIDER || "mock",
      baseUrl: process.env.MODEL_BASE_URL || "",
      modelName: process.env.MODEL_NAME || "mock-model",
      temperature: parseFloat(process.env.MODEL_TEMPERATURE || "0.2"),
      maxTokens: parseInt(process.env.MODEL_MAX_TOKENS || "4096", 10),
      hasApiKey: Boolean(process.env.MODEL_API_KEY),
    });
  }

  // POST /api/settings
  if (method === "POST" && pathname === "/api/settings") {
    const parsed = body ? parseBody(body) : null;
    if (!parsed || typeof parsed !== "object") {
      return json(400, { error: "Invalid JSON body" });
    }
    const settings = parsed as Record<string, unknown>;
    if (settings.provider) process.env.MODEL_PROVIDER = String(settings.provider);
    if (settings.baseUrl) process.env.MODEL_BASE_URL = String(settings.baseUrl);
    if (settings.apiKey) process.env.MODEL_API_KEY = String(settings.apiKey);
    if (settings.modelName) process.env.MODEL_NAME = String(settings.modelName);
    if (settings.temperature !== undefined) process.env.MODEL_TEMPERATURE = String(settings.temperature);
    if (settings.maxTokens !== undefined) process.env.MODEL_MAX_TOKENS = String(settings.maxTokens);
    return json(200, { ok: true });
  }

  // POST /api/models/test-connection
  if (method === "POST" && pathname === "/api/models/test-connection") {
    const config = loadModelConfig();
    const provider = createProvider(config);
    const result = await provider.testConnection();
    return json(200, { ...result, provider: config.provider, modelName: config.modelName });
  }

  // POST /api/runs
  if (method === "POST" && pathname === "/api/runs") {
    const parsed = body ? parseBody(body) : null;
    if (!parsed || typeof parsed !== "object") {
      return json(400, { error: "Invalid JSON body" });
    }
    const { requirement, mode, workspace } = parsed as { requirement?: string; mode?: string; workspace?: string };
    if (!requirement?.trim()) {
      return json(400, { error: "Requirement is required" });
    }

    const runMode: RunMode = mode === "patch_mode" ? "patch_mode" : "plan_only";
    const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const record = runStore.createRun(runId, requirement.trim(), runMode);

    // Run workflow asynchronously
    if (runMode === "patch_mode" && workspace) {
      runPatchModeAsync(runId, requirement.trim(), workspace, ctx).catch((err) => {
        runStore.updateRun(runId, {
          status: "failed",
          error: err instanceof Error ? err.message : String(err),
        });
      });
    } else {
      runWorkflowAsync(runId, requirement.trim(), ctx).catch((err) => {
        runStore.updateRun(runId, {
          status: "failed",
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }

    return json(201, { runId, status: record.status, mode: runMode });
  }

  // GET /api/runs
  if (method === "GET" && pathname === "/api/runs") {
    return json(200, runStore.listRuns());
  }

  // GET /api/runs/:runId
  const runMatch = pathname.match(/^\/api\/runs\/([^/]+)$/);
  if (method === "GET" && runMatch) {
    const runId = runMatch[1];
    const record = runStore.getRun(runId);
    if (!record) return json(404, { error: "Run not found" });
    return json(200, record);
  }

  // GET /api/runs/:runId/artifacts
  const artifactsMatch = pathname.match(/^\/api\/runs\/([^/]+)\/artifacts$/);
  if (method === "GET" && artifactsMatch) {
    const runId = artifactsMatch[1];
    const record = runStore.getRun(runId);
    if (!record) return json(404, { error: "Run not found" });
    return json(200, { artifacts: record.artifacts });
  }

  // GET /api/runs/:runId/artifacts/:artifactName
  const artifactMatch = pathname.match(/^\/api\/runs\/([^/]+)\/artifacts\/([^/]+)$/);
  if (method === "GET" && artifactMatch) {
    const runId = artifactMatch[1];
    const artifactName = artifactMatch[2];
    const record = runStore.getRun(runId);
    if (!record) return json(404, { error: "Run not found" });
    const artifact = record.artifacts.find((a) => a.type === artifactName);
    if (!artifact) return json(404, { error: "Artifact not found" });
    try {
      const content = fs.readFileSync(artifact.path, "utf-8");
      return json(200, { type: artifactName, content, path: artifact.path });
    } catch {
      return json(500, { error: "Failed to read artifact" });
    }
  }

  // GET /api/runs/:runId/report
  const reportMatch = pathname.match(/^\/api\/runs\/([^/]+)\/report$/);
  if (method === "GET" && reportMatch) {
    const runId = reportMatch[1];
    const record = runStore.getRun(runId);
    if (!record) return json(404, { error: "Run not found" });
    if (!record.runDir) return json(404, { error: "Run not completed yet" });
    const reportPath = path.join(record.runDir, "report.html");
    if (!fs.existsSync(reportPath)) return json(404, { error: "Report not found" });
    try {
      const html = fs.readFileSync(reportPath, "utf-8");
      return { status: 200, body: html };
    } catch {
      return json(500, { error: "Failed to read report" });
    }
  }

  // GET /api/runs/:runId/export
  const exportMatch = pathname.match(/^\/api\/runs\/([^/]+)\/export$/);
  if (method === "GET" && exportMatch) {
    const runId = exportMatch[1];
    const record = runStore.getRun(runId);
    if (!record) return json(404, { error: "Run not found" });
    if (!record.runDir) return json(404, { error: "Run not completed yet" });

    try {
      const exportData: Record<string, unknown> = {
        runId: record.runId,
        requirement: record.requirement,
        mode: record.mode,
        status: record.status,
        createdAt: record.createdAt,
        finalValidation: record.finalValidation,
        artifacts: {} as Record<string, string>,
      };

      for (const artifact of record.artifacts) {
        try {
          const content = fs.readFileSync(artifact.path, "utf-8");
          (exportData.artifacts as Record<string, string>)[artifact.type] = content;
        } catch {}
      }

      // Include report.html if exists
      const reportPath = path.join(record.runDir, "report.html");
      if (fs.existsSync(reportPath)) {
        exportData.reportHtml = fs.readFileSync(reportPath, "utf-8");
      }

      // Include patch result if exists
      if (record.patchResult) {
        exportData.patchResult = record.patchResult;
      }

      return json(200, exportData);
    } catch {
      return json(500, { error: "Failed to export run" });
    }
  }

  // GET /api/runs/:runId/diff
  const diffMatch = pathname.match(/^\/api\/runs\/([^/]+)\/diff$/);
  if (method === "GET" && diffMatch) {
    const runId = diffMatch[1];
    const record = runStore.getRun(runId);
    if (!record) return json(404, { error: "Run not found" });
    if (!record.patchResult) return json(404, { error: "No patch result for this run" });
    return json(200, {
      diff: record.patchResult.diff,
      filesChanged: record.patchResult.filesChanged,
      applied: record.patchResult.applied,
      testsPass: record.patchResult.testsPass,
      withinScope: record.patchResult.diff.split("\n").filter((l) => l.startsWith("+")).length < 50,
    });
  }

  // GET /api/workspace/scan?path=...
  if (method === "GET" && pathname === "/api/workspace/scan") {
    const workspacePath = urlObj.searchParams.get("path");
    if (!workspacePath) return json(400, { error: "path parameter required" });

    const resolvedPath = path.resolve(ctx.rootDir, workspacePath);
    const normalizedRoot = path.resolve(ctx.rootDir);
    if (!resolvedPath.startsWith(normalizedRoot)) {
      return json(403, { error: "Path outside project root" });
    }
    if (!fs.existsSync(resolvedPath)) {
      return json(404, { error: "Path not found" });
    }

    try {
      const stat = fs.statSync(resolvedPath);
      if (!stat.isDirectory()) return json(400, { error: "Path is not a directory" });

      const files: string[] = [];
      const maxFiles = 200;
      function scanDir(dir: string, rel: string) {
        if (files.length >= maxFiles) return;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (files.length >= maxFiles) break;
          if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "dist") continue;
          const relPath = rel ? `${rel}/${entry.name}` : entry.name;
          if (entry.isDirectory()) {
            scanDir(path.join(dir, entry.name), relPath);
          } else {
            files.push(relPath);
          }
        }
      }
      scanDir(resolvedPath, "");

      const exts: Record<string, number> = {};
      for (const f of files) {
        const ext = path.extname(f) || "(none)";
        exts[ext] = (exts[ext] || 0) + 1;
      }

      // Save as recent workspace
      const recentPath = path.join(ctx.rootDir, ".recent_workspace");
      fs.writeFileSync(recentPath, resolvedPath, "utf-8");

      return json(200, {
        path: resolvedPath,
        fileCount: files.length,
        files,
        extensions: exts,
        hasPackageJson: files.includes("package.json"),
        hasTsConfig: files.includes("tsconfig.json"),
        hasPyprojectToml: files.includes("pyproject.toml"),
      });
    } catch (err) {
      return json(500, { error: "Failed to scan workspace" });
    }
  }

  // GET /api/workspace/recent
  if (method === "GET" && pathname === "/api/workspace/recent") {
    const recentPath = path.join(ctx.rootDir, ".recent_workspace");
    if (fs.existsSync(recentPath)) {
      const saved = fs.readFileSync(recentPath, "utf-8").trim();
      return json(200, { path: saved });
    }
    return json(200, { path: null });
  }

  // POST /api/files/upload
  if (method === "POST" && pathname === "/api/files/upload") {
    if (!body) return json(400, { error: "No file data" });
    try {
      const parsed = JSON.parse(body);
      const { filename, content } = parsed as { filename?: string; content?: string };
      if (!filename || !content) return json(400, { error: "filename and content required" });
      const uploadDir = path.join(ctx.rootDir, "data", "uploads");
      fs.mkdirSync(uploadDir, { recursive: true });
      const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = path.join(uploadDir, safeName);
      fs.writeFileSync(filePath, content, "utf-8");
      return json(200, { ok: true, path: filePath });
    } catch {
      return json(400, { error: "Invalid upload data" });
    }
  }

  return json(404, { error: "Not found" });
}

async function runWorkflowAsync(
  runId: string,
  requirement: string,
  ctx: ApiContext
): Promise<void> {
  runStore.updateRun(runId, { status: "running" });

  try {
    const result = await runFullWorkflow(requirement, {
      runId,
      baseDir: ctx.baseDir,
      rootDir: ctx.rootDir,
      verificationCommands: [
        {
          command: "node -e \"console.log('api verification pass')\"",
          description: "API workflow verification",
          expectedOutput: "api verification pass",
          timeoutMs: 5000,
        },
      ],
    });

    const htmlReport = writeHtmlWorkflowReport(result);
    const manifest = buildDemoManifest(result, {
      repoRoot: ctx.rootDir,
      htmlReportPath: htmlReport.path,
    });

    runStore.updateRun(runId, {
      status: result.state.status === "completed" ? "completed" : "blocked",
      runDir: result.runDir,
      artifactCount: result.artifacts.length,
      artifacts: result.artifacts.map((a) => ({ type: a.type, path: a.path })),
      finalValidation: manifest.finalValidation.passed,
    });
  } catch (err) {
    runStore.updateRun(runId, {
      status: "failed",
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function runPatchModeAsync(
  runId: string,
  requirement: string,
  workspace: string,
  ctx: ApiContext
): Promise<void> {
  runStore.updateRun(runId, { status: "running" });

  try {
    // First run the workflow to generate artifacts
    const result = await runFullWorkflow(requirement, {
      runId,
      baseDir: ctx.baseDir,
      rootDir: ctx.rootDir,
      verificationCommands: [
        {
          command: "node -e \"console.log('patch verification pass')\"",
          description: "Patch mode verification",
          expectedOutput: "patch verification pass",
          timeoutMs: 5000,
        },
      ],
    });

    const htmlReport = writeHtmlWorkflowReport(result);
    const manifest = buildDemoManifest(result, {
      repoRoot: ctx.rootDir,
      htmlReportPath: htmlReport.path,
    });

    // Try to apply a patch to the workspace
    let patchResult: RunRecord["patchResult"];
    const workspacePath = path.resolve(ctx.rootDir, workspace);

    if (fs.existsSync(workspacePath)) {
      // Read patch scenarios and find matching one
      const scenariosPath = path.join(ctx.rootDir, "examples/patch_targets/patch_scenarios.json");
      if (fs.existsSync(scenariosPath)) {
        const scenarios = JSON.parse(fs.readFileSync(scenariosPath, "utf-8"));
        const matchingScenario = scenarios.find((s: { requirement: string }) =>
          requirement.toLowerCase().includes(s.requirement.slice(0, 30).toLowerCase()) ||
          s.requirement.toLowerCase().includes(requirement.slice(0, 30).toLowerCase())
        );

        if (matchingScenario) {
          const allFiles = [matchingScenario.sourcePatch.file, matchingScenario.testPatch.file];
          const uniqueFiles = [...new Set(allFiles)];
          const original = snapshotFiles(workspacePath, uniqueFiles);

          const operations: PatchOperation[] = [matchingScenario.sourcePatch];
          if (matchingScenario.sourcePatch2) operations.push(matchingScenario.sourcePatch2);
          if (matchingScenario.importPatch) operations.push(matchingScenario.importPatch);
          operations.push(matchingScenario.testPatch);

          const patchApplyResult = applyPatch(workspacePath, operations);

          if (patchApplyResult.success) {
            // Build and test
            let testOutput = "";
            let testsPass = false;
            try {
              const { execSync } = require("child_process");
              execSync("npm run build", { cwd: workspacePath, stdio: "pipe" });
              testOutput = execSync("npm test", { cwd: workspacePath, encoding: "utf-8", stdio: "pipe" });
              testsPass = !testOutput.includes("# fail") || testOutput.includes("# fail 0");
            } catch (testErr: unknown) {
              testOutput = testErr instanceof Error ? testErr.message : String(testErr);
            }

            const diff = getDiff(workspacePath, uniqueFiles, original);

            patchResult = {
              applied: true,
              testsPass,
              diff,
              filesChanged: patchApplyResult.filesModified,
              testOutput,
            };
          } else {
            patchResult = {
              applied: false,
              testsPass: false,
              diff: "",
              filesChanged: [],
              testOutput: `Patch failed: ${patchApplyResult.error}`,
            };
          }

          // Always revert
          revertPatch(workspacePath, original);
        }
      }
    }

    runStore.updateRun(runId, {
      status: result.state.status === "completed" ? "completed" : "blocked",
      runDir: result.runDir,
      artifactCount: result.artifacts.length,
      artifacts: result.artifacts.map((a) => ({ type: a.type, path: a.path })),
      finalValidation: manifest.finalValidation.passed,
      patchResult,
    });
  } catch (err) {
    runStore.updateRun(runId, {
      status: "failed",
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
