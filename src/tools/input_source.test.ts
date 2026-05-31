import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { normalizeRequirementInput } from "./input_source";

let rootDir: string;

function writeFile(relativePath: string, content: string): void {
  const filePath = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf-8");
}

describe("normalizeRequirementInput", () => {
  beforeEach(() => {
    rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "input-source-test-"));
  });

  afterEach(() => {
    fs.rmSync(rootDir, { recursive: true, force: true });
  });

  it("should normalize text input", () => {
    const result = normalizeRequirementInput(
      { type: "text", text: " Add logging " },
      { rootDir }
    );

    assert.equal(result.sourceType, "text");
    assert.equal(result.requirement, "Add logging");
  });

  it("should normalize markdown file input", () => {
    writeFile("req.md", "# Requirement\n\nAdd validation.");

    const result = normalizeRequirementInput(
      { type: "file_markdown", path: "req.md" },
      { rootDir }
    );

    assert.equal(result.sourceType, "file_markdown");
    assert.equal(result.sourceRef, "req.md");
    assert.match(result.requirement, /Add validation/);
  });

  it("should normalize JSON file input using default fields", () => {
    writeFile("req.json", JSON.stringify({ requirement: "Add health endpoint" }));

    const result = normalizeRequirementInput(
      { type: "file_json", path: "req.json" },
      { rootDir }
    );

    assert.equal(result.sourceType, "file_json");
    assert.equal(result.requirement, "Add health endpoint");
  });

  it("should normalize JSON file input using a configured field", () => {
    writeFile("req.json", JSON.stringify({ prompt: "Add retry handling" }));

    const result = normalizeRequirementInput(
      { type: "file_json", path: "req.json", field: "prompt" },
      { rootDir }
    );

    assert.equal(result.requirement, "Add retry handling");
    assert.equal(result.metadata.field, "prompt");
  });

  it("should normalize image reference placeholder without OCR", () => {
    const result = normalizeRequirementInput(
      { type: "image_reference", path: "mockup.png", metadata: { alt: "button screenshot" } },
      { rootDir }
    );

    assert.equal(result.sourceType, "image_reference");
    assert.match(result.requirement, /Real OCR\/image understanding is not implemented yet/);
    assert.equal(result.metadata.placeholder, true);
  });

  it("should normalize voice transcript placeholder without ASR", () => {
    const result = normalizeRequirementInput(
      { type: "voice_transcript", transcript: "Add a save button", mediaPath: "note.wav" },
      { rootDir }
    );

    assert.equal(result.sourceType, "voice_transcript");
    assert.equal(result.requirement, "Add a save button");
    assert.equal(result.metadata.placeholder, true);
  });
});
