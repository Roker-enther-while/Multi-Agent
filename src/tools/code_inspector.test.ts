import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { inspectCodebase } from "./code_inspector";

let tempDir: string;

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "code-inspector-test-"));
}

function cleanup(dir: string): void {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function writeFile(relativePath: string, content: string): void {
  const filePath = path.join(tempDir, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf-8");
}

describe("code_inspector", () => {
  beforeEach(() => {
    tempDir = makeTempDir();
  });

  afterEach(() => {
    cleanup(tempDir);
  });

  it("should summarize project files and extensions", () => {
    writeFile("src/index.ts", "export {};\n");
    writeFile("README.md", "# Test\n");
    writeFile("docs/api.md", "# API\n");

    const summary = inspectCodebase({ rootDir: tempDir });

    assert.equal(summary.totalFiles, 3);
    assert.deepEqual(summary.files, ["README.md", "docs/api.md", "src/index.ts"]);
    assert.equal(summary.byExtension[".ts"], 1);
    assert.equal(summary.byExtension[".md"], 2);
    assert.deepEqual(summary.topLevelDirectories, ["docs", "src"]);
  });

  it("should exclude dependency and generated directories", () => {
    writeFile("src/index.ts", "export {};\n");
    writeFile("node_modules/pkg/index.js", "ignored\n");
    writeFile("dist/index.js", "ignored\n");
    writeFile(".ai_runs/run/report.md", "ignored\n");

    const summary = inspectCodebase({ rootDir: tempDir });

    assert.deepEqual(summary.files, ["src/index.ts"]);
  });

  it("should filter by included extensions", () => {
    writeFile("src/index.ts", "export {};\n");
    writeFile("README.md", "# Test\n");

    const summary = inspectCodebase({
      rootDir: tempDir,
      includeExtensions: [".ts"],
    });

    assert.deepEqual(summary.files, ["src/index.ts"]);
  });
});
