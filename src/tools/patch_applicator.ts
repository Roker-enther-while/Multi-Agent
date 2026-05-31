import * as fs from "fs";
import * as path from "path";

export interface PatchOperation {
  file: string;
  oldCode?: string;
  newCode?: string;
  insertAfter?: string;
  insertBlock?: string;
  oldImport?: string;
  newImport?: string;
}

export interface PatchResult {
  success: boolean;
  filesModified: string[];
  error?: string;
}

export function applyPatch(projectDir: string, operations: PatchOperation[]): PatchResult {
  const filesModified: string[] = [];

  for (const op of operations) {
    const filePath = path.resolve(projectDir, op.file);
    if (!fs.existsSync(filePath)) {
      return { success: false, filesModified, error: `File not found: ${filePath}` };
    }

    let content = fs.readFileSync(filePath, "utf-8");

    if (op.oldCode && op.newCode) {
      if (!content.includes(op.oldCode)) {
        return { success: false, filesModified, error: `Old code not found in ${op.file}` };
      }
      content = content.replace(op.oldCode, op.newCode);
    }

    if (op.insertAfter && op.insertBlock) {
      if (!content.includes(op.insertAfter)) {
        return { success: false, filesModified, error: `Insert anchor not found in ${op.file}` };
      }
      content = content.replace(op.insertAfter, op.insertAfter + op.insertBlock);
    }

    if (op.oldImport && op.newImport) {
      if (!content.includes(op.oldImport)) {
        return { success: false, filesModified, error: `Old import not found in ${op.file}` };
      }
      content = content.replace(op.oldImport, op.newImport);
    }

    fs.writeFileSync(filePath, content, "utf-8");
    if (!filesModified.includes(op.file)) {
      filesModified.push(op.file);
    }
  }

  return { success: true, filesModified };
}

export function revertPatch(projectDir: string, originalFiles: Map<string, string>): void {
  for (const [relPath, content] of originalFiles) {
    const filePath = path.resolve(projectDir, relPath);
    fs.writeFileSync(filePath, content, "utf-8");
  }
}

export function snapshotFiles(projectDir: string, files: string[]): Map<string, string> {
  const snapshot = new Map<string, string>();
  for (const relPath of files) {
    const filePath = path.resolve(projectDir, relPath);
    if (fs.existsSync(filePath)) {
      snapshot.set(relPath, fs.readFileSync(filePath, "utf-8"));
    }
  }
  return snapshot;
}

export function getDiff(projectDir: string, files: string[], original: Map<string, string>): string {
  const diffs: string[] = [];
  for (const relPath of files) {
    const filePath = path.resolve(projectDir, relPath);
    const current = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf-8") : "";
    const originalContent = original.get(relPath) ?? "";
    if (current !== originalContent) {
      diffs.push(`--- a/${relPath}`);
      diffs.push(`+++ b/${relPath}`);
      const origLines = originalContent.split("\n");
      const currLines = current.split("\n");
      const maxLen = Math.max(origLines.length, currLines.length);
      for (let i = 0; i < maxLen; i++) {
        const orig = origLines[i];
        const curr = currLines[i];
        if (orig !== curr) {
          if (orig !== undefined) diffs.push(`- ${orig}`);
          if (curr !== undefined) diffs.push(`+ ${curr}`);
        }
      }
      diffs.push("");
    }
  }
  return diffs.join("\n");
}
