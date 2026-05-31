/**
 * Tests for artifact_store.ts
 *
 * Verifies filesystem artifact store operations.
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

import {
  sanitizeFilename,
  createRunDirectory,
  writeArtifact,
  readArtifact,
  readArtifactMetadata,
  listArtifacts,
  listArtifactsWithMetadata,
  runDirectoryExists,
} from "./artifact_store";

import type { WorkflowArtifact } from "../types/artifacts";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

let tempDir: string;

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "artifact-store-test-"));
}

function cleanupTempDir(dir: string): void {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// sanitizeFilename
// ---------------------------------------------------------------------------

describe("sanitizeFilename", () => {
  it("should replace unsafe characters with underscores", () => {
    assert.equal(sanitizeFilename("hello world"), "hello_world");
    assert.equal(sanitizeFilename("file/name"), "file_name");
    assert.equal(sanitizeFilename("a\\b:c*d?e"), "a_b_c_d_e");
  });

  it("should collapse multiple underscores", () => {
    assert.equal(sanitizeFilename("a___b"), "a_b");
  });

  it("should trim leading/trailing underscores", () => {
    assert.equal(sanitizeFilename("_test_"), "test");
  });

  it("should lowercase the result", () => {
    assert.equal(sanitizeFilename("MyFile"), "myfile");
  });

  it("should preserve dots, dashes, and alphanumeric", () => {
    assert.equal(sanitizeFilename("my-file_v2.ts"), "my-file_v2.ts");
  });
});

// ---------------------------------------------------------------------------
// createRunDirectory
// ---------------------------------------------------------------------------

describe("createRunDirectory", () => {
  before(() => {
    tempDir = createTempDir();
  });

  after(() => {
    cleanupTempDir(tempDir);
  });

  it("should create a run directory", () => {
    const runDir = createRunDirectory(tempDir, "test-run-001");

    assert.ok(fs.existsSync(runDir));
    assert.ok(fs.statSync(runDir).isDirectory());
  });

  it("should sanitize the run ID in the path", () => {
    const runDir = createRunDirectory(tempDir, "test/run:001");

    assert.ok(fs.existsSync(runDir));
    assert.ok(runDir.includes("test_run_001"));
  });

  it("should be idempotent (creating twice does not fail)", () => {
    const runDir1 = createRunDirectory(tempDir, "idempotent-test");
    const runDir2 = createRunDirectory(tempDir, "idempotent-test");

    assert.equal(runDir1, runDir2);
  });
});

// ---------------------------------------------------------------------------
// writeArtifact / readArtifact
// ---------------------------------------------------------------------------

describe("writeArtifact and readArtifact", () => {
  before(() => {
    tempDir = createTempDir();
  });

  after(() => {
    cleanupTempDir(tempDir);
  });

  it("should write and read a markdown artifact", () => {
    const runDir = createRunDirectory(tempDir, "write-test");

    const artifact: WorkflowArtifact = {
      metadata: {
        id: "art-001",
        type: "context_pack",
        createdAt: "2026-05-31T10:00:00Z",
        producedBy: "context_reader",
        runId: "write-test",
        description: "Test context pack",
      },
      content: "# Context Pack\n\nThis is a test.",
    };

    const ref = writeArtifact(runDir, artifact);

    assert.ok(ref.path);
    assert.equal(ref.id, "art-001");
    assert.equal(ref.type, "context_pack");

    const content = readArtifact(ref.path);
    assert.equal(content, "# Context Pack\n\nThis is a test.");
  });

  it("should write and read a JSON artifact", () => {
    const runDir = createRunDirectory(tempDir, "json-test");

    const artifact: WorkflowArtifact = {
      metadata: {
        id: "art-002",
        type: "task_plan",
        createdAt: "2026-05-31T10:00:00Z",
        producedBy: "planner",
        runId: "json-test",
      },
      content: { steps: [{ id: 1, action: "read files" }] },
    };

    const ref = writeArtifact(runDir, artifact);

    assert.ok(ref.path.endsWith(".json"));

    const raw = readArtifact(ref.path);
    const parsed = JSON.parse(raw);
    assert.deepEqual(parsed, { steps: [{ id: 1, action: "read files" }] });
  });

  it("should write metadata sidecar", () => {
    const runDir = createRunDirectory(tempDir, "meta-test");

    const artifact: WorkflowArtifact = {
      metadata: {
        id: "art-003",
        type: "test_plan",
        createdAt: "2026-05-31T10:00:00Z",
        producedBy: "test_designer",
        runId: "meta-test",
      },
      content: "# Test Plan",
    };

    const ref = writeArtifact(runDir, artifact);
    const metadata = readArtifactMetadata(ref.path);

    assert.ok(metadata);
    assert.equal(metadata.id, "art-003");
    assert.equal(metadata.type, "test_plan");
    assert.equal(metadata.producedBy, "test_designer");
  });

  it("should throw when reading a non-existent file", () => {
    assert.throws(() => {
      readArtifact("/nonexistent/path/artifact.md");
    });
  });
});

// ---------------------------------------------------------------------------
// listArtifacts
// ---------------------------------------------------------------------------

describe("listArtifacts", () => {
  before(() => {
    tempDir = createTempDir();
  });

  after(() => {
    cleanupTempDir(tempDir);
  });

  it("should list all artifacts in a run directory", () => {
    const runDir = createRunDirectory(tempDir, "list-test");

    const artifact1: WorkflowArtifact = {
      metadata: {
        id: "art-001",
        type: "context_pack",
        createdAt: "2026-05-31T10:00:00Z",
        producedBy: "context_reader",
        runId: "list-test",
      },
      content: "# Context Pack 1",
    };

    const artifact2: WorkflowArtifact = {
      metadata: {
        id: "art-002",
        type: "task_plan",
        createdAt: "2026-05-31T10:01:00Z",
        producedBy: "planner",
        runId: "list-test",
      },
      content: "# Task Plan",
    };

    writeArtifact(runDir, artifact1);
    writeArtifact(runDir, artifact2);

    const artifacts = listArtifacts(runDir);
    assert.equal(artifacts.length, 2);
    assert.ok(artifacts.every((a) => !a.endsWith(".meta.json")));
  });

  it("should return empty array for non-existent directory", () => {
    const artifacts = listArtifacts("/nonexistent/dir");
    assert.deepEqual(artifacts, []);
  });
});

// ---------------------------------------------------------------------------
// listArtifactsWithMetadata
// ---------------------------------------------------------------------------

describe("listArtifactsWithMetadata", () => {
  before(() => {
    tempDir = createTempDir();
  });

  after(() => {
    cleanupTempDir(tempDir);
  });

  it("should list artifacts with their metadata", () => {
    const runDir = createRunDirectory(tempDir, "list-meta-test");

    const artifact: WorkflowArtifact = {
      metadata: {
        id: "art-001",
        type: "context_pack",
        createdAt: "2026-05-31T10:00:00Z",
        producedBy: "context_reader",
        runId: "list-meta-test",
        description: "Test artifact",
      },
      content: "# Test",
    };

    writeArtifact(runDir, artifact);

    const results = listArtifactsWithMetadata(runDir);
    assert.equal(results.length, 1);
    assert.ok(results[0].metadata);
    assert.equal(results[0].metadata?.id, "art-001");
    assert.equal(results[0].metadata?.description, "Test artifact");
  });
});

// ---------------------------------------------------------------------------
// runDirectoryExists
// ---------------------------------------------------------------------------

describe("runDirectoryExists", () => {
  before(() => {
    tempDir = createTempDir();
  });

  after(() => {
    cleanupTempDir(tempDir);
  });

  it("should return true for existing run directory", () => {
    createRunDirectory(tempDir, "exists-test");

    assert.equal(runDirectoryExists(tempDir, "exists-test"), true);
  });

  it("should return false for non-existent run directory", () => {
    assert.equal(runDirectoryExists(tempDir, "does-not-exist"), false);
  });
});

// ---------------------------------------------------------------------------
// Path traversal protection
// ---------------------------------------------------------------------------

describe("path traversal protection", () => {
  before(() => {
    tempDir = createTempDir();
  });

  after(() => {
    cleanupTempDir(tempDir);
  });

  it("should sanitize path traversal characters in run ID", () => {
    // The sanitize function replaces slashes with underscores,
    // so path traversal attempts become safe directory names.
    const runDir = createRunDirectory(tempDir, "../../../etc/passwd");

    // The directory should be created inside tempDir, not outside it.
    assert.ok(runDir.startsWith(path.resolve(tempDir)));
    assert.ok(fs.existsSync(runDir));
  });

  it("should sanitize backslashes in run ID", () => {
    const runDir = createRunDirectory(tempDir, "..\\..\\..\\etc\\passwd");

    assert.ok(runDir.startsWith(path.resolve(tempDir)));
    assert.ok(fs.existsSync(runDir));
  });
});
