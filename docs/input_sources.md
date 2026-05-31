# Requirement Input Sources

The workflow normalizes every user input into `RequirementInput` before running agents.

## Supported Sources

- `text`: direct requirement text.
- `file_markdown`: reads a Markdown or text file inside the repository.
- `file_json`: reads a JSON file inside the repository.
- `image_reference`: placeholder metadata for an image or mockup. Real OCR/image understanding is not implemented yet.
- `voice_transcript`: user-provided transcript text. Real ASR is not implemented yet.

## CLI Examples

```bash
node src/dist/cli.js run --requirement "Add health endpoint details"
node src/dist/cli.js run --requirement-file docs/request.md
node src/dist/cli.js run --requirement-file examples/request.json --source-type file_json
node src/dist/cli.js run --image-reference mockups/settings.png
node src/dist/cli.js run --voice-transcript "Add a save button to the editor"
```

For JSON files, the default fields are `requirement`, `text`, and `description`. Use `--json-field` for a custom string field.

All file paths are constrained to the repository root. Image and voice inputs are intentionally placeholders until OCR and ASR are implemented in a later roadmap.
