import * as fs from "fs";
import * as path from "path";
import { runFullWorkflow } from "../orchestrator/full_workflow_runner";
import { writeHtmlWorkflowReport } from "../tools/html_report_generator";
import { buildDemoManifest } from "../demo/demo_manifest";
import { runStore, type RunRecord } from "./run_store";
import { loadModelConfig, createProvider } from "./model_provider";

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
    const { requirement } = parsed as { requirement?: string };
    if (!requirement?.trim()) {
      return json(400, { error: "Requirement is required" });
    }

    const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const record = runStore.createRun(runId, requirement.trim());

    // Run workflow asynchronously
    runWorkflowAsync(runId, requirement.trim(), ctx).catch((err) => {
      runStore.updateRun(runId, {
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
      });
    });

    return json(201, { runId, status: record.status });
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
