import { randomUUID } from "crypto";

import type { BaseAgent } from "../agents/base_agent";
import { createDefaultMockAgents } from "../agents/mock_agents";
import {
  addArtifact,
  addBlocker,
  addDecision,
  addStep,
  addVerificationResult,
  completeStep,
  createInitialProjectState,
  setNextStep,
  setScopeLock,
  setWorkflowStatus,
  type ProjectState,
} from "../state/project_state";
import { createRunDirectory, writeArtifact } from "../tools/artifact_store";
import { inspectCodebase } from "../tools/code_inspector";
import { runVerificationCommand } from "../tools/command_runner";
import type { AgentFinding, AgentInput, AgentRunResult } from "../types/agents";
import type { ArtifactRef, ArtifactType } from "../types/artifacts";
import type { VerificationCommand, VerificationResult, WorkflowPhase } from "../types/workflow";

export interface AgentCoordinatorOptions {
  baseDir?: string;
  rootDir?: string;
  runId?: string;
  verificationCommands?: VerificationCommand[];
  agents?: BaseAgent[];
}

export interface AgentCoordinatorResult {
  state: ProjectState;
  runDir: string;
  artifacts: ArtifactRef[];
  agentResults: AgentRunResult[];
  findings: AgentFinding[];
}

interface WorkflowAgentStep {
  id: string;
  phase: WorkflowPhase;
  artifactType: ArtifactType;
  description: string;
  dependencies: string[];
}

const DEFAULT_VERIFICATION_COMMANDS: VerificationCommand[] = [
  {
    command: "node -e \"console.log('verification pass')\"",
    description: "Deterministic local smoke check",
    expectedOutput: "verification pass",
    timeoutMs: 5000,
  },
];

const WORKFLOW_STEPS: WorkflowAgentStep[] = [
  {
    id: "context-pack",
    phase: "context_reading",
    artifactType: "context_pack",
    description: "Read local repository context.",
    dependencies: [],
  },
  {
    id: "task-plan",
    phase: "planning",
    artifactType: "task_plan",
    description: "Create a task plan from the context pack.",
    dependencies: ["context-pack"],
  },
  {
    id: "test-plan",
    phase: "test_design",
    artifactType: "test_plan",
    description: "Create a deterministic verification plan.",
    dependencies: ["task-plan"],
  },
  {
    id: "implementation-summary",
    phase: "implementation",
    artifactType: "implementation_summary",
    description: "Summarize implementation work.",
    dependencies: ["test-plan"],
  },
  {
    id: "verification-report",
    phase: "verification",
    artifactType: "verification_report",
    description: "Run and report verification commands.",
    dependencies: ["implementation-summary"],
  },
  {
    id: "code-review-report",
    phase: "code_review",
    artifactType: "code_review_report",
    description: "Generate code review report.",
    dependencies: ["verification-report"],
  },
  {
    id: "traceability-report",
    phase: "reporting",
    artifactType: "traceability_report",
    description: "Generate traceability report.",
    dependencies: ["code-review-report"],
  },
  {
    id: "final-report",
    phase: "reporting",
    artifactType: "final_report",
    description: "Generate final report.",
    dependencies: ["traceability-report"],
  },
];

export class AgentCoordinator {
  private readonly baseDir: string;
  private readonly rootDir: string;
  private readonly agents: BaseAgent[];

  public constructor(options: AgentCoordinatorOptions = {}) {
    this.baseDir = options.baseDir ?? ".ai_runs";
    this.rootDir = options.rootDir ?? process.cwd();
    this.agents = options.agents ?? createDefaultMockAgents();
  }

