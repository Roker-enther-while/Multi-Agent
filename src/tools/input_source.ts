import * as path from "path";

import { readTextFile } from "./file_reader";

export type RequirementInputSourceType =
  | "text"
  | "file_markdown"
  | "file_json"
  | "image_reference"
  | "voice_transcript";

export type RequirementInputSource =
  | { type: "text"; text: string }
  | { type: "file_markdown"; path: string }
  | { type: "file_json"; path: string; field?: string }
  | { type: "image_reference"; path: string; metadata?: Record<string, unknown> }
  | { type: "voice_transcript"; transcript: string; mediaPath?: string };

export interface RequirementInput {
  sourceType: RequirementInputSourceType;
  requirement: string;
  sourceRef?: string;
  metadata: Record<string, unknown>;
}

export interface NormalizeRequirementOptions {
  rootDir: string;
}

export function normalizeRequirementInput(
  source: RequirementInputSource,
  options: NormalizeRequirementOptions
): RequirementInput {
  switch (source.type) {
    case "text":
      return makeRequirement("text", source.text, undefined, {});
    case "file_markdown": {
      const file = readTextFile(options.rootDir, source.path);
      return makeRequirement("file_markdown", file.content, file.relativePath, {
        sizeBytes: file.sizeBytes,
        modifiedAt: file.modifiedAt,
      });
    }
    case "file_json": {
      const file = readTextFile(options.rootDir, source.path);
      const parsed = JSON.parse(file.content) as unknown;
      const requirement = extractJsonRequirement(parsed, source.field);
      return makeRequirement("file_json", requirement, file.relativePath, {
        sizeBytes: file.sizeBytes,
        modifiedAt: file.modifiedAt,
        field: source.field,
      });
    }
    case "image_reference":
      return makeRequirement(
        "image_reference",
        `Image requirement placeholder for ${path.basename(source.path)}. Real OCR/image understanding is not implemented yet.`,
        source.path,
        { ...(source.metadata ?? {}), placeholder: true }
      );
    case "voice_transcript":
      return makeRequirement("voice_transcript", source.transcript, source.mediaPath, {
        placeholder: true,
        note: "Real ASR is not implemented yet; using provided transcript text.",
      });
  }
}

function makeRequirement(
  sourceType: RequirementInputSourceType,
  requirement: string,
  sourceRef: string | undefined,
  metadata: Record<string, unknown>
): RequirementInput {
  const normalized = requirement.trim();
  if (!normalized) {
    throw new Error(`Requirement input from ${sourceType} is empty.`);
  }

  return {
    sourceType,
    requirement: normalized,
    sourceRef,
    metadata,
  };
}

function extractJsonRequirement(parsed: unknown, field?: string): string {
  if (typeof parsed === "string") {
    return parsed;
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("JSON requirement input must be a string or object.");
  }

  const object = parsed as Record<string, unknown>;
  if (field) {
    const value = object[field];
    if (typeof value !== "string") {
      throw new Error(`JSON field ${field} must be a string.`);
    }
    return value;
  }

  for (const candidate of ["requirement", "text", "description"]) {
    if (typeof object[candidate] === "string") {
      return object[candidate] as string;
    }
  }

  const title = typeof object.title === "string" ? object.title : "";
  const description = typeof object.description === "string" ? object.description : "";
  if (title || description) {
    return [title, description].filter(Boolean).join("\n\n");
  }

  throw new Error("JSON requirement input needs a requirement, text, description, or configured field.");
}
