import { buildDemoManifest } from "./demo_manifest";
import { runFullWorkflow } from "../orchestrator/full_workflow_runner";
import { writeHtmlWorkflowReport } from "../tools/html_report_generator";

const DEFAULT_REQUIREMENT = [
  "Create a traceable workflow report for a small software change,",
  "including context, plan, tests, verification, code review, and final report.",
].join(" ");

export async function runDemo(requirement: string = DEFAULT_REQUIREMENT): Promise<void> {
  const result = await runFullWorkflow(requirement, {
    runId: "end-to-end-demo",
    baseDir: ".ai_runs",
    rootDir: process.cwd(),
    verificationCommands: [
      {
        command: "node -e \"console.log('e2e verification pass')\"",
        description: "End-to-end deterministic verification",
        expectedOutput: "e2e verification pass",
        timeoutMs: 5000,
      },
    ],
  });

  const htmlReport = writeHtmlWorkflowReport(result);

  const manifest = buildDemoManifest(result, {
    repoRoot: process.cwd(),
    htmlReportPath: htmlReport.path,
  });
  console.log(JSON.stringify(manifest, null, 2));
}

if (require.main === module) {
  const requirement = process.argv.slice(2).join(" ").trim() || DEFAULT_REQUIREMENT;
  runDemo(requirement).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
