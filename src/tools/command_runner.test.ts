import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { isCommandAllowed, runVerificationCommand } from "./command_runner";

describe("command_runner", () => {
  it("should run a passing verification command", async () => {
    const result = await runVerificationCommand({
      command: "node -e \"console.log('ok')\"",
      description: "prints ok",
      expectedOutput: "ok",
      timeoutMs: 5000,
    });

    assert.equal(result.passed, true);
    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /ok/);
  });

  it("should return a failing verification result for non-zero exit", async () => {
    const result = await runVerificationCommand({
      command: "node -e \"process.exit(3)\"",
      description: "exits with code 3",
      timeoutMs: 5000,
    });

    assert.equal(result.passed, false);
    assert.equal(result.exitCode, 3);
  });

  it("should reject disallowed destructive command patterns", async () => {
    assert.equal(isCommandAllowed("git reset --hard"), false);

    const result = await runVerificationCommand({
      command: "git reset --hard",
      description: "destructive command",
    });

    assert.equal(result.passed, false);
    assert.equal(result.exitCode, -1);
    assert.match(result.stderr, /safety policy/);
  });
});
