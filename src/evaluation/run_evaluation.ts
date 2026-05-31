import * as path from "path";

import { evaluateWorkflowTasks } from "./workflow_evaluator";

async function main(): Promise<void> {
  const repoRoot = process.cwd();
  const tasksDir = process.argv[2]
    ? path.resolve(repoRoot, process.argv[2])
    : path.resolve(repoRoot, "examples/evaluation_tasks");
  const summary = await evaluateWorkflowTasks({
    tasksDir,
    repoRoot,
    baseDir: ".ai_runs/evaluation",
  });

  console.log(JSON.stringify(summary, null, 2));
  if (!summary.passed) {
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
