import { spawn } from "child_process";

import type { VerificationCommand, VerificationResult } from "../types/workflow";

export interface CommandRunnerOptions {
  cwd?: string;
}

const DISALLOWED_PATTERNS = [
  /\brm\s+-rf\b/i,
  /\bRemove-Item\b.*\b-Recurse\b/i,
  /\brmdir\b.*\b\/s\b/i,
  /\bdel\b.*\b\/s\b/i,
  /\bgit\s+reset\s+--hard\b/i,
  /\bgit\s+checkout\s+--\b/i,
];

export function isCommandAllowed(command: string): boolean {
  return !DISALLOWED_PATTERNS.some((pattern) => pattern.test(command));
}

export async function runVerificationCommand(
  verification: VerificationCommand,
  options: CommandRunnerOptions = {}
): Promise<VerificationResult> {
  const startedAt = Date.now();
  const runAt = new Date().toISOString();
  const expectedExitCode = verification.expectedExitCode ?? 0;

  if (!isCommandAllowed(verification.command)) {
    return {
      command: verification.command,
      passed: false,
      exitCode: -1,
      stdout: "",
      stderr: "Command rejected by safety policy.",
      runAt,
      durationMs: Date.now() - startedAt,
    };
  }

  return new Promise((resolve) => {
    const child = spawn(verification.command, {
      cwd: options.cwd,
      shell: true,
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timeout = verification.timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          child.kill();
        }, verification.timeoutMs)
      : undefined;

    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("close", (code) => {
      if (timeout) clearTimeout(timeout);

      const exitCode = timedOut ? -1 : (code ?? -1);
      const outputMatched = verification.expectedOutput
        ? stdout.includes(verification.expectedOutput)
        : true;

      resolve({
        command: verification.command,
        passed: !timedOut && exitCode === expectedExitCode && outputMatched,
        exitCode,
        stdout,
        stderr: timedOut ? `${stderr}\nCommand timed out.`.trim() : stderr,
        runAt,
        durationMs: Date.now() - startedAt,
      });
    });

    child.on("error", (error) => {
      if (timeout) clearTimeout(timeout);
      resolve({
        command: verification.command,
        passed: false,
        exitCode: -1,
        stdout,
        stderr: error.message,
        runAt,
        durationMs: Date.now() - startedAt,
      });
    });
  });
}
