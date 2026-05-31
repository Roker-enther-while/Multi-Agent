# Feature Inventory

**Date:** 2026-05-31
**Status:** RELEASE FREEZE

## Workflow Engine

| Feature | Status | Description |
|---|---|---|
| Sequential agent orchestration | ✅ | 11 agents run in deterministic order |
| Requirement analysis | ✅ | Parses type, endpoints, fields, constraints |
| Context pack generation | ✅ | Identifies relevant files from repository |
| BA artifact generation | ✅ | User stories, acceptance criteria, flow |
| Visual model generation | ✅ | Mermaid workflow/state/ER diagrams |
| Senior value gates | ✅ | 7 gates + 4 numeric scores |
| Task planning | ✅ | Type-specific implementation steps |
| Test plan generation | ✅ | Positive, negative, edge, regression tests |
| Implementation guidance | ✅ | Concrete file-level steps |
| Code review | ✅ | Type-specific findings with risk assessment |
| Traceability report | ✅ | Links requirement to all artifacts |
| Final report | ✅ | Senior gates, scores, traceability |
| HTML report generation | ✅ | report.html with all sections |
| Verification execution | ✅ | Runs commands and records results |
| Blocker detection | ✅ | Stops workflow on failure |

## Web UI

| Feature | Status | Description |
|---|---|---|
| Chat interface | ✅ | Submit requirements via text |
| Run list sidebar | ✅ | Shows all runs with status badges |
| Artifact viewer | ✅ | Click to view any artifact |
| Report link | ✅ | Opens report.html in new tab |
| Mode selector | ✅ | Plan Only / Patch Mode |
| Workspace input | ✅ | Enter workspace path for patch mode |
| File attachment | ✅ | Multi-file upload with type validation |
| Settings modal | ✅ | Model provider configuration |
| Execution mode | ✅ | Mock / Real LLM / Hybrid |
| Export button | ✅ | Download run as JSON |

## Model Providers

| Provider | Status | Description |
|---|---|---|
| Mock | ✅ | Default, always available, deterministic |
| OpenAI Compatible | ✅ | Works with OpenAI, Groq, Together, etc. |
| Anthropic | ✅ | Claude models |
| Gemini | ✅ | Google Gemini models |
| Ollama | ✅ | Local models via Ollama |
| LM Studio | ✅ | Local models via LM Studio |

## LLM Execution

| Feature | Status | Description |
|---|---|---|
| Mock mode | ✅ | Deterministic agents (default) |
| Real mode | ✅ | Calls LLM provider for each agent |
| Hybrid mode | ✅ | Mock first, LLM refines |
| Prompt assembly | ✅ | System prompt + context + artifacts |
| Output validation | ✅ | Checks required sections |
| Retry on failure | ✅ | Correction prompt if validation fails |

## GitHub Integration

| Feature | Status | Description |
|---|---|---|
| GitHub client | ✅ | Mock + real implementations |
| Test connection | ✅ | Verify GitHub access |
| List issues | ✅ | Fetch repository issues |
| Import issue | ✅ | Run workflow from issue body |
| Create branch | ✅ | Create branch for PR |
| Commit files | ✅ | Commit artifacts to branch |
| Create PR | ✅ | Open pull request with report |
| PR body template | ✅ | Summary, requirement, tests, review, traceability |
| Token protection | ✅ | Never logged or exposed |

## Browser/E2E Automation

| Feature | Status | Description |
|---|---|---|
| Browser runner | ✅ | Abstraction with Playwright optional |
| E2E scenarios | ✅ | JSON step format |
| Step actions | ✅ | goto, click, fill, waitForText, screenshot, assert |
| E2E reporter | ✅ | MD + JSON output |
| Demo scenario | ✅ | demo_chat_workflow.json |
| Graceful degradation | ✅ | Missing Playwright handled |

## Team Collaboration

| Feature | Status | Description |
|---|---|---|
| Comments | ✅ | Per-run comments with author/role |
| Approval flow | ✅ | Approve / request changes |
| Decision log | ✅ | Records all decisions with rationale |
| Roles | ✅ | BA, developer, reviewer, tester, tech_lead |
| Decision log markdown | ✅ | Generates decision_log.md |

## Voice/Image Input

| Feature | Status | Description |
|---|---|---|
| Image processor | ✅ | Mock metadata extraction |
| Voice processor | ✅ | Transcript file support |
| Requirement fusion | ✅ | Combines text + files + images + voice |
| Unified requirement | ✅ | Generates unified_requirement.md |
| Mock OCR/ASR | ✅ | Graceful degradation without real providers |

## Benchmark/Evaluation

| Feature | Status | Description |
|---|---|---|
| Evaluation tasks | ✅ | 5 sample tasks with expected artifacts |
| Evaluation runner | ✅ | Runs all tasks and checks artifacts |
| Benchmark repos | ✅ | 3 repos (ts_api, fastapi, node_cli) |
| Benchmark tasks | ✅ | 12 tasks across all repos |
| Benchmark runner | ✅ | Runs all tasks with scoring |
| Scoring metrics | ✅ | Success rate, completeness, traceability, latency |
| Reports | ✅ | JSON + MD output |

## Safety

| Feature | Status | Description |
|---|---|---|
| Upload size limit | ✅ | 1MB max per file |
| File type whitelist | ✅ | Only safe text types allowed |
| Path traversal guard | ✅ | Workspace must be within project root |
| API key masking | ✅ | Never logged or exposed |
| Error messages | ✅ | Clear, descriptive errors |

## Reports/Artifacts

| Artifact | Status | Description |
|---|---|---|
| context_pack.md | ✅ | Repository context with relevant files |
| ba_requirement_package.md | ✅ | User stories, acceptance criteria |
| visual_model_package.md | ✅ | Mermaid diagrams |
| senior_review.md | ✅ | 7 gates + 4 scores |
| task_plan.md | ✅ | Implementation steps |
| test_plan.md | ✅ | 4 categories of test cases |
| implementation_summary.md | ✅ | File-level guidance |
| verification_report.md | ✅ | Command results |
| code_review_report.md | ✅ | Type-specific findings |
| traceability_report.md | ✅ | Artifact chain |
| final_report.md | ✅ | Complete summary |
| report.html | ✅ | Human-readable HTML report |
| decision_log.md | ✅ | Collaboration decisions |
| unified_requirement.md | ✅ | Multi-source fusion |
