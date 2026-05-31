/**
 * Project state management for the Multi-Agent AI workflow.
 *
 * This module provides pure functions to create and manipulate project state.
 * No external DB. No file IO. Pure and testable.
 */

import { randomUUID } from "crypto";

import type {
  WorkflowRun,
  WorkflowRunStatus,
  WorkflowStep,
  WorkflowPhase,
  VerificationResult,
  Blocker,
  ProjectDecision,
  ScopeLock,
} from "../types/workflow";

import type { ArtifactRef, ArtifactType } from "../types/artifacts";

import type { AgentName, AgentStatus } from "../types/agents";

// ---------------------------------------------------------------------------
// Project State (alias for WorkflowRun)
// ---------------------------------------------------------------------------

/**
 * The project state IS the workflow run.
 * We use WorkflowRun as the single source of truth.
 */
export type ProjectState = WorkflowRun;

// ---------------------------------------------------------------------------
// Create Initial Project State
// ---------------------------------------------------------------------------

/**
 * Create a fresh project state from a user requirement.
 *
 * @param input - The user requirement string or a config object.
 * @returns A new ProjectState in "initialized" status.
 */
export function createInitialProjectState(
  input: string | { requirement: string; runId?: string }
): ProjectState {
  const requirement = typeof input === "string" ? input : input.requirement;
  const runId = typeof input === "string" ? randomUUID() : (input.runId ?? randomUUID());

  return {
    runId,
    status: "initialized",
    requirement,
    createdAt: new Date().toISOString(),
    steps: [],
    artifacts: [],
    blockers: [],
    decisions: [],
    verificationResults: [],
  };
}

// ---------------------------------------------------------------------------
// Add Artifact
// ---------------------------------------------------------------------------

/**
 * Record an artifact reference in the project state.
 *
 * @param state - Current project state (not mutated).
 * @param artifact - The artifact reference to add.
 * @returns New state with the artifact added.
 */
export function addArtifact(
  state: ProjectState,
  artifact: ArtifactRef
): ProjectState {
  return {
    ...state,
    artifacts: [...state.artifacts, artifact],
  };
}

// ---------------------------------------------------------------------------
// Add Decision
// ---------------------------------------------------------------------------

/**
 * Record a project decision in the state.
 *
 * @param state - Current project state (not mutated).
 * @param decision - The decision to add (id and madeAt are auto-generated if missing).
 * @returns New state with the decision added.
 */
export function addDecision(
  state: ProjectState,
  decision: Omit<ProjectDecision, "id" | "madeAt"> & Partial<Pick<ProjectDecision, "id" | "madeAt">>
): ProjectState {
  const fullDecision: ProjectDecision = {
    ...decision,
    id: decision.id ?? randomUUID(),
    madeAt: decision.madeAt ?? new Date().toISOString(),
  };

  return {
    ...state,
    decisions: [...state.decisions, fullDecision],
  };
}

// ---------------------------------------------------------------------------
// Add Verification Result
// ---------------------------------------------------------------------------

/**
 * Record a verification result in the project state.
 *
 * @param state - Current project state (not mutated).
 * @param result - The verification result to add.
 * @returns New state with the result added.
 */
export function addVerificationResult(
  state: ProjectState,
  result: VerificationResult
): ProjectState {
  return {
    ...state,
    verificationResults: [...state.verificationResults, result],
  };
}

// ---------------------------------------------------------------------------
// Add Blocker
// ---------------------------------------------------------------------------

/**
 * Record a blocker in the project state.
 * Automatically sets the workflow status to "blocked".
 *
 * @param state - Current project state (not mutated).
 * @param blocker - The blocker to add (id and reportedAt are auto-generated if missing).
 * @returns New state with the blocker added and status set to "blocked".
 */
export function addBlocker(
  state: ProjectState,
  blocker: Omit<Blocker, "id" | "reportedAt" | "resolved"> & Partial<Pick<Blocker, "id" | "reportedAt" | "resolved">>
): ProjectState {
  const fullBlocker: Blocker = {
    ...blocker,
    id: blocker.id ?? randomUUID(),
    reportedAt: blocker.reportedAt ?? new Date().toISOString(),
    resolved: blocker.resolved ?? false,
  };

  return {
    ...state,
    status: "blocked",
    blockers: [...state.blockers, fullBlocker],
  };
}

// ---------------------------------------------------------------------------
// Complete Step
// ---------------------------------------------------------------------------

/**
 * Mark a workflow step as completed.
 *
 * @param state - Current project state (not mutated).
 * @param stepId - The ID of the step to complete.
 * @param outputs - Optional artifact references produced by this step.
 * @returns New state with the step marked as completed.
 */
