# NEXT STEP

## Current Actionable Next Step

**Phase:** Phase 6 - Input Source Handler

**Priority:** HIGH

**Action:** Support requirement input from text, Markdown file, JSON file, image metadata placeholder, and voice transcript placeholder.

---

### Required:

- Create input source types:
  - `text`
  - `file_markdown`
  - `file_json`
  - `image_reference`
  - `voice_transcript`
- Do not implement real OCR/ASR yet.
- Normalize all inputs into `RequirementInput`.
- Add tests.
- Update docs.

---

### Verification:

- `npm run lint`
- `npx tsc -p tsconfig.test.json`
- `npm test`
- `npm run build`

---

### Commit:

`feat: add multi-source requirement input handler`
