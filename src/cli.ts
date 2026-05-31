import * as fs from "fs";
import * as path from "path";

import { buildDemoManifest } from "./demo/demo_manifest";
import { runFullWorkflow } from "./orchestrator/full_workflow_runner";
import { inspectCodebase } from "./tools/code_inspector";
import { readTextFile } from "./tools/file_reader";
import { generateWorkflowReport } from "./tools/report_generator";
import { validateFinalDone } from "./tools/final_done_validator";
import { normalizeRequirementInput, type RequirementInputSourceType } from "./tools/input_source";
import { writeHtmlWorkflowReport } from "./tools/html_report_generator";

export type CliCommand = "run" | "demo" | "validate" | "inspect" | "report";

export interface ParsedCli {
  command?: CliCommand;
  options: Record<string, string | boolean>;
  positionals: string[];
  help: boolean;
}

export interface CliExecutionResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

const COMMANDS: CliCommand[] = ["run", "demo", "validate", "inspect", "report"];

export function parseCliArgs(args: string[]): ParsedCli {
  const [maybeCommand, ...rest] = args;
  const command = COMMANDS.includes(maybeCommand as CliCommand)
    ? maybeCommand as CliCommand
    : undefined;
  const tokens = command ? rest : args;
  const options: Record<string, string | boolean> = {};
  const positionals: string[] = [];
  let help = !command && tokens.length === 0;

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === "--help" || token === "-h") {
      help = true;
      continue;
    }

    if (token.startsWith("--")) {
      const key = token.slice(2);
      const next = tokens[index + 1];
      if (!next || next.startsWith("--")) {
        options[key] = true;
      } else {
        options[key] = next;
        index += 1;
      }
      continue;
    }

    positionals.push(token);
  }

  return { command, options, positionals, help };
}