  public async run(requirement: string, options: AgentCoordinatorOptions = {}): Promise<AgentCoordinatorResult> {
    const normalizedRequirement = requirement.trim();
    if (!normalizedRequirement) {
      throw new Error("Requirement is required.");
    }

    const verificationCommands = options.verificationCommands ?? DEFAULT_VERIFICATION_COMMANDS;
    let state = createInitialProjectState({
      requirement: normalizedRequirement,
      runId: options.runId,
    });
    const runDir = createRunDirectory(options.baseDir ?? this.baseDir, state.runId);
    const agentResults: AgentRunResult[] = [];
    const findings: AgentFinding[] = [];
    const artifactsByType = new Map<ArtifactType, ArtifactRef>();

    state = setWorkflowStatus(state, "running");
    state = setScopeLock(state, {
      goal: "Run the deterministic full agent workflow from requirement to final report.",
      sourceOfTruth: "User requirement string passed to AgentCoordinator.run().",
      requiredOutput: WORKFLOW_STEPS.map((step) => step.artifactType),
      proofOfSuccess: [
        "All agents return structured AgentRunResult objects.",
        "Required artifacts are written to the run directory.",
        "Verification results are recorded in ProjectState.",
        "Code review and final report are generated.",
      ],
      notDoingNow: ["Real LLM calls", "Network tools", "Parallel agent execution"],
      currentPhase: "initialization",
      nextSmallestStep: "Run context reader agent.",
    });

    for (let index = 0; index < WORKFLOW_STEPS.length; index += 1) {
      const step = WORKFLOW_STEPS[index];
      const agent = this.agents[index];
      if (!agent) {
        state = addBlocker(state, {
          stepId: step.id,
          reportedBy: "project_manager",
          reason: `Missing agent for step ${step.id}.`,
          requiredAction: "Register a deterministic agent for this workflow step.",
        });
        break;
      }

      state = addStep(state, {
        id: step.id,
        agent: agent.name,
        phase: step.phase,
        description: step.description,
        expectedOutputs: [step.artifactType],
        dependencies: step.dependencies,
        status: "running",
      });

      const verificationResults = step.artifactType === "verification_report"
        ? await this.runVerificationCommands(verificationCommands, options.rootDir ?? this.rootDir)
        : [];
      for (const result of verificationResults) {
        state = addVerificationResult(state, result);
      }

      const input = this.createAgentInput(normalizedRequirement, artifactsByType, verificationCommands, verificationResults);
      const result = await agent.execute(input);
      agentResults.push(result);
      if (result.output?.findings) findings.push(...result.output.findings);

      if (result.status !== "completed" || !result.output) {
        state = addBlocker(state, {
          stepId: step.id,
          reportedBy: agent.name,
          reason: result.error ?? result.blocker ?? `Agent ${agent.name} did not complete.`,
          requiredAction: "Inspect agent result and retry after fixing the failure.",
        });
        break;
      }

      const validation = agent.validate(result.output);
      if (!validation.valid) {
        state = addBlocker(state, {
          stepId: step.id,
          reportedBy: agent.name,
          reason: validation.errors.join("; "),
          requiredAction: "Fix invalid agent output.",
        });
        break;
      }

      const artifact = writeArtifact(runDir, {
        metadata: {
          id: randomUUID(),
          type: step.artifactType,
          createdAt: new Date().toISOString(),
          producedBy: agent.name,
          runId: state.runId,
          stepId: step.id,
          description: step.description,
          tags: ["phase-2", "full-workflow"],
        },
        content: result.output.report,
        fileExtension: ".md",
      });

      artifactsByType.set(step.artifactType, artifact);
      state = addArtifact(state, artifact);
      state = completeStep(state, step.id, [artifact]);
      for (const decision of result.output.decisions) {
        state = addDecision(state, { madeBy: agent.name, ...decision });
      }

      if (step.artifactType === "verification_report" && verificationResults.some((item) => !item.passed)) {
        state = addBlocker(state, {
          stepId: step.id,
          reportedBy: agent.name,
          reason: "One or more verification commands failed.",
          tried: verificationResults.map((item) => item.command),
          requiredAction: "Fix failing verification before code review and final reporting.",
        });
        break;
      }

      state = setNextStep(state, this.nextStepDescription(index + 1));
    }

    if (state.status !== "blocked") {
      state = setWorkflowStatus(state, "completed");
    }

    return {
      state,
      runDir,
      artifacts: state.artifacts,
      agentResults,
      findings,
    };
  }

  private async runVerificationCommands(
    commands: VerificationCommand[],
    cwd: string
  ): Promise<VerificationResult[]> {
    const results: VerificationResult[] = [];
    for (const command of commands) {
      results.push(await runVerificationCommand(command, { cwd }));
    }
    return results;
  }

  private createAgentInput(
    requirement: string,
    artifactsByType: Map<ArtifactType, ArtifactRef>,
    verificationCommands: VerificationCommand[],
    verificationResults: VerificationResult[]
  ): AgentInput {
    const codeSummary = inspectCodebase({
      rootDir: this.rootDir,
      maxFiles: 200,
      includeExtensions: [".ts", ".md", ".json"],
    });

    return {
      requirement,
      contextPackPath: artifactsByType.get("context_pack")?.path,
      taskPlanPath: artifactsByType.get("task_plan")?.path,
      testPlanPath: artifactsByType.get("test_plan")?.path,
      implementationSummaryPath: artifactsByType.get("implementation_summary")?.path,
      verificationReportPath: artifactsByType.get("verification_report")?.path,
      codeReviewReportPath: artifactsByType.get("code_review_report")?.path,
      extra: {
        codeSummary,
        verificationCommands,
        verificationResults,
        traceabilityReportPath: artifactsByType.get("traceability_report")?.path,
      },
    };
  }

  private nextStepDescription(nextIndex: number): string {
    const nextStep = WORKFLOW_STEPS[nextIndex];
    return nextStep ? nextStep.description : "Full deterministic workflow complete.";
  }
}
