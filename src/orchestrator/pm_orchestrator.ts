import { randomUUID } from "crypto";

import {
  addArtifact,
  addDecision,
  addStep,
  completeStep,
  createInitialProjectState,
  setNextStep,
  setScopeLock,
  setWorkflowStatus,
  type ProjectState,
} from "../state/project_state";
import type { AgentName } from "../types/agents";
import type { ArtifactRef, ArtifactType, WorkflowArtifact } from "../types/artifacts";
import type { WorkflowPhase } from "../types/workflow";
import { createRunDirectory, writeArtifact } from "../tools/artifact_store";
import { getPrompt } from "../prompts";

export interface PMOrchestratorOptions {
  baseDir?: string;
  runId?: string;
}

export interface PMWorkflowResult {
  state: ProjectState;
  runDir: string;
  artifacts: ArtifactRef[];
}

interface PlannedStep {
  id: string;
  agent: AgentName;
  phase: WorkflowPhase;
  description: string;
  expectedOutputs: ArtifactType[];
  dependencies: string[];
}

export class PMOrchestrator {
  private readonly baseDir: string;

  public constructor(options: PMOrchestratorOptions = {}) {
    this.baseDir = options.baseDir ?? ".ai_runs";
  }

  public run(requirement: string, options: PMOrchestratorOptions = {}): PMWorkflowResult {
    const normalizedRequirement = requirement.trim();
    if (!normalizedRequirement) {
      throw new Error("Requirement is required.");
    }

    let state = createInitialProjectState({
      requirement: normalizedRequirement,
      runId: options.runId,
    });
    const runDir = createRunDirectory(options.baseDir ?? this.baseDir, state.runId);

    state = setWorkflowStatus(state, "running");
    state = setScopeLock(state, {
      goal: "Prove the Project Manager workflow can manage and document a requirement.",
      sourceOfTruth: "User requirement string passed to PMOrchestrator.run().",
      requiredOutput: ["requirement", "context_pack", "task_plan", "traceability_report"],
      proofOfSuccess: [
        "ProjectState is created.",
        "Context Pack artifact is written.",
        "Task Plan artifact is written.",
        "Traceability Report artifact is written.",
      ],
      notDoingNow: ["Real LLM calls", "Complex tool execution", "Parallel agent execution"],
      currentPhase: "initialization",
      nextSmallestStep: "Create requirement artifact.",
    });

    const plannedSteps = this.createPlannedSteps();
    for (const step of plannedSteps) {
      state = addStep(state, step);
    }

    const requirementRef = this.writeMarkdownArtifact(
      runDir,
      state.runId,
      "requirement",
      "project_manager",
      "# Requirement\n\n" + normalizedRequirement,
      "Original requirement captured by the Project Manager."
    );
    state = addArtifact(state, requirementRef);

    const contextRef = this.writeContextPack(runDir, state.runId, normalizedRequirement);
    state = addArtifact(state, contextRef);
    state = completeStep(state, "context-pack", [contextRef]);
    state = setNextStep(state, "Generate task plan.");

    const taskPlanRef = this.writeTaskPlan(runDir, state.runId, normalizedRequirement, contextRef);
    state = addArtifact(state, taskPlanRef);
    state = completeStep(state, "task-plan", [taskPlanRef]);
    state = setNextStep(state, "Generate traceability report.");

    const reportRef = this.writeTraceabilityReport(
      runDir,
      state.runId,
      normalizedRequirement,
      requirementRef,
      contextRef,
      taskPlanRef
    );
    state = addArtifact(state, reportRef);
    state = completeStep(state, "traceability-report", [reportRef]);
    state = addDecision(state, {
      madeBy: "project_manager",
      decision: "Use mocked PM artifacts for Phase 0.",
      rationale: "The roadmap explicitly excludes real LLM calls until later phases.",
      alternatives: ["Call an LLM", "Skip artifact generation"],
      risk: "low",
    });
    state = setNextStep(state, "Phase 0 complete; proceed to Tool Integration.");
    state = setWorkflowStatus(state, "completed");

    return {
      state,
      runDir,
      artifacts: state.artifacts,
    };
  }

