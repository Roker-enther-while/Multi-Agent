import * as fs from "fs";
import * as path from "path";
import { runPatchScenario, type PatchScenario, type PatchScenarioResult } from "./patch_scenario_runner";

async function main(): Promise<void> {
  const projectRoot = process.cwd();
  const scenariosPath = path.join(projectRoot, "examples/patch_targets/patch_scenarios.json");
  const miniAppDir = path.join(projectRoot, "examples/patch_targets/ts_mini_app");
  const baseDir = path.join(projectRoot, ".ai_runs");

  if (!fs.existsSync(scenariosPath)) {
    console.error(`Scenarios file not found: ${scenariosPath}`);
    process.exit(1);
  }

  const scenarios: PatchScenario[] = JSON.parse(fs.readFileSync(scenariosPath, "utf-8"));
  console.log(`Running ${scenarios.length} patch scenarios...\n`);

  const results: PatchScenarioResult[] = [];

  for (const scenario of scenarios) {
    console.log(`=== ${scenario.id}: ${scenario.description} ===`);
    const result = await runPatchScenario(scenario, miniAppDir, baseDir);
    results.push(result);

    console.log(`  Status: ${result.status}`);
    console.log(`  Patch applied: ${result.patchApplied}`);
    console.log(`  Tests added: ${result.testsAdded}`);
    console.log(`  Tests pass: ${result.testsPass}`);
    console.log(`  Diff in scope: ${result.diffWithinScope}`);
    console.log(`  Review useful: ${result.reviewUseful}`);
    console.log(`  Traceability: ${result.traceabilityComplete}`);
    console.log(`  Score: ${result.score}/100`);
    if (result.error) console.log(`  Error: ${result.error}`);
    console.log("");
  }

  // Generate reports
  const passed = results.filter((r) => r.status === "pass").length;
  const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;

  const jsonReport = {
    date: new Date().toISOString(),
    scenarioCount: results.length,
    passed,
    failed: results.length - passed,
    averageScore: Math.round(avgScore * 10) / 10,
    scenarios: results.map((r) => ({
      id: r.id,
      requirement: r.requirement,
      status: r.status,
      score: r.score,
      patchApplied: r.patchApplied,
      testsAdded: r.testsAdded,
      testsPass: r.testsPass,
      diffWithinScope: r.diffWithinScope,
      reviewUseful: r.reviewUseful,
      traceabilityComplete: r.traceabilityComplete,
      error: r.error,
    })),
  };

  const jsonPath = path.join(projectRoot, "reports/real_code_patch_validation.json");
  fs.writeFileSync(jsonPath, JSON.stringify(jsonReport, null, 2), "utf-8");
  console.log(`JSON report: ${jsonPath}`);

  const mdReport = generateMarkdownReport(jsonReport);
  const mdPath = path.join(projectRoot, "reports/real_code_patch_validation.md");
  fs.writeFileSync(mdPath, mdReport, "utf-8");
  console.log(`MD report: ${mdPath}`);

  console.log(`\n=== SUMMARY ===`);
  console.log(`Passed: ${passed}/${results.length}`);
  console.log(`Average score: ${jsonReport.averageScore}/100`);
  console.log(`Status: ${passed >= 4 ? "REAL CODE PATCH MODE DONE" : "NEEDS IMPROVEMENT"}`);
}

function generateMarkdownReport(data: {
  date: string;
  scenarioCount: number;
  passed: number;
  failed: number;
  averageScore: number;
  scenarios: Array<{
    id: string;
    requirement: string;
    status: string;
    score: number;
    patchApplied: boolean;
    testsAdded: boolean;
    testsPass: boolean;
    diffWithinScope: boolean;
    reviewUseful: boolean;
    traceabilityComplete: boolean;
    error?: string;
  }>;
}): string {
  const lines: string[] = [
    "# Real Code Patch Validation Report",
    "",
    `**Date:** ${data.date}`,
    `**Scenarios:** ${data.scenarioCount}`,
    `**Passed:** ${data.passed}/${data.scenarioCount}`,
    `**Average Score:** ${data.averageScore}/100`,
    "",
    "## Scenarios",
    "",
    "| ID | Status | Score | Patch | Tests | Pass | Scope | Review | Trace |",
    "|---|---|---|---|---|---|---|---|---|",
  ];

  for (const s of data.scenarios) {
    lines.push(
      `| ${s.id} | ${s.status === "pass" ? "✅" : "❌"} | ${s.score} | ${s.patchApplied ? "✅" : "❌"} | ${s.testsAdded ? "✅" : "❌"} | ${s.testsPass ? "✅" : "❌"} | ${s.diffWithinScope ? "✅" : "❌"} | ${s.reviewUseful ? "✅" : "❌"} | ${s.traceabilityComplete ? "✅" : "❌"} |`
    );
  }

  lines.push("", "## Details", "");
  for (const s of data.scenarios) {
    lines.push(`### ${s.id}`);
    lines.push(`- **Requirement:** ${s.requirement}`);
    lines.push(`- **Status:** ${s.status}`);
    lines.push(`- **Score:** ${s.score}/100`);
    if (s.error) lines.push(`- **Error:** ${s.error}`);
    lines.push("");
  }

  return lines.join("\n");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
