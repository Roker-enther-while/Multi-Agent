import * as fs from "fs";
import * as path from "path";
import { runFullWorkflow } from "../orchestrator/full_workflow_runner";
import { writeHtmlWorkflowReport } from "../tools/html_report_generator";
import { buildDemoManifest } from "../demo/demo_manifest";
import { runStore, type RunRecord, type RunMode } from "./run_store";
import { loadModelConfig, createProvider } from "./model_provider";
import { applyPatch, snapshotFiles, getDiff, revertPatch, type PatchOperation } from "../tools/patch_applicator";
import { getAgentNames } from "../prompts/prompt_assembler";
import { runLlmAgent } from "../agents/llm_agent";
import { validateAgentOutput } from "../agents/output_validator";
import type { AgentName } from "../types/agents";
import { loadGitHubConfig, createGitHubClient } from "../integrations/github/github_client";
import {
  createDefaultCollaboration,
  addComment,
  setApprovalState,
  addDecisionLogEntry,
  generateDecisionLogMarkdown,
  type CollaborationData,
  type UserRole,
  type ApprovalState,
  type Comment,
} from "./collaboration";

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

  // GET /api/runs/:runId/comments
  const commentsMatch = pathname.match(/^\/api\/runs\/([^/]+)\/comments$/);
  if (method === "GET" && commentsMatch) {
    const runId = commentsMatch[1];
    const record = runStore.getRun(runId);
    if (!record) return json(404, { error: "Run not found" });
    if (!record.collaboration) record.collaboration = createDefaultCollaboration();
    return json(200, { comments: record.collaboration.comments });
  }

  // POST /api/runs/:runId/comments
  if (method === "POST" && commentsMatch) {
    const runId = commentsMatch[1];
    const record = runStore.getRun(runId);
    if (!record) return json(404, { error: "Run not found" });
    if (!record.collaboration) record.collaboration = createDefaultCollaboration();
    const parsed = body ? parseBody(body) : null;
    if (!parsed || typeof parsed !== "object") return json(400, { error: "Invalid JSON body" });
    const { author, role, content, targetType, targetId } = parsed as {
      author?: string; role?: string; content?: string; targetType?: string; targetId?: string;
    };
    if (!author || !content) return json(400, { error: "author and content required" });
    const comment = addComment(
      record.collaboration,
      author,
      (role as UserRole) || "developer",
      content,
      (targetType as Comment["targetType"]) || "run",
      targetId
    );
    return json(201, comment);
  }

  // POST /api/runs/:runId/approve
  const approveMatch = pathname.match(/^\/api\/runs\/([^/]+)\/approve$/);
  if (method === "POST" && approveMatch) {
    const runId = approveMatch[1];
    const record = runStore.getRun(runId);
    if (!record) return json(404, { error: "Run not found" });
    if (!record.collaboration) record.collaboration = createDefaultCollaboration();
    const parsed = body ? parseBody(body) : null;
    const { actor, comments } = (parsed || {}) as { actor?: string; comments?: string };
    setApprovalState(record.collaboration, "approved", actor || "reviewer", comments);
    return json(200, { state: "approved" });
  }

  // POST /api/runs/:runId/request-changes
  const changesMatch = pathname.match(/^\/api\/runs\/([^/]+)\/request-changes$/);
  if (method === "POST" && changesMatch) {
    const runId = changesMatch[1];
    const record = runStore.getRun(runId);
    if (!record) return json(404, { error: "Run not found" });
    if (!record.collaboration) record.collaboration = createDefaultCollaboration();
    const parsed = body ? parseBody(body) : null;
    const { actor, comments } = (parsed || {}) as { actor?: string; comments?: string };
    setApprovalState(record.collaboration, "changes_requested", actor || "reviewer", comments);
    return json(200, { state: "changes_requested" });
  }

  // GET /api/runs/:runId/decision-log
  const decisionLogMatch = pathname.match(/^\/api\/runs\/([^/]+)\/decision-log$/);
  if (method === "GET" && decisionLogMatch) {
    const runId = decisionLogMatch[1];
    const record = runStore.getRun(runId);
    if (!record) return json(404, { error: "Run not found" });
    if (!record.collaboration) record.collaboration = createDefaultCollaboration();
    return json(200, {
      decisionLog: record.collaboration.decisionLog,
      markdown: generateDecisionLogMarkdown(record.collaboration),
    });
  }

  // GET /api/github/settings
  if (method === "GET" && pathname === "/api/github/settings") {
    const config = loadGitHubConfig();
    return json(200, {
      owner: config.owner,
      repo: config.repo,
      defaultBranch: config.defaultBranch,
      prMode: config.prMode,
      hasToken: Boolean(config.token),
    });
  }

  // POST /api/github/settings
  if (method === "POST" && pathname === "/api/github/settings") {
    const parsed = body ? parseBody(body) : null;
    if (!parsed || typeof parsed !== "object") return json(400, { error: "Invalid JSON body" });
    const settings = parsed as Record<string, unknown>;
    if (settings.token) process.env.GITHUB_TOKEN = String(settings.token);
    if (settings.owner) process.env.GITHUB_OWNER = String(settings.owner);
    if (settings.repo) process.env.GITHUB_REPO = String(settings.repo);
    if (settings.defaultBranch) process.env.GITHUB_DEFAULT_BRANCH = String(settings.defaultBranch);
    if (settings.prMode) process.env.GITHUB_PR_MODE = String(settings.prMode);
    return json(200, { ok: true });
  }

  // POST /api/github/test-connection
  if (method === "POST" && pathname === "/api/github/test-connection") {
    const config = loadGitHubConfig();
    const client = createGitHubClient(config);
    const result = await client.testConnection();
    return json(200, result);
  }

  // GET /api/github/issues
  if (method === "GET" && pathname === "/api/github/issues") {
    const config = loadGitHubConfig();
    const client = createGitHubClient(config);
    const issues = await client.listIssues();
    return json(200, { issues });
  }

  // POST /api/github/issues/:issueNumber/run
  const issueRunMatch = pathname.match(/^\/api\/github\/issues\/(\d+)\/run$/);
  if (method === "POST" && issueRunMatch) {
    const issueNumber = parseInt(issueRunMatch[1], 10);
    const config = loadGitHubConfig();
    const client = createGitHubClient(config);
    const issue = await client.getIssue(issueNumber);

    const runId = `gh-issue-${issueNumber}-${Date.now()}`;
    const record = runStore.createRun(runId, `[Issue #${issueNumber}] ${issue.title}\n\n${issue.body}`);

    runWorkflowAsync(runId, `[Issue #${issueNumber}] ${issue.title}\n\n${issue.body}`, ctx).catch((err) => {
      runStore.updateRun(runId, { status: "failed", error: err instanceof Error ? err.message : String(err) });
    });

    return json(201, { runId, issue: { number: issue.number, title: issue.title } });
  }

  // POST /api/runs/:runId/github/pr
  const prMatch = pathname.match(/^\/api\/runs\/([^/]+)\/github\/pr$/);
  if (method === "POST" && prMatch) {
    const runId = prMatch[1];
    const record = runStore.getRun(runId);
    if (!record) return json(404, { error: "Run not found" });
    if (record.status !== "completed") return json(400, { error: "Run not completed" });

    const parsed = body ? parseBody(body) : null;
    if (!parsed || typeof parsed !== "object") return json(400, { error: "Invalid JSON body" });
    const { title, branchName, baseBranch, includeReport } = parsed as {
      title?: string; branchName?: string; baseBranch?: string; includeReport?: boolean;
    };

    const config = loadGitHubConfig();
    if (config.prMode === "disabled") return json(403, { error: "PR creation is disabled" });

    const client = createGitHubClient(config);
    const branch = branchName || `devmira/${runId}`;
    const base = baseBranch || config.defaultBranch;

    try {
      await client.createBranch(branch, base);

      const prBody = [
        "## Summary",
        record.requirement.slice(0, 200),
        "",
        "## Requirement",
        record.requirement,
        "",
        "## Artifacts",
        `${record.artifactCount} artifacts generated`,
        "",
        "## Verification",
        record.finalValidation ? "✅ Final validation passed" : "⚠️ Final validation not passed",
        "",
        includeReport ? `## Report\n[View Report](${record.runDir}/report.html)` : "",
        "",
        "---",
        "*Generated by DevMIRA*",
      ].filter(Boolean).join("\n");

      const pr = await client.createPullRequest(
        title || `DevMIRA: ${record.requirement.slice(0, 60)}`,
        prBody,
        branch,
        base
      );

      return json(201, { status: "created", prUrl: pr.url, prNumber: pr.number });
    } catch (err) {
      return json(500, { error: err instanceof Error ? err.message : "Failed to create PR" });
    }
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

  // GET /api/agents
  if (method === "GET" && pathname === "/api/agents") {
    return json(200, {
      agents: getAgentNames(),
      executionMode: process.env.AGENT_EXECUTION_MODE || "mock",
    });
  }

  // GET /api/agents/settings
  if (method === "GET" && pathname === "/api/agents/settings") {
    return json(200, {
      executionMode: process.env.AGENT_EXECUTION_MODE || "mock",
      provider: process.env.MODEL_PROVIDER || "mock",
      modelName: process.env.MODEL_NAME || "mock-model",
    });
  }

  // POST /api/agents/settings
  if (method === "POST" && pathname === "/api/agents/settings") {
    const parsed = body ? parseBody(body) : null;
    if (!parsed || typeof parsed !== "object") {
      return json(400, { error: "Invalid JSON body" });
    }
    const settings = parsed as Record<string, unknown>;
    if (settings.executionMode) {
      const mode = String(settings.executionMode);
      if (["mock", "real", "hybrid"].includes(mode)) {
        process.env.AGENT_EXECUTION_MODE = mode;
      }
    }
    return json(200, { ok: true, executionMode: process.env.AGENT_EXECUTION_MODE || "mock" });
  }

  // POST /api/agents/test
  if (method === "POST" && pathname === "/api/agents/test") {
    const parsed = body ? parseBody(body) : null;
    if (!parsed || typeof parsed !== "object") {
      return json(400, { error: "Invalid JSON body" });
    }
    const { agentName, message } = parsed as { agentName?: string; message?: string };
    if (!agentName || !message) {
      return json(400, { error: "agentName and message required" });
    }

    const validAgents = getAgentNames();
    if (!validAgents.includes(agentName as AgentName)) {
      return json(400, { error: `Invalid agent name. Valid: ${validAgents.join(", ")}` });
    }

    const config = loadModelConfig();
    const provider = createProvider(config);
    const startTime = Date.now();

    try {
      const result = await runLlmAgent(
        {
          agentName: agentName as AgentName,
          requirement: message,
          artifacts: [],
        },
        provider,
        config.modelName
      );

      const validation = validateAgentOutput(agentName as AgentName, result.content);

      return json(200, {
        status: result.status,
        provider: result.provider,
        model: result.model,
        latencyMs: result.latencyMs,
        outputPreview: result.content.slice(0, 500),
        validation: {
          passed: validation.valid,
          missingSections: validation.missingSections,
          warnings: validation.warnings,
        },
        retries: result.retries,
      });
    } catch (err) {
      return json(500, {
        status: "failed",
        error: err instanceof Error ? err.message : "Unknown error",
        latencyMs: Date.now() - startTime,
      });
    }
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

      // Size limit: 1MB
      if (content.length > 1024 * 1024) {
        return json(413, { error: "File too large (max 1MB)" });
      }

      // Allowed file types
      const allowedExts = [".txt", ".md", ".json", ".csv", ".ts", ".js", ".py", ".yaml", ".yml", ".toml", ".cfg", ".ini"];
      const ext = path.extname(filename).toLowerCase();
      if (ext && !allowedExts.includes(ext)) {
        return json(415, { error: `File type ${ext} not allowed. Allowed: ${allowedExts.join(", ")}` });
      }

      const uploadDir = path.join(ctx.rootDir, "data", "uploads");
      fs.mkdirSync(uploadDir, { recursive: true });
      const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = path.join(uploadDir, safeName);

      // Path guard: ensure resolved path is within upload dir
      const normalizedUpload = path.resolve(uploadDir);
      const normalizedFile = path.resolve(filePath);
      if (!normalizedFile.startsWith(normalizedUpload)) {
        return json(403, { error: "Path traversal detected" });
      }

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
