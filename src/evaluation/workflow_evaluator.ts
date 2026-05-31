import * as fs from "fs";
import * as path from "path";

import { buildDemoManifest } from "../demo/demo_manifest";
import { runFullWorkflow } from "../orchestrator/full_workflow_runner";
import { readArtifact } from "../tools/artifact_store";
import type { ArtifactType } from "../types/artifacts";

export interface EvaluationChecklist {
  requiredArtifacts: ArtifactType[];
  requiredHeadings: Partial<Record<ArtifactType, string[]>>;
}

export interface EvaluationTaskResult {
  taskFile: string;
  runId: string;
  passed: boolean;
  missingArtifacts: string[];
  missingHeadings: string[];
  finalValidationPassed: boolean;
}

export interface EvaluationSummary {
  taskCount: number;
  passed: boolean;
  results: EvaluationTaskResult[];
}

export interface EvaluateWorkflowTasksOptions {
  tasksDir: string;
  repoRoot: string;
  baseDir?: string;
}

export async function evaluateWorkflowTasks(options: EvaluateWorkflowTasksOptions): Promise<EvaluationSummary> {
  const checklist = readChecklist(options.tasksDir);
  const taskFiles = fs.readdirSync(options.tasksDir)
    .filter((file) => file.endsWith(".md"))
    .sort();
  const results: EvaluationTaskResult[] = [];

  for (const taskFile of taskFiles) {
    const requirement = fs.readFileSync(path.join(options.tasksDir, taskFile), "utf-8");
    const runId = `eval-${taskFile.replace(/\.md$/, "").replace(/[^a-zA-Z0-9_-]/g, "-")}`;
    const workflow = await runFullWorkflow(requirement, {
      runId,
      baseDir: options.baseDir ?? ".ai_runs/evaluation",
      rootDir: options.repoRoot,
    });
    const manifest = buildDemoManifest(workflow, { repoRoot: options.repoRoot });
    const artifactByType = new Map(workflow.artifacts.map((artifact) => [artifact.type, artifact]));
    const missingArtifacts = checklist.requiredArtifacts.filter((type) => !artifactByType.has(type));
    const missingHeadings: string[] = [];

    for (const [type, headings] of Object.entries(checklist.requiredHeadings) as Array<[ArtifactType, string[]]>) {
      const artifact = artifactByType.get(type);
      if (!artifact) continue;
      const content = readArtifact(artifact.path);
      for (const heading of headings) {
        if (!content.includes(heading)) {
          missingHeadings.push(`${type}: ${heading}`);
        }
      }
    }

    const passed = missingArtifacts.length === 0
      && missingHeadings.length === 0
      && manifest.finalValidation.passed;

    results.push({
      taskFile,
      runId,
      passed,
      missingArtifacts,
      missingHeadings,
      finalValidationPassed: manifest.finalValidation.passed,
    });
  }

  return {
    taskCount: results.length,
    passed: results.length > 0 && results.every((result) => result.passed),
    results,
  };
}

function readChecklist(tasksDir: string): EvaluationChecklist {
  const checklistPath = path.join(tasksDir, "expected_checklist.json");
  const raw = fs.readFileSync(checklistPath, "utf-8");
  return JSON.parse(raw) as EvaluationChecklist;
}