  private createPlannedSteps(): PlannedStep[] {
    return [
      {
        id: "context-pack",
        agent: "context_reader",
        phase: "context_reading",
        description: "Create a minimal context pack from the requirement and prompt registry.",
        expectedOutputs: ["context_pack"],
        dependencies: [],
      },
      {
        id: "task-plan",
        agent: "planner",
        phase: "planning",
        description: "Create a minimal task plan with traceable steps.",
        expectedOutputs: ["task_plan"],
        dependencies: ["context-pack"],
      },
      {
        id: "traceability-report",
        agent: "reporter_traceability",
        phase: "reporting",
        description: "Create a report linking requirement, context, and task plan artifacts.",
        expectedOutputs: ["traceability_report"],
        dependencies: ["task-plan"],
      },
    ];
  }

  private writeContextPack(runDir: string, runId: string, requirement: string): ArtifactRef {
    const content = [
      "# Context Pack",
      "",
      "## Requirement",
      requirement,
      "",
      "## Available Prompt Context",
      `- Project Manager prompt: ${this.promptStatus("project_manager")}`,
      `- Context Reader prompt: ${this.promptStatus("context_reader")}`,
      `- Planner prompt: ${this.promptStatus("planner")}`,
      `- Reporter Traceability prompt: ${this.promptStatus("reporter_traceability")}`,
      "",
      "## Phase 0 Constraint",
      "This context pack is mocked and deterministic. No LLM calls or external tool execution are performed.",
    ].join("\n");

    return this.writeMarkdownArtifact(
      runDir,
      runId,
      "context_pack",
      "context_reader",
      content,
      "Mock context pack for Phase 0 orchestration."
    );
  }

  private writeTaskPlan(
    runDir: string,
    runId: string,
    requirement: string,
    contextRef: ArtifactRef
  ): ArtifactRef {
    const content = {
      requirement,
      contextPackArtifactId: contextRef.id,
      steps: [
        {
          id: "step-1",
          action: "Capture requirement",
          produces: "requirement",
          traceTo: "user requirement",
        },
        {
          id: "step-2",
          action: "Create context pack",
          produces: "context_pack",
          traceTo: contextRef.id,
        },
        {
          id: "step-3",
          action: "Create traceability report",
          produces: "traceability_report",
          traceTo: ["requirement", "context_pack", "task_plan"],
        },
      ],
    };

    return this.writeJsonArtifact(
      runDir,
      runId,
      "task_plan",
      "planner",
      content,
      "Mock task plan for Phase 0 orchestration."
    );
  }

  private writeTraceabilityReport(
    runDir: string,
    runId: string,
    requirement: string,
    requirementRef: ArtifactRef,
    contextRef: ArtifactRef,
    taskPlanRef: ArtifactRef
  ): ArtifactRef {
    const content = [
      "# Traceability Report",
      "",
      "## Requirement",
      requirement,
      "",
      "## Trace Chain",
      `- Requirement -> ${requirementRef.id} (${requirementRef.path})`,
      `- Context Pack -> ${contextRef.id} (${contextRef.path})`,
      `- Task Plan -> ${taskPlanRef.id} (${taskPlanRef.path})`,
      "- Final Report -> this traceability report",
      "",
      "## Verification Notes",
      "- ProjectState was initialized and completed.",
      "- Required artifacts were written to the run directory.",
      "- Phase 0 intentionally uses mocked content only.",
    ].join("\n");

    return this.writeMarkdownArtifact(
      runDir,
      runId,
      "traceability_report",
      "reporter_traceability",
      content,
      "Traceability report linking Phase 0 artifacts."
    );
  }

  private writeMarkdownArtifact(
    runDir: string,
    runId: string,
    type: ArtifactType,
    producedBy: AgentName,
    content: string,
    description: string
  ): ArtifactRef {
    return writeArtifact(runDir, {
      metadata: this.createMetadata(runId, type, producedBy, description),
      content,
      fileExtension: ".md",
    });
  }

  private writeJsonArtifact(
    runDir: string,
    runId: string,
    type: ArtifactType,
    producedBy: AgentName,
    content: Record<string, unknown>,
    description: string
  ): ArtifactRef {
    return writeArtifact(runDir, {
      metadata: this.createMetadata(runId, type, producedBy, description),
      content,
      fileExtension: ".json",
    });
  }

  private createMetadata(
    runId: string,
    type: ArtifactType,
    producedBy: AgentName,
    description: string
  ): WorkflowArtifact["metadata"] {
    return {
      id: randomUUID(),
      type,
      createdAt: new Date().toISOString(),
      producedBy,
      runId,
      description,
      tags: ["phase-0", "orchestrator"],
    };
  }

  private promptStatus(agentName: AgentName): string {
    const prompt = getPrompt(agentName);
    return prompt ? `available (${prompt.length} characters)` : "missing";
  }
}