export function completeStep(
  state: ProjectState,
  stepId: string,
  outputs?: ArtifactRef[]
): ProjectState {
  const now = new Date().toISOString();

  const steps = state.steps.map((step) => {
    if (step.id !== stepId) return step;
    return {
      ...step,
      status: "completed" as AgentStatus,
      endedAt: now,
      outputs: outputs ?? step.outputs,
    };
  });

  return {
    ...state,
    steps,
  };
}

// ---------------------------------------------------------------------------
// Set Next Step
// ---------------------------------------------------------------------------

/**
 * Set the description of the next step to execute.
 *
 * @param state - Current project state (not mutated).
 * @param nextStep - Human-readable description of the next step.
 * @returns New state with nextStep updated.
 */
export function setNextStep(
  state: ProjectState,
  nextStep: string
): ProjectState {
  return {
    ...state,
    nextStep,
  };
}

// ---------------------------------------------------------------------------
// Set Workflow Status
// ---------------------------------------------------------------------------

/**
 * Update the workflow run status.
 *
 * @param state - Current project state (not mutated).
 * @param status - The new status.
 * @returns New state with updated status and timestamps.
 */
export function setWorkflowStatus(
  state: ProjectState,
  status: WorkflowRunStatus
): ProjectState {
  const now = new Date().toISOString();

  return {
    ...state,
    status,
    startedAt: status === "running" && !state.startedAt ? now : state.startedAt,
    endedAt: (status === "completed" || status === "failed") ? now : state.endedAt,
  };
}

// ---------------------------------------------------------------------------
// Add Step
// ---------------------------------------------------------------------------

/**
 * Add a new workflow step to the state.
 *
 * @param state - Current project state (not mutated).
 * @param step - Step config (id is auto-generated if missing).
 * @returns New state with the step added.
 */
export function addStep(
  state: ProjectState,
  step: Omit<WorkflowStep, "status" | "outputs"> & Partial<Pick<WorkflowStep, "status" | "outputs">>
): ProjectState {
  const fullStep: WorkflowStep = {
    ...step,
    id: step.id ?? randomUUID(),
    status: step.status ?? "pending",
    outputs: step.outputs ?? [],
  };

  return {
    ...state,
    steps: [...state.steps, fullStep],
  };
}

// ---------------------------------------------------------------------------
// Set Scope Lock
// ---------------------------------------------------------------------------

/**
 * Set the scope lock for the workflow run.
 *
 * @param state - Current project state (not mutated).
 * @param scopeLock - The scope lock to set.
 * @returns New state with scopeLock set.
 */
export function setScopeLock(
  state: ProjectState,
  scopeLock: Omit<ScopeLock, "lockedAt"> & Partial<Pick<ScopeLock, "lockedAt">>
): ProjectState {
  const fullScopeLock: ScopeLock = {
    ...scopeLock,
    lockedAt: scopeLock.lockedAt ?? new Date().toISOString(),
  };

  return {
    ...state,
    scopeLock: fullScopeLock,
  };
}

// ---------------------------------------------------------------------------
// Resolve Blocker
// ---------------------------------------------------------------------------

/**
 * Mark a blocker as resolved.
 *
 * @param state - Current project state (not mutated).
 * @param blockerId - The ID of the blocker to resolve.
 * @returns New state with the blocker marked as resolved.
 *          If no more blockers remain, status changes to "running".
 */
export function resolveBlocker(
  state: ProjectState,
  blockerId: string
): ProjectState {
  const now = new Date().toISOString();

  const blockers = state.blockers.map((b) => {
    if (b.id !== blockerId) return b;
    return { ...b, resolved: true, resolvedAt: now };
  });

  const hasUnresolved = blockers.some((b) => !b.resolved);

  return {
    ...state,
    blockers,
    status: hasUnresolved ? state.status : "running",
  };
}

// ---------------------------------------------------------------------------
// Get Current Step
// ---------------------------------------------------------------------------

/**
 * Get the currently executing step, if any.
 *
 * @param state - Current project state.
 * @returns The current step or undefined.
 */
export function getCurrentStep(state: ProjectState): WorkflowStep | undefined {
  if (state.currentStepId) {
    return state.steps.find((s) => s.id === state.currentStepId);
  }
  return state.steps.find((s) => s.status === "running");
}

// ---------------------------------------------------------------------------
// Get Artifacts By Type
// ---------------------------------------------------------------------------

/**
 * Get all artifacts of a specific type.
 *
 * @param state - Current project state.
 * @param type - The artifact type to filter by.
 * @returns Array of matching artifact references.
 */
export function getArtifactsByType(
  state: ProjectState,
  type: ArtifactType
): ArtifactRef[] {
  return state.artifacts.filter((a) => a.type === type);
}
