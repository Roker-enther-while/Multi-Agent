/**
 * Filesystem artifact store for the Multi-Agent AI workflow.
 *
 * Provides functions to create run directories, write/read/list artifacts.
 * Default base directory: .ai_runs/
 *
 * Rules:
 * - Create directories if missing.
 * - Write markdown or JSON depending on artifact content.
 * - Sanitize filenames to prevent path traversal.
 * - Do not write outside baseDir.
 * - Include timestamp in metadata.
 */

import * as fs from "fs";
import * as path from "path";

import type {
  WorkflowArtifact,
  ArtifactRef,
  ArtifactMetadata,
  ArtifactType,
} from "../types/artifacts";

import { artifactTypeToFilename } from "../types/artifacts";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_BASE_DIR = ".ai_runs";

// ---------------------------------------------------------------------------
// Path Sanitization
// ---------------------------------------------------------------------------

/**
 * Sanitize a string for use as a filename.
 * Removes or replaces characters that are unsafe for filenames.
 *
 * @param input - The string to sanitize.
 * @returns A safe filename string.
 */
export function sanitizeFilename(input: string): string {
  return input
    .replace(/[^a-zA-Z0-9._-]/g, "_") // Replace unsafe chars with underscore
    .replace(/_{2,}/g, "_") // Collapse multiple underscores
    .replace(/^_+|_+$/g, "") // Trim leading/trailing underscores
    .toLowerCase();
}

/**
 * Validate that a resolved path is inside the allowed base directory.
 * Prevents path traversal attacks.
 *
 * @param resolvedPath - The absolute path to validate.
 * @param baseDir - The absolute base directory.
 * @throws Error if the path is outside the base directory.
 */
function assertInsideBaseDir(resolvedPath: string, baseDir: string): void {
  const normalizedBase = path.resolve(baseDir);
  const normalizedTarget = path.resolve(resolvedPath);

  if (!normalizedTarget.startsWith(normalizedBase + path.sep) && normalizedTarget !== normalizedBase) {
    throw new Error(
      `Path traversal detected: ${resolvedPath} is outside ${baseDir}`
    );
  }
}

// ---------------------------------------------------------------------------
// Create Run Directory
// ---------------------------------------------------------------------------

/**
 * Create a directory for a workflow run.
 *
 * @param baseDir - The base directory for all runs (default: .ai_runs).
 * @param runId - The unique run identifier.
 * @returns The absolute path to the created run directory.
 */
export function createRunDirectory(
  baseDir: string = DEFAULT_BASE_DIR,
  runId: string
): string {
  const sanitizedRunId = sanitizeFilename(runId);
  const runDir = path.resolve(baseDir, sanitizedRunId);

  assertInsideBaseDir(runDir, path.resolve(baseDir));

  fs.mkdirSync(runDir, { recursive: true });

  return runDir;
}

// ---------------------------------------------------------------------------
// Write Artifact
// ---------------------------------------------------------------------------

/**
 * Write an artifact to the run directory.
 *
 * @param runDir - The absolute path to the run directory.
 * @param artifact - The artifact to write.
 * @returns The ArtifactRef with the file path set.
 */
export function writeArtifact(
  runDir: string,
  artifact: WorkflowArtifact
): ArtifactRef {
  const baseDir = path.resolve(runDir, "..");
  assertInsideBaseDir(runDir, baseDir);

  // Ensure run directory exists
  fs.mkdirSync(runDir, { recursive: true });

  // Generate filename
  const typeFilename = artifactTypeToFilename(artifact.metadata.type);
  const timestamp = new Date(artifact.metadata.createdAt)
    .toISOString()
    .replace(/[:.]/g, "-")
    .slice(0, 19);

  const extension = artifact.fileExtension ??
    (typeof artifact.content === "string" ? ".md" : ".json");

  const filename = `${timestamp}_${typeFilename}${extension}`;
  const filePath = path.join(runDir, filename);

  // Validate path is inside run directory
  assertInsideBaseDir(filePath, runDir);

  // Write content
  const content = typeof artifact.content === "string"
    ? artifact.content
    : JSON.stringify(artifact.content, null, 2);

  fs.writeFileSync(filePath, content, "utf-8");

  // Write metadata sidecar
  const metadataPath = filePath + ".meta.json";
  fs.writeFileSync(
    metadataPath,
    JSON.stringify(artifact.metadata, null, 2),
    "utf-8"
  );

  return {
    id: artifact.metadata.id,
    type: artifact.metadata.type,
    path: filePath,
    createdAt: artifact.metadata.createdAt,
    producedBy: artifact.metadata.producedBy,
  };
}

// ---------------------------------------------------------------------------
// Read Artifact
// ---------------------------------------------------------------------------

/**
 * Read an artifact from a file path.
 *
 * @param filePath - The absolute path to the artifact file.
 * @returns The artifact content as a string.
 * @throws Error if the file does not exist.
 */
export function readArtifact(filePath: string): string {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Artifact not found: ${filePath}`);
  }

  return fs.readFileSync(filePath, "utf-8");
}

/**
 * Read artifact metadata from the sidecar file.
 *
 * @param filePath - The absolute path to the artifact file.
 * @returns The artifact metadata, or null if the sidecar does not exist.
 */
export function readArtifactMetadata(filePath: string): ArtifactMetadata | null {
  const metadataPath = filePath + ".meta.json";

  if (!fs.existsSync(metadataPath)) {
    return null;
  }

  const raw = fs.readFileSync(metadataPath, "utf-8");
  return JSON.parse(raw) as ArtifactMetadata;
}

// ---------------------------------------------------------------------------
// List Artifacts
// ---------------------------------------------------------------------------

/**
 * List all artifacts in a run directory.
 *
 * @param runDir - The absolute path to the run directory.
 * @returns Array of artifact file paths (excluding metadata sidecars).
 */
export function listArtifacts(runDir: string): string[] {
  if (!fs.existsSync(runDir)) {
    return [];
  }

  const files = fs.readdirSync(runDir);

  return files
    .filter((f) => !f.endsWith(".meta.json"))
    .map((f) => path.join(runDir, f))
    .sort();
}

/**
 * List all artifacts with their metadata.
 *
 * @param runDir - The absolute path to the run directory.
 * @returns Array of { path, metadata } objects.
 */
export function listArtifactsWithMetadata(
  runDir: string
): Array<{ filePath: string; metadata: ArtifactMetadata | null }> {
  const files = listArtifacts(runDir);

  return files.map((filePath) => ({
    filePath,
    metadata: readArtifactMetadata(filePath),
  }));
}

// ---------------------------------------------------------------------------
// Run Directory Exists
// ---------------------------------------------------------------------------

/**
 * Check if a run directory exists.
 *
 * @param baseDir - The base directory for all runs.
 * @param runId - The run identifier.
 * @returns True if the directory exists.
 */
export function runDirectoryExists(
  baseDir: string = DEFAULT_BASE_DIR,
  runId: string
): boolean {
  const sanitizedRunId = sanitizeFilename(runId);
  const runDir = path.resolve(baseDir, sanitizedRunId);
  return fs.existsSync(runDir) && fs.statSync(runDir).isDirectory();
}
