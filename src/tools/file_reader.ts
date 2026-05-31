import * as fs from "fs";
import * as path from "path";

export interface FileReadResult {
  relativePath: string;
  absolutePath: string;
  sizeBytes: number;
  modifiedAt: string;
  content: string;
}

export function resolveInsideRoot(rootDir: string, targetPath: string): string {
  const root = path.resolve(rootDir);
  const resolved = path.resolve(root, targetPath);

  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    throw new Error(`Path is outside repository root: ${targetPath}`);
  }

  return resolved;
}

export function readTextFile(rootDir: string, targetPath: string): FileReadResult {
  const absolutePath = resolveInsideRoot(rootDir, targetPath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found: ${targetPath}`);
  }

  const stat = fs.statSync(absolutePath);
  if (!stat.isFile()) {
    throw new Error(`Path is not a file: ${targetPath}`);
  }

  return {
    relativePath: path.relative(path.resolve(rootDir), absolutePath).replace(/\\/g, "/"),
    absolutePath,
    sizeBytes: stat.size,
    modifiedAt: stat.mtime.toISOString(),
    content: fs.readFileSync(absolutePath, "utf-8"),
  };
}
