import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { executeCli, parseCliArgs } from "./cli";

function tempRepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-test-"));
  fs.writeFileSync(path.join(dir, "AGENT_REPORT.md"), "# report\n", "utf-8");
  fs.writeFileSync(path.join(dir, "PHASE_LOG.md"), "# log\n", "utf-8");
  fs.writeFileSync(path.join(dir, "NEXT_STEP.md"), "# next\n", "utf-8");
  fs.writeFileSync(path.join(dir, "requirement.md"), "Add CLI test coverage\n", "utf-8");
  return dir;
}

function cleanup(dir: string): void {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

describe("CLI parsing", () => {
  it("should parse commands, options, and positionals", () => {
    const parsed = parseCliArgs(["run", "--run-id", "abc", "Add", "feature"]);
    assert.equal(parsed.command, "run");
    assert.equal(parsed.options["run-id"], "abc");
    assert.deepEqual(parsed.positionals, ["Add", "feature"]);
  });

  it("should detect command help", () => {
    const parsed = parseCliArgs(["validate", "--help"]);
    assert.equal(parsed.command, "validate");
    assert.equal(parsed.help, true);
  });
});

describe("CLI execution", () => {
  it("should print top-level help", async () => {
    const result = await executeCli(["--help"]);
    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /run/);
    assert.match(result.stdout, /validate/);
  });

  it("should run workflow from requirement file and print artifact paths", async () => {
    const dir = tempRepo();
    try {
      const result = await executeCli([
        "run",
        "--requirement-file",
        "requirement.md",
        "--run-id",
        "cli-run",
      ], dir);

      assert.equal(result.exitCode, 0);
      assert.match(result.stdout, /status=completed/);
      assert.match(result.stdout, /artifacts:/);
      assert.match(result.stdout, /final_report/);
    } finally {
      cleanup(dir);
    }
  });

  it("should return non-zero when verification fails", async () => {
    const dir = tempRepo();
    try {
      const result = await executeCli([
        "validate",
        "--requirement",
        "Fail this verification",
        "--fail-verification",
      ], dir);

      assert.equal(result.exitCode, 1);
      assert.match(result.stderr, /"passed": false/);
    } finally {
      cleanup(dir);
    }
  });

  it("should return non-zero when requirement is missing", async () => {
    const result = await executeCli(["run"]);
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /Requirement is required/);
  });
});
