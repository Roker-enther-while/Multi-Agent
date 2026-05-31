/**
 * Artifact type contracts for the Multi-Agent AI workflow.
 *
 * Artifacts are the structured outputs produced by each agent.
 * They form the traceability chain from requirement to final report.
 */

// ---------------------------------------------------------------------------
// Artifact Types
// ---------------------------------------------------------------------------

/**
 * All artifact types produced by the workflow.
 * Each type corresponds to a specific agent output.
 */
export type ArtifactType =
  | "requirement"
  | "senior_review"
  | "ba_requirement_package"
  | "visual_model_package"
  | "context_pack"
  | "task_plan"
  | "test_plan"
  | "implementation_summary"
  | "verification_report"
  | "code_review_report"
  | "traceability_report"
  | "final_report"
  | "blocker_report";

// ---------------------------------------------------------------------------
// Artifact Reference
// ---------------------------------------------------------------------------

/**
 * A lightweight reference to an artifact.
 * Used in agent outputs and state tracking without loading full content.
 */
export interface ArtifactRef {
  /** Unique artifact identifier (UUID or generated). */
  id: string;

  /** Type of artifact. */
  type: ArtifactType;

  /** File path where the artifact is stored. */
  path: string;

  /** ISO timestamp when the artifact was created. */
  createdAt: string;

  /** Which agent produced this artifact. */
  producedBy: string;
}

// ---------------------------------------------------------------------------
// Artifact Metadata
// ---------------------------------------------------------------------------

/**
 * Metadata attached to every artifact.
 * Stored alongside the artifact content.
 */
export interface ArtifactMetadata {
  /** Unique artifact identifier. */
  id: string;

  /** Type of artifact. */
  type: ArtifactType;

  /** ISO timestamp when the artifact was created. */
  createdAt: string;

  /** Which agent produced this artifact. */
  producedBy: string;

  /** Which workflow run this artifact belongs to. */
  runId: string;

  /** Which step in the task plan produced this artifact. */
  stepId?: string;

  /** Human-readable description of the artifact. */
  description?: string;

  /** Tags for filtering or grouping. */
  tags?: string[];
}

// ---------------------------------------------------------------------------
// Workflow Artifact
// ---------------------------------------------------------------------------

/**
 * A complete artifact with metadata and content.
 * This is what gets written to the artifact store.
 */
export interface WorkflowArtifact {
  /** Artifact metadata. */
  metadata: ArtifactMetadata;

  /**
   * The artifact content.
   * - For structured data: JSON-serializable object.
   * - For reports: Markdown string.
   */
  content: string | Record<string, unknown>;

  /**
   * File extension hint for the artifact store.
   * Defaults to ".md" for string content, ".json" for objects.
   */
  fileExtension?: string;
}

// ---------------------------------------------------------------------------
// Helper: Create Artifact Ref
// ---------------------------------------------------------------------------

/**
 * Create an ArtifactRef from a WorkflowArtifact.
 */
export function createArtifactRef(artifact: WorkflowArtifact): ArtifactRef {
  return {
    id: artifact.metadata.id,
    type: artifact.metadata.type,
    path: "", // Path is set by the artifact store
    createdAt: artifact.metadata.createdAt,
    producedBy: artifact.metadata.producedBy,
  };
}

// ---------------------------------------------------------------------------
// Helper: Artifact Type to Filename
// ---------------------------------------------------------------------------

/**
 * Map artifact type to a safe filename base.
 * Used by the artifact store to generate filenames.
 */
export function artifactTypeToFilename(type: ArtifactType): string {
  if (type === "ba_requirement_package" || type === "visual_model_package") {
    return type;
  }
  return type.replace(/_/g, "-");
}
