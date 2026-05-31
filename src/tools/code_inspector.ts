import * as fs from "fs";
import * as path from "path";

import { resolveInsideRoot } from "./file_reader";

export interface CodeInspectionOptions {
  rootDir: string;
  maxFiles?: number;
  excludeDirs?: string[];
  includeExtensions?: string[];
}

export interface CodeInspectionSummary {
  rootDir: string;
  totalFiles: number;
  files: string[];
  byExtension: Record<string, number>;
  topLevelDirectories: string[];
  excludedDirectories: string[];
}

const DEFAULT_EXCLUDE_DIRS = [
  ".git",
  ".ai_runs",
  ".next",
  "dist",
  "node_modules",
  "__pycache__",
  ".pytest_cache",
];

export function inspectCodebase(options: CodeInspectionOptions): CodeInspectionSummary {
  const rootDir = path.resolve(options.rootDir);
  const maxFiles = options.maxFiles ?? 500;
  const excludeDirs = [...DEFAULT_EXCLUDE_DIRS, ...(options.excludeDirs ?? [])];
  const includeExtensions = options.includeExtensions?.map((ext) => ext.toLowerCase());
  const files: string[] = [];
  const byExtension: Record<string, number> = {};
  const topLevelDirectories = new Set<string>();

  walk(rootDir);
  files.sort();

  for (const file of files) {
    const ext = path.extname(file).toLowerCase() || "(none)";
    byExtension[ext] = (byExtension[ext] ?? 0) + 1;
    const firstPart = file.split("/")[0];
    if (firstPart && firstPart !== file) {
      topLevelDirectories.add(firstPart);
    }
  }

  return {
    rootDir,
    totalFiles: files.length,
    files,
    byExtension,
    topLevelDirectories: [...topLevelDirectories].sort(),
    excludedDirectories: excludeDirs,
  };

  function walk(currentDir: string): void {
    if (files.length >= maxFiles) return;

    const entries = fs.readdirSync(currentDir, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      if (files.length >= maxFiles) return;

      const absolutePath = path.join(currentDir, entry.name);
      const relativePath = path.relative(rootDir, absolutePath).replace(/\\/g, "/");

      if (entry.isDirectory()) {
        if (!excludeDirs.includes(entry.name)) {
          resolveInsideRoot(rootDir, relativePath);
          walk(absolutePath);
        }
        continue;
      }

      if (!entry.isFile()) continue;

      const ext = path.extname(entry.name).toLowerCase();
      if (includeExtensions && !includeExtensions.includes(ext)) continue;

      resolveInsideRoot(rootDir, relativePath);
      files.push(relativePath);
    }
  }
}
