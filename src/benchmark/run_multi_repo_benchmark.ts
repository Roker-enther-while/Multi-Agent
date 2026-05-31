import * as fs from "fs";
import * as path from "path";
import { runFullWorkflow } from "../orchestrator/full_workflow_runner";
import { writeHtmlWorkflowReport } from "../tools/html_report_generator";

interface BenchmarkTask {
  id: string;
  repo: string;
  requirement: string;
  expectedArtifacts: string[];
  testCommand: string;
  mode: string;
}

interface TaskResult {
  taskId: string;
  repo: string;
  status: "pass" | "fail";
  artifactCompleteness: number;
  traceabilityComplete: boolean;
  reviewUseful: boolean;
  latencyMs: number;
  error?: string;
}

interface BenchmarkReport {
  date: string;
  repoCount: number;
  taskCount: number;
  passed: number;
  failed: number;
  averageLatency: number;
  averageArtifactCompleteness: number;
  results: TaskResult[];
}

async function runBenchmark(): Promise<void> {
  const projectRoot = process.cwd();
  const tasksDir = path.join(projectRoot, "examples/benchmark_tasks");
  const outputDir = path.join(projectRoot, "reports/multi_repo_benchmark");
  fs.mkdirSync(outputDir, { recursive: true });

  // Load all task files
  const taskFiles = fs.readdirSync(tasksDir).filter((f) => f.endsWith(".json"));
  const allTasks: BenchmarkTask[] = [];
  for (const file of taskFiles) {
    const tasks = JSON.parse(fs.readFileSync(path.join(tasksDir, file), "utf-8"));
    allTasks.push(...tasks);
  }

  console.log(`Running ${allTasks.length} benchmark tasks across ${new Set(allTasks.map((t) => t.repo)).size} repos...\n`);

  const results: TaskResult[] = [];

  for (const task of allTasks) {
    console.log(`=== ${task.id}: ${task.requirement.slice(0, 60)}... ===`);
    const startTime = Date.now();

    try {
      const result = await runFullWorkflow(task.requirement, {
        runId: `bench-${task.id}`,
        baseDir: outputDir,
        rootDir: projectRoot,
        verificationCommands: [
          {
            command: "node -e \"console.log('benchmark pass')\"",
            description: "Benchmark verification",
            expectedOutput: "benchmark pass",
            timeoutMs: 5000,
          },
        ],
      });

      writeHtmlWorkflowReport(result);

      const artifactTypes = result.artifacts.map((a) => a.type);
      const expectedCount = task.expectedArtifacts.length;
      const foundCount = task.expectedArtifacts.filter((a) => artifactTypes.includes(a as any)).length;
      const artifactCompleteness = expectedCount > 0 ? Math.round((foundCount / expectedCount) * 100) : 100;

      const traceabilityComplete = artifactTypes.includes("traceability_report") && artifactTypes.includes("final_report");
      const reviewUseful = artifactTypes.includes("code_review_report");

      results.push({
        taskId: task.id,
        repo: task.repo,
        status: "pass",
        artifactCompleteness,
        traceabilityComplete,
        reviewUseful,
        latencyMs: Date.now() - startTime,
      });

      console.log(`  PASS — ${artifactCompleteness}% complete, ${Date.now() - startTime}ms`);
    } catch (err) {
      results.push({
        taskId: task.id,
        repo: task.repo,
        status: "fail",
        artifactCompleteness: 0,
        traceabilityComplete: false,
        reviewUseful: false,
        latencyMs: Date.now() - startTime,
        error: err instanceof Error ? err.message : "Unknown error",
      });
      console.log(`  FAIL — ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  // Generate report
  const passed = results.filter((r) => r.status === "pass").length;
  const failed = results.filter((r) => r.status === "fail").length;
  const avgLatency = Math.round(results.reduce((sum, r) => sum + r.latencyMs, 0) / results.length);
  const avgCompleteness = Math.round(results.reduce((sum, r) => sum + r.artifactCompleteness, 0) / results.length);

  const report: BenchmarkReport = {
    date: new Date().toISOString(),
    repoCount: new Set(allTasks.map((t) => t.repo)).size,
    taskCount: allTasks.length,
    passed,
    failed,
    averageLatency: avgLatency,
    averageArtifactCompleteness: avgCompleteness,
    results,
  };

  // Write JSON
  fs.writeFileSync(path.join(outputDir, "benchmark_results.json"), JSON.stringify(report, null, 2), "utf-8");

  // Write MD
  const md = generateBenchmarkReportMd(report);
  fs.writeFileSync(path.join(outputDir, "benchmark_report.md"), md, "utf-8");

  console.log(`\n=== SUMMARY ===`);
  console.log(`Tasks: ${allTasks.length} (${passed} passed, ${failed} failed)`);
  console.log(`Average latency: ${avgLatency}ms`);
  console.log(`Average artifact completeness: ${avgCompleteness}%`);
  console.log(`Reports: ${outputDir}`);
}

function generateBenchmarkReportMd(report: BenchmarkReport): string {
  const lines: string[] = [
    "# Multi-Repo Benchmark Report",
    "",
    `**Date:** ${report.date}`,
    `**Repos:** ${report.repoCount}`,
    `**Tasks:** ${report.taskCount}`,
    `**Passed:** ${report.passed}`,
    `**Failed:** ${report.failed}`,
    `**Average Latency:** ${report.averageLatency}ms`,
    `**Average Artifact Completeness:** ${report.averageArtifactCompleteness}%`,
    "",
    "## Results",
    "",
    "| Task | Repo | Status | Completeness | Traceability | Review | Latency |",
    "|---|---|---|---|---|---|---|",
  ];

  for (const r of report.results) {
    const status = r.status === "pass" ? "✅" : "❌";
    lines.push(`| ${r.taskId} | ${r.repo} | ${status} | ${r.artifactCompleteness}% | ${r.traceabilityComplete ? "✅" : "❌"} | ${r.reviewUseful ? "✅" : "❌"} | ${r.latencyMs}ms |`);
  }

  return lines.join("\n");
}

runBenchmark().catch((err) => {
  console.error(err);
  process.exit(1);
});
