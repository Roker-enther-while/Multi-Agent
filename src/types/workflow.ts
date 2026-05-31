/**
 * Workflow type contracts for the Multi-Agent AI system.
 *
 * These types model the execution of a complete workflow run,
 * from requirement input to final traceability report.
 */

import type { AgentName, AgentStatus, AgentRunResult } from "./agents";
import type { ArtifactRef, ArtifactType } from "./artifacts";

// ---------------------------------------------------------------------------
// Workflow Phases
// ---------------------------------------------------------------------------

/**
 * Phases of the overall workflow.
 * Each phase groups related steps.
 */
export type WorkflowPhase =
  | "initialization"
  | "scope_gate"
  | "senior_review"
  | "context_reading"
  | "planning"
  | "test_design"
  | "implementation"
  | "verification"
  | "code_review"
  | "reporting"
  | "completed";

// ---------------------------------------------------------------------------
// Workflow Step
// ---------------------------------------------------------------------------

/**
 * A single step in the workflow.
 * Steps are executed sequentially or in parallel as defined by the orchestrator.
 */
export interface WorkflowStep {
  /** Unique step identifier. */
  id: string;

  /** Which agent executes this step. */
  agent: AgentName;

  /** Which phase this step belongs to. */
  phase: WorkflowPhase;

  /** Human-readable description of what this step does. */
  description: string;

  /** Current status of this step. */
  status: AgentStatus;

  /** Which artifact types this step is expected to produce. */
  expectedOutputs: ArtifactType[];

  /** Artifact references produced by this step. */
  outputs: ArtifactRef[];

  /** Which steps must complete before this one can start. */
  dependencies: string[];

  /** ISO timestamp when the step started. */
  startedAt?: string;

  /** ISO timestamp when the step ended. */
  endedAt?: string;

  /** Error message if the step failed. */
  error?: string;
}

// ---------------------------------------------------------------------------
// Workflow Run
// ---------------------------------------------------------------------------

/**
 * Possible states for a workflow run.
 */
export type WorkflowRunStatus =
  | "initialized"
  | "running"
  | "waiting_for_user"
  | "blocked"
  | "failed"
  | "completed";

/**
 * A complete workflow run from requirement to final report.
 */
export interface WorkflowRun {
  /** Unique run identifier (UUID). */
  runId: string;

  /** Current status of the run. */
  status: WorkflowRunStatus;

  /** The original user requirement. */
  requirement: string;

  /** ISO timestamp when the run was created. */
  createdAt: string;

  /** ISO timestamp when the run started executing. */
  startedAt?: string;

  /** ISO timestamp when the run ended. */
  endedAt?: string;

  /** All steps in this run. */
  steps: WorkflowStep[];

  /** All artifacts produced in this run. */
  artifacts: ArtifactRef[];

  /** All blockers encountered in this run. */
  blockers: Blocker[];

  /** All decisions made during this run. */
  decisions: ProjectDecision[];

  /** All verification results from this run. */
  verificationResults: VerificationResult[];

  /** The ID of the currently executing step, if any. */
  currentStepId?: string;

  /** Description of the next step to execute. */
  nextStep?: string;

  /** Scope lock for this run. */
  scopeLock?: ScopeLock;
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

/**
 * A verification command to run.
 */
export interface VerificationCommand {
  /** The shell command to execute. */
  command: string;

  /** Human-readable description of what this command verifies. */
  description: string;

  /** Expected exit code (default 0). */
  expectedExitCode?: number;

  /** String that should appear in stdout if passing. */
  expectedOutput?: string;

  /** Timeout in milliseconds. */
  timeoutMs?: number;
}

/**
 * The result of running a verification command.
 */
export interface VerificationResult {
  /** The command that was run. */
  command: string;

  /** Whether the verification passed. */
  passed: boolean;

  /** The exit code of the command. */
  exitCode: number;

  /** Captured stdout. */
  stdout: string;

  /** Captured stderr. */
  stderr: string;

  /** ISO timestamp when the command was run. */
  runAt: string;

  /** Duration in milliseconds. */
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Blocker
// ---------------------------------------------------------------------------

/**
 * A blocker that prevents the workflow from proceeding.
 */
export interface Blocker {
  /** Unique blocker identifier. */
  id: string;

  /** Which step is blocked. */
  stepId: string;

  /** Which agent reported the blocker. */
  reportedBy: AgentName;

  /** Human-readable reason. */
  reason: string;

  /** What was tried before declaring blocker. */
  tried?: string[];

  /** What is needed to resolve the blocker. */
  requiredAction?: string;

  /** ISO timestamp when the blocker was reported. */
  reportedAt: string;

  /** Whether the blocker has been resolved. */
  resolved: boolean;

  /** ISO timestamp when the blocker was resolved, if applicable. */
  resolvedAt?: string;
}

// ---------------------------------------------------------------------------
// Project Decision
// ---------------------------------------------------------------------------

/**
 * A decision made during the workflow that affects project direction.
 */
export interface ProjectDecision {
  /** Unique decision identifier. */
  id: string;

  /** Which agent made the decision. */
  madeBy: AgentName;

  /** What was decided. */
  decision: string;

  /** Why this decision was made. */
  rationale: string;

  /** Alternatives that were considered. */
  alternatives?: string[];

  /** Risk level of this decision. */
  risk?: "low" | "medium" | "high";

  /** ISO timestamp when the decision was made. */
  madeAt: string;
}

// ---------------------------------------------------------------------------
// Scope Lock
// ---------------------------------------------------------------------------

/**
 * A scope lock that defines what is in and out of scope for this run.
 * Set by the Project Manager and validated by the Senior Layer.
 */
export interface ScopeLock {
  /** The goal of this run. */
  goal: string;

  /** Source of truth for the requirement. */
  sourceOfTruth: string;

  /** Required output artifacts. */
  requiredOutput: string[];

  /** Proof of success criteria. */
  proofOfSuccess: string[];

  /** What is explicitly not being done. */
  notDoingNow: string[];

  /** Current phase. */
  currentPhase: WorkflowPhase;

  /** Next smallest step. */
  nextSmallestStep: string;

  /** ISO timestamp when the scope was locked. */
  lockedAt: string;
}
