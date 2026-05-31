import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { readTextFile, resolveInsideRoot } from "./file_reader";

let tempDir: string;

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "file-reader-test-"));
}

function cleanup(dir: string): void {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

describe("file_reader", () => {
  beforeEach(() => {
    tempDir = makeTempDir();
  });

  afterEach(() => {
    cleanup(tempDir);
  });

  it("should read a UTF-8 file inside the root", () => {
    fs.writeFileSync(path.join(tempDir, "sample.md"), "# Sample\n", "utf-8");

    const result = readTextFile(tempDir, "sample.md");

    assert.equal(result.relativePath, "sample.md");
    assert.equal(result.content, "# Sample\n");
    assert.equal(result.sizeBytes, 9);
    assert.ok(result.modifiedAt);
  });

  it("should reject path traversal outside the root", () => {
    assert.throws(
      () => resolveInsideRoot(tempDir, "..\\outside.txt"),
      /outside repository root/
    );
  });

  it("should reject missing files", () => {
    assert.throws(
      () => readTextFile(tempDir, "missing.txt"),
      /File not found/
    );
  });
});
