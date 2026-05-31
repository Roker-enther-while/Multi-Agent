/**
 * Agent type contracts for the Multi-Agent AI workflow.
 *
 * These types define the shape of every agent in the system.
 * Agents that do not have prompts yet (BA Artifact, Visual Modeling)
 * are included to reserve their names and prepare for future integration.
 */

// ---------------------------------------------------------------------------
// Agent Names
// ---------------------------------------------------------------------------

/**
 * All logical agents in the workflow.
 * Each name corresponds to a distinct responsibility.
 */
export type AgentName =
  | "project_manager"
  | "senior_layer"
  | "ba_artifact"
  | "visual_modeling"
  | "context_reader"
  | "planner"
  | "test_designer"
  | "implementation"
  | "test_runner_debugger"
  | "code_reviewer"
  | "reporter_traceability";

// ---------------------------------------------------------------------------
// Agent Status
// ---------------------------------------------------------------------------

/**
 * Possible states for an agent run.
 */
export type AgentStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "blocked"
  | "skipped";

// ---------------------------------------------------------------------------
// Agent Input / Output
// ---------------------------------------------------------------------------

/**
 * Input given to an agent when it is invoked.
 * Each agent receives a subset of these depending on its role.
 */
export interface AgentInput {
  /** The user requirement or task description. */
  requirement?: string;

  /** Path to the Context Pack artifact, if available. */
  contextPackPath?: string;

  /** Path to the Task Plan artifact, if available. */
  taskPlanPath?: string;

  /** Path to the Test Plan artifact, if available. */
  testPlanPath?: string;

  /** Path to the Senior Layer review artifact, if available. */
  seniorReviewPath?: string;

  /** Path to the Implementation Summary artifact, if available. */
  implementationSummaryPath?: string;

  /** Path to the Verification Report artifact, if available. */
  verificationReportPath?: string;

  /** Path to the Code Review Report artifact, if available. */
  codeReviewReportPath?: string;

  /** Additional key-value context passed by the orchestrator. */
  extra?: Record<string, unknown>;
}

/**
 * Output produced by an agent after execution.
 */
export interface AgentOutput {
  /** The structured Markdown report produced by the agent. */
  report: string;

  /** Artifact references produced by this run. */
  artifacts: ArtifactRef[];

  /** Decisions made by the agent during execution. */
  decisions: AgentDecision[];

  /** Findings or issues discovered. */
  findings: AgentFinding[];
}

// ---------------------------------------------------------------------------
// Agent Run Result
// ---------------------------------------------------------------------------

/**
 * The complete result of a single agent run,
 * including status, timing, and output.
 */
export interface AgentRunResult {
  /** Which agent ran. */
  agent: AgentName;

  /** Current status of this run. */
  status: AgentStatus;

  /** ISO timestamp when the run started. */
  startedAt: string;

  /** ISO timestamp when the run ended, if completed/failed. */
  endedAt?: string;

  /** The output produced, if completed. */
  output?: AgentOutput;

  /** Error message if the run failed. */
  error?: string;

  /** If blocked, the blocker description. */
  blocker?: string;
}

// ---------------------------------------------------------------------------
// Agent Finding
// ---------------------------------------------------------------------------

/**
 * A finding or issue discovered by an agent.
 */
export interface AgentFinding {
  /** Severity level. */
  severity: "high" | "medium" | "low" | "info";

  /** Category of the finding. */
  category: "requirement" | "test" | "security" | "quality" | "scope" | "architecture" | "other";

  /** File path related to the finding, if applicable. */
  file?: string;

  /** Line number in the file, if applicable. */
  line?: number;

  /** Human-readable description. */
  description: string;

  /** Suggested fix or action. */
  suggestion?: string;
}

// ---------------------------------------------------------------------------
// Agent Decision
// ---------------------------------------------------------------------------

/**
 * A decision made by an agent during execution.
 * Used for traceability and audit.
 */
export interface AgentDecision {
  /** What was decided. */
  decision: string;

  /** Why this decision was made. */
  rationale: string;

  /** What alternatives were considered. */
  alternatives?: string[];

  /** Risk level of this decision. */
  risk?: "low" | "medium" | "high";
}

// ---------------------------------------------------------------------------
// Internal imports for type references
// ---------------------------------------------------------------------------

/**
 * Reference to an artifact produced by an agent.
 * Defined here to avoid circular imports with artifacts.ts.
 * The full ArtifactRef type is in artifacts.ts.
 */
interface ArtifactRef {
  /** Unique artifact identifier. */
  id: string;

  /** Type of artifact. */
  type: string;

  /** File path where the artifact is stored. */
  path: string;
}
