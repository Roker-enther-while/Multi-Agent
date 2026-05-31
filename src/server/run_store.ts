import * as fs from "fs";
import * as path from "path";

export type RunStatus = "queued" | "running" | "completed" | "failed" | "blocked";
export type RunMode = "plan_only" | "patch_mode";

export interface RunRecord {
  runId: string;
  requirement: string;
  mode: RunMode;
  status: RunStatus;
  createdAt: string;
  updatedAt: string;
  runDir?: string;
  artifactCount: number;
  artifacts: Array<{ type: string; path: string }>;
  error?: string;
  finalValidation?: boolean;
  patchResult?: {
    applied: boolean;
    testsPass: boolean;
    diff: string;
    filesChanged: string[];
    testOutput: string;
  };
}

export class RunStore {
  private runs: Map<string, RunRecord> = new Map();

  public createRun(runId: string, requirement: string, mode: RunMode = "plan_only"): RunRecord {
    const now = new Date().toISOString();
    const record: RunRecord = {
      runId,
      requirement,
      mode,
      status: "queued",
      createdAt: now,
      updatedAt: now,
      artifactCount: 0,
      artifacts: [],
    };
    this.runs.set(runId, record);
    return record;
  }

  public getRun(runId: string): RunRecord | undefined {
    return this.runs.get(runId);
  }

  public listRuns(): RunRecord[] {
    return Array.from(this.runs.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public updateRun(runId: string, updates: Partial<RunRecord>): RunRecord | undefined {
    const record = this.runs.get(runId);
    if (!record) return undefined;
    Object.assign(record, updates, { updatedAt: new Date().toISOString() });
    return record;
  }

  public deleteRun(runId: string): boolean {
    return this.runs.delete(runId);
  }
}

export const runStore = new RunStore();