export async function executeCli(args: string[], cwd: string = process.cwd()): Promise<CliExecutionResult> {
  try {
    const parsed = parseCliArgs(args);
    if (parsed.help) {
      return ok(helpText(parsed.command));
    }

    if (!parsed.command) {
      return fail("Missing command.\n\n" + helpText());
    }

    switch (parsed.command) {
      case "run":
        return await runCommand(parsed, cwd);
      case "demo":
        return await demoCommand(parsed, cwd);
      case "validate":
        return await validateCommand(parsed, cwd);
      case "inspect":
        return inspectCommand(parsed, cwd);
      case "report":
        return await reportCommand(parsed, cwd);
    }
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

function getRequirement(parsed: ParsedCli, cwd: string, required: boolean = true): string {
  const sourceType = typeof parsed.options["source-type"] === "string"
    ? parsed.options["source-type"] as RequirementInputSourceType
    : undefined;
  const text = parsed.options.requirement;
  const file = parsed.options["requirement-file"];
  const jsonField = parsed.options["json-field"];
  const imageReference = parsed.options["image-reference"];
  const voiceTranscript = parsed.options["voice-transcript"];

  if (sourceType === "image_reference" || typeof imageReference === "string") {
    if (typeof imageReference !== "string") {
      throw new Error("Image reference input requires --image-reference <path>.");
    }
    return normalizeRequirementInput(
      { type: "image_reference", path: imageReference },
      { rootDir: cwd }
    ).requirement;
  }

  if (sourceType === "voice_transcript" || typeof voiceTranscript === "string") {
    if (typeof voiceTranscript !== "string") {
      throw new Error("Voice transcript input requires --voice-transcript <text>.");
    }
    return normalizeRequirementInput(
      { type: "voice_transcript", transcript: voiceTranscript },
      { rootDir: cwd }
    ).requirement;
  }

  if (typeof text === "string" && text.trim()) {
    return normalizeRequirementInput({ type: "text", text }, { rootDir: cwd }).requirement;
  }

  if (typeof file === "string" && file.trim()) {
    const type = sourceType === "file_json" || file.toLowerCase().endsWith(".json")
      ? "file_json"
      : "file_markdown";
    return normalizeRequirementInput(
      type === "file_json"
        ? {
            type,
            path: file,
            field: typeof jsonField === "string" ? jsonField : undefined,
          }
        : { type, path: file },
      { rootDir: cwd }
    ).requirement;
  }

  const positionalText = parsed.positionals.join(" ").trim();
  if (positionalText) {
    return positionalText;
  }

  if (!required) {
    return "";
  }

  throw new Error("Requirement is required. Use --requirement, --requirement-file, or positional text.");
}

async function runCommand(parsed: ParsedCli, cwd: string): Promise<CliExecutionResult> {
  const result = await runFullWorkflow(getRequirement(parsed, cwd), workflowOptions(parsed, cwd));
  const htmlReport = writeHtmlWorkflowReport(result);
  const manifest = buildDemoManifest(result, { repoRoot: cwd, htmlReportPath: htmlReport.path });
  const lines = [
    `status=${result.state.status}`,
    `runDir=${result.runDir}`,
    "artifacts:",
    ...result.artifacts.map((artifact) => `- ${artifact.type}: ${artifact.path}`),
    `htmlReport=${htmlReport.path}`,
    `finalValidation=${manifest.finalValidation.passed}`,
  ];

  return result.state.status === "completed" && result.state.blockers.length === 0
    ? ok(lines.join("\n"))
    : fail(lines.join("\n"));
}

async function demoCommand(parsed: ParsedCli, cwd: string): Promise<CliExecutionResult> {
  const requirement = getRequirement(parsed, cwd, false) || undefined;
  const result = await runFullWorkflow(
    requirement ?? "Create a traceable workflow report for a small software change, including context, plan, tests, verification, code review, and final report.",
    {
      runId: "end-to-end-demo",
      baseDir: ".ai_runs",
      rootDir: cwd,
      verificationCommands: [
        {
          command: "node -e \"console.log('e2e verification pass')\"",
          description: "End-to-end deterministic verification",
          expectedOutput: "e2e verification pass",
          timeoutMs: 5000,
        },
      ],
    }
  );
  const manifest = buildDemoManifest(result, { repoRoot: cwd });
  return manifest.finalValidation.passed
    ? ok(JSON.stringify(manifest, null, 2))
    : fail(JSON.stringify(manifest, null, 2));
}

async function validateCommand(parsed: ParsedCli, cwd: string): Promise<CliExecutionResult> {
  const result = await runFullWorkflow(getRequirement(parsed, cwd), workflowOptions(parsed, cwd));
  writeHtmlWorkflowReport(result);
  const validation = validateFinalDone(result, { repoRoot: cwd });
  const output = JSON.stringify(validation, null, 2);
  return validation.passed ? ok(output) : fail(output);
}

function inspectCommand(parsed: ParsedCli, cwd: string): CliExecutionResult {
  const root = typeof parsed.options.root === "string" ? parsed.options.root : ".";
  const summary = inspectCodebase({
    rootDir: path.resolve(cwd, root),
    maxFiles: optionNumber(parsed.options["max-files"], 200),
    includeExtensions: typeof parsed.options.extensions === "string"
      ? parsed.options.extensions.split(",").map((item) => item.trim()).filter(Boolean)
      : undefined,
  });
  return ok(JSON.stringify(summary, null, 2));
}

async function reportCommand(parsed: ParsedCli, cwd: string): Promise<CliExecutionResult> {
  const result = await runFullWorkflow(getRequirement(parsed, cwd), workflowOptions(parsed, cwd));
  const htmlReport = writeHtmlWorkflowReport(result);
  const report = generateWorkflowReport(result.state, {
    title: "CLI Workflow Report",
    artifacts: result.artifacts,
  });
  const reportPath = path.join(result.runDir, "workflow-report.md");
  fs.writeFileSync(reportPath, report, "utf-8");
  const lines = [
    `status=${result.state.status}`,
    `report=${reportPath}`,
    `htmlReport=${htmlReport.path}`,
    "artifacts:",
    ...result.artifacts.map((artifact) => `- ${artifact.type}: ${artifact.path}`),
  ];
  return result.state.status === "completed" && result.state.blockers.length === 0
    ? ok(lines.join("\n"))
    : fail(lines.join("\n"));
}

function workflowOptions(parsed: ParsedCli, cwd: string) {
  const shouldFail = parsed.options["fail-verification"] === true || parsed.options["fail-verification"] === "true";
  return {
    runId: typeof parsed.options["run-id"] === "string" ? parsed.options["run-id"] : undefined,
    baseDir: typeof parsed.options["base-dir"] === "string" ? parsed.options["base-dir"] : ".ai_runs",
    rootDir: cwd,
    verificationCommands: [
      shouldFail
        ? {
            command: "node -e \"process.exit(2)\"",
            description: "Intentional CLI verification failure",
            timeoutMs: 5000,
          }
        : {
            command: "node -e \"console.log('cli verification pass')\"",
            description: "CLI deterministic verification",
            expectedOutput: "cli verification pass",
            timeoutMs: 5000,
          },
    ],
  };
}

function optionNumber(value: string | boolean | undefined, fallback: number): number {
  if (typeof value !== "string") return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function ok(stdout: string): CliExecutionResult {
  return { exitCode: 0, stdout, stderr: "" };
}

function fail(stderr: string): CliExecutionResult {
  return { exitCode: 1, stdout: "", stderr };
}

function helpText(command?: CliCommand): string {
  if (!command) {
    return [
      "Usage: cli <command> [options]",
      "",
      "Commands:",
      "  run       Run the full workflow for a requirement.",
      "  demo      Run the standard end-to-end demo.",
      "  validate  Run workflow and print final validation JSON.",
      "  inspect   Inspect repository files.",
      "  report    Run workflow and write workflow-report.md.",
      "",
      "Use `cli <command> --help` for command-specific help.",
    ].join("\n");
  }

  const shared = [
    "Options:",
    "  --requirement <text>       Requirement text.",
    "  --requirement-file <path>  Read requirement from a repository file.",
    "  --source-type <type>       text, file_markdown, file_json, image_reference, voice_transcript.",
    "  --json-field <field>       JSON field to read for file_json inputs.",
    "  --image-reference <path>   Placeholder image metadata input, no OCR.",
    "  --voice-transcript <text>  Placeholder voice transcript input, no ASR.",
    "  --run-id <id>              Optional run identifier.",
    "  --base-dir <path>          Artifact base directory, default .ai_runs.",
    "  --fail-verification        Test failure behavior.",
  ];

  const help: Record<CliCommand, string[]> = {
    run: ["Usage: cli run [options] [requirement text]", "", ...shared],
    demo: ["Usage: cli demo [options] [requirement text]", "", "Runs the standard demo and prints a JSON manifest.", ...shared.slice(0, 2)],
    validate: ["Usage: cli validate [options] [requirement text]", "", ...shared],
    inspect: [
      "Usage: cli inspect [options]",
      "",
      "Options:",
      "  --root <path>             Root to inspect, default current repository.",
      "  --max-files <number>      Max files to include, default 200.",
      "  --extensions <list>       Comma-separated extensions, for example .ts,.md.",
    ],
    report: ["Usage: cli report [options] [requirement text]", "", ...shared],
  };

  return help[command].join("\n");
}

if (require.main === module) {
  executeCli(process.argv.slice(2)).then((result) => {
    if (result.stdout) {
      console.log(result.stdout);
    }
    if (result.stderr) {
      console.error(result.stderr);
    }
    process.exit(result.exitCode);
  });
}
