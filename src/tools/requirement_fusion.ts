import * as fs from "fs";
import * as path from "path";

export interface InputSource {
  type: "text" | "file" | "image" | "voice";
  content: string;
  filename?: string;
  metadata?: Record<string, unknown>;
}

export interface ImageUnderstanding {
  filename: string;
  metadata: { width?: number; height?: number; format?: string };
  extractedText?: string;
  description?: string;
  source: "mock" | "ocr" | "vision_llm";
}

export interface VoiceUnderstanding {
  filename: string;
  transcript?: string;
  duration?: number;
  source: "mock" | "transcript_file" | "whisper_api" | "local_whisper";
}

export interface UnifiedRequirement {
  textRequirement: string;
  imageUnderstanding: ImageUnderstanding[];
  voiceUnderstanding: VoiceUnderstanding[];
  fileContents: Array<{ filename: string; content: string }>;
  unifiedText: string;
}

export function processImageInput(source: InputSource): ImageUnderstanding {
  const filename = source.filename || "uploaded_image";
  return {
    filename,
    metadata: {
      format: path.extname(filename).slice(1) || "unknown",
    },
    description: `[Mock image understanding] Image uploaded: ${filename}. No real vision/OCR provider configured.`,
    source: "mock",
  };
}

export function processVoiceInput(source: InputSource): VoiceUnderstanding {
  const filename = source.filename || "uploaded_audio";

  // If it's a transcript file (.txt), use the content directly
  if (filename.endsWith(".txt") || filename.endsWith(".md")) {
    return {
      filename,
      transcript: source.content,
      source: "transcript_file",
    };
  }

  return {
    filename,
    transcript: `[NEED_TRANSCRIPTION] Audio file uploaded: ${filename}. No real ASR provider configured. Upload a .txt transcript instead.`,
    source: "mock",
  };
}

export function processFileInput(source: InputSource): { filename: string; content: string } {
  return {
    filename: source.filename || "uploaded_file",
    content: source.content,
  };
}

export function fuseRequirements(
  textRequirement: string,
  sources: InputSource[]
): UnifiedRequirement {
  const imageUnderstanding: ImageUnderstanding[] = [];
  const voiceUnderstanding: VoiceUnderstanding[] = [];
  const fileContents: Array<{ filename: string; content: string }> = [];

  for (const source of sources) {
    switch (source.type) {
      case "image":
        imageUnderstanding.push(processImageInput(source));
        break;
      case "voice":
        voiceUnderstanding.push(processVoiceInput(source));
        break;
      case "file":
        fileContents.push(processFileInput(source));
        break;
    }
  }

  // Build unified text
  const parts: string[] = [];
  parts.push(`## Text Requirement\n${textRequirement}`);

  if (fileContents.length > 0) {
    parts.push("\n## Attached Files");
    for (const file of fileContents) {
      parts.push(`### ${file.filename}\n${file.content.slice(0, 2000)}`);
    }
  }

  if (imageUnderstanding.length > 0) {
    parts.push("\n## Image Understanding");
    for (const img of imageUnderstanding) {
      parts.push(`- **${img.filename}**: ${img.description || "No description"}`);
      if (img.extractedText) parts.push(`  - Extracted text: ${img.extractedText}`);
    }
  }

  if (voiceUnderstanding.length > 0) {
    parts.push("\n## Voice Understanding");
    for (const voice of voiceUnderstanding) {
      parts.push(`- **${voice.filename}**: ${voice.transcript || "No transcript"}`);
    }
  }

  return {
    textRequirement,
    imageUnderstanding,
    voiceUnderstanding,
    fileContents,
    unifiedText: parts.join("\n"),
  };
}

export function generateUnifiedRequirementArtifact(unified: UnifiedRequirement): string {
  const lines: string[] = [
    "# Unified Requirement",
    "",
    "## Sources",
    `- Text: ${unified.textRequirement ? "Yes" : "No"}`,
    `- Files: ${unified.fileContents.length}`,
    `- Images: ${unified.imageUnderstanding.length}`,
    `- Voice: ${unified.voiceUnderstanding.length}`,
    "",
    "## Text Requirement",
    unified.textRequirement,
  ];

  if (unified.fileContents.length > 0) {
    lines.push("", "## Attached Files");
    for (const file of unified.fileContents) {
      lines.push(`### ${file.filename}`, "```", file.content.slice(0, 2000), "```");
    }
  }

  if (unified.imageUnderstanding.length > 0) {
    lines.push("", "## Image Understanding");
    for (const img of unified.imageUnderstanding) {
      lines.push(`### ${img.filename}`);
      lines.push(`- Source: ${img.source}`);
      lines.push(`- Format: ${img.metadata.format}`);
      if (img.description) lines.push(`- Description: ${img.description}`);
      if (img.extractedText) lines.push(`- Extracted Text: ${img.extractedText}`);
    }
  }

  if (unified.voiceUnderstanding.length > 0) {
    lines.push("", "## Voice Understanding");
    for (const voice of unified.voiceUnderstanding) {
      lines.push(`### ${voice.filename}`);
      lines.push(`- Source: ${voice.source}`);
      if (voice.transcript) lines.push(`- Transcript: ${voice.transcript}`);
    }
  }

  return lines.join("\n");
}
