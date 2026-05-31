import * as fs from "fs";
import * as path from "path";
import type { E2EResult } from "./browser_runner";

export function generateE2EReport(results: E2EResult[], outputDir: string): string {
  const passed = results.filter((r) => r.status === "pass").length;
  const failed = results.filter((r) => r.status === "fail").length;
  const skipped = results.filter((r) => r.status === "skipped").length;

  const lines: string[] = [
    "# E2E Test Report",
    "",
    `**Date:** ${new Date().toISOString()}`,
    `**Total:** ${results.length}`,
    `**Passed:** ${passed}`,
    `**Failed:** ${failed}`,
    `**Skipped:** ${skipped}`,
    "",
    "## Results",
    "",
    "| Scenario | Status | Steps | Duration |",
    "|---|---|---|---|",
  ];

  for (const result of results) {
    const status = result.status === "pass" ? "✅" : result.status === "fail" ? "❌" : "⏭️";
    lines.push(`| ${result.scenarioId} | ${status} | ${result.stepsCompleted}/${result.totalSteps} | ${result.durationMs}ms |`);
  }

  lines.push("", "## Details", "");
  for (const result of results) {
    lines.push(`### ${result.scenarioId}`);
    lines.push(`- **Status:** ${result.status}`);
    lines.push(`- **Steps:** ${result.stepsCompleted}/${result.totalSteps}`);
    lines.push(`- **Duration:** ${result.durationMs}ms`);
    if (result.error) lines.push(`- **Error:** ${result.error}`);
    if (result.screenshotPath) lines.push(`- **Screenshot:** ${result.screenshotPath}`);
    lines.push("");
  }

  const report = lines.join("\n");
  const reportPath = path.join(outputDir, "e2e_report.md");
  fs.writeFileSync(reportPath, report, "utf-8");

  // Also write JSON
  const jsonPath = path.join(outputDir, "e2e_results.json");
  fs.writeFileSync(jsonPath, JSON.stringify({ date: new Date().toISOString(), passed, failed, skipped, results }, null, 2), "utf-8");

  return reportPath;
}
