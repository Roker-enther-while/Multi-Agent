# Source Origin Analysis — Phân tích nguồn gốc mã nguồn

**Ngày:** 2026-05-31
**Mục đích:** Ghi rõ nguồn tham khảo, điểm khác biệt, và mục tiêu của từng file/hàm trong dự án.

---

## 1. src/agents/base_agent.ts

### Nguồn tham khảo:
- **Template Method Pattern** (GoF Design Patterns, 1994): Abstract class định nghĩa skeleton, subclass implement chi tiết.
- **TypeScript Abstract Class** (TypeScript Handbook): Cách khai báo abstract class và abstract method.

### Điểm khác biệt:
- `validate()` kiểm tra artifact completeness (id, type, path phải có) — đây là validation domain-specific cho workflow traceability, không có trong pattern gốc.
- `report()` fallback về status-only khi output chưa hoàn chỉnh — xử lý lỗi graceful cho workflow.

### Mục tiêu hàm:
| Hàm | Mục tiêu |
|---|---|
| `execute(input)` | Abstract. Mỗi agent subclass tự implement logic xử lý. |
| `report(result)` | Trả về markdown report, hoặc fallback nếu chưa hoàn chỉnh. |
| `validate(output)` | Kiểm tra report không rỗng, artifact có đủ trường bắt buộc. |

---

## 2. src/agents/mock_agents.ts

### Nguồn tham khảo:
- **Strategy Pattern** (GoF): Mỗi `Mock*Agent` là một strategy implement `BaseAgent.execute()`.
- **Factory Function**: `createDefaultMockAgents()` tạo danh sách agent theo thứ tự workflow.
- **BDD/Agile User Story Format**: "As a..., I want..., so that..." và "Given..., When..., Then..." là chuẩn Agile.
- **Mermaid Diagram Syntax** (mermaid.js): Cú pháp diagram nhưng nội dung tự sinh.

### Điểm khác biệt (hoàn toàn original):
- `analyzeRequirement()` — Bộ phân loại requirement dựa trên regex, phân loại thành 10 loại (endpoint, validation, bug_fix...), trích xuất endpoints, fields, constraints. Không dùng NLP library.
- `findRelevantFiles()` — Ánh xạ loại requirement → pattern file liên quan (endpoint → routes/api, bug_fix → retriever...).
- `generateTestCases()` — Sinh 4 loại test (positive, negative, edge, regression) từ requirement analysis.
- `generateUserStories()` / `generateAcceptanceCriteria()` — Template filling domain-specific.
- `generateDiagrams()` — Sinh Mermaid diagrams theo loại requirement.
- `generateReviewFindings()` — Sinh checklist review theo loại requirement + risk assessment.

### Mục tiêu hàm:
| Hàm | Mục tiêu |
|---|---|
| `analyzeRequirement()` | Phân loại requirement, trích xuất cấu trúc (endpoints, fields, files, constraints). |
| `findRelevantFiles()` | Tìm file liên quan trong repo dựa trên loại requirement. |
| `generateUserStories()` | Sinh user stories theo chuẩn Agile từ requirement. |
| `generateAcceptanceCriteria()` | Sinh acceptance criteria testable. |
| `generateTestCases()` | Sinh test plan 4 loại: positive, negative, edge, regression. |
| `generateImplementationGuidance()` | Sinh hướng dẫn implementation cụ thể theo loại requirement. |
| `generateReviewFindings()` | Sinh code review findings với risk assessment. |
| `createDefaultMockAgents()` | Factory tạo 11 agents theo thứ tự workflow. |

---

## 3. src/agents/llm_agent.ts

### Nguồn tham khảo:
- **Self-Refine Pattern** (Madaan et al., 2023 — "Self-Refine: Iterative Refinement with Self-Feedback"): LLM tự sửa output dựa trên validation feedback.
- **Retry Pattern** (Release It! Nygard, 2007): Retry với correction khi fail.

### Điểm khác biệt:
- Validation-then-correction loop: kiểm tra output → nếu thiếu section → tạo correction prompt → retry 1 lần.
- Trạng thái "blocked" khi validation fail sau retry — domain-specific workflow concept.
- Tích hợp với `validateAgentOutput()` và `buildCorrectionPrompt()` từ output_validator.

### Mục tiêu hàm:
| Hàm | Mục tiêu |
|---|---|
| `runLlmAgent(request, provider, modelName)` | Gọi LLM provider, validate output, retry nếu fail, trả về structured response. |

---

## 4. src/agents/agent_runner.ts

### Nguồn tham khảo:
- **Strategy Pattern** với runtime mode selection.
- **12-Factor App** (12factor.net): Configuration qua environment variables.
- **Decorator Pattern**: `runAgentWithMode` wrap mock hoặc LLM execution.

### Điểm khác biệt (hoàn toàn original):
- **Hybrid mode**: Chạy mock trước, gọi LLM sau, chỉ dùng output LLM nếu dài hơn mock. Đây là heuristic "mock-first, LLM-refine" — không có trong framework nào.
- Fallback chain: real fail → error; hybrid fail → mock.

### Mục tiêu hàm:
| Hàm | Mục tiêu |
|---|---|
| `getExecutionMode()` | Đọc AGENT_EXECUTION_MODE từ env var. |
| `runAgentWithMode()` | Dispatch tới mock, real LLM, hoặc hybrid dựa trên config. |

---

## 5. src/agents/output_validator.ts

### Nguồn tham khảo:
- **Structured Output Validation** (LLM prompt engineering best practices): Kiểm tra section headings trong output.
- **Correction Prompt Pattern**: Feed back validation errors cho LLM tự sửa.

### Điểm khác biệt:
- `REQUIRED_SECTIONS` là mapping thủ công 11 agent → required headings. Domain-specific.
- Kiểm tra placeholder failures ("UNKNOWN", "NEED_CONFIRMATION"), minimum length, refusal language ("I cannot").

### Mục tiêu hàm:
| Hàm | Mục tiêu |
|---|---|
| `validateAgentOutput()` | Kiểm tra output có đủ section bắt buộc, không có placeholder/refusal. |
| `buildCorrectionPrompt()` | Tạo prompt correction khi output thiếu section. |

---

## 6. src/orchestrator/agent_coordinator.ts

### Nguồn tham khảo:
- **Pipeline/Chain Pattern** (GoF): Agents chạy tuần tự, mỗi agent tạo artifact cho agent tiếp theo.
- **Saga Pattern** (microservices): Coordinator quản lý lifecycle, xử lý failure, ghi state.
- **Redux Immutable State**: Mỗi mutation trả về object mới.

### Điểm khác biệt:
- **11-step sequential pipeline**: context_pack → ba → visual → senior → plan → test → impl → verify → review → traceability → final. Đây là custom SDLC modeled as agent workflow.
- **ScopeLock mechanism**: Định nghĩa scope (goal, source of truth, required outputs, not doing now) — concept original, không có trong orchestration pattern nào.
- **Blocker handling**: Agent fail → blocker → workflow halt. Verification fail → halt.

### Mục tiêu hàm:
| Hàm | Mục tiêu |
|---|---|
| `AgentCoordinator.run()` | Chạy toàn bộ 11 agents tuần tự, ghi artifact, xử lý blocker. |
| `runVerificationCommands()` | Chạy shell commands verification, ghi kết quả. |
| `createAgentInput()` | Build input cho mỗi agent với toàn bộ context tích lũy. |

---

## 7. src/tools/artifact_store.ts

### Nguồn tham khảo:
- **Filesystem Artifact Store** (CI/CD systems như .gradle, .next/cache).
- **Sidecar Metadata Pattern** (data engineering, Parquet files): Mỗi artifact có .meta.json companion.
- **Path Traversal Prevention** (OWASP): `assertInsideBaseDir()` kiểm tra path không thoát khỏi base dir.

### Điểm khác biệt:
- Timestamp prefix convention: `ISO date_sanitized-type.extension` — sắp xếp chronological.
- `sanitizeFilename()` tự implement (không dùng library).

### Mục tiêu hàm:
| Hàm | Mục tiêu |
|---|---|
| `createRunDirectory()` | Tạo thư mục run dưới base dir. |
| `writeArtifact()` | Ghi artifact content + metadata sidecar ra disk. |
| `readArtifact()` | Đọc artifact content từ disk. |
| `assertInsideBaseDir()` | Kiểm tra path traversal security. |

---

## 8. src/tools/patch_applicator.ts

### Nguồn tham khảo:
- **String-based Patching** (concept từ sed/diff/patch).
- **Snapshot/Revert Pattern** (undo/rollback): `snapshotFiles()` capture state, `revertPatch()` restore.

### Điểm khác biệt:
- `PatchOperation` interface hỗ trợ 3 loại: old/new replacement, insert-after, import replacement. Custom simplified patch format.
- `getDiff()` simplified line-by-line diff (không dùng Myers/patience algorithm).

### Mục tiêu hàm:
| Hàm | Mục tiêu |
|---|---|
| `applyPatch()` | Áp dụng string-replacement operations lên file. |
| `snapshotFiles()` | Capture file contents trước khi patch. |
| `revertPatch()` | Restore files về trạng thái gốc. |
| `getDiff()` | Tạo simplified diff giữa original và current. |

---

## 9. src/tools/html_report_generator.ts

### Nguồn tham khảo:
- **Template-based HTML Generation** (server-side rendering cơ bản).
- **XSS Prevention** (OWASP): `escapeHtml()` escape &, <, >, ".
- **Traceability Matrix** (requirements engineering): Bảng link artifact → agent → path.

### Điểm khác biệt:
- `SECTION_ORDER` định nghĩa thứ tự hiển thị 10 artifact sections. Domain-specific.
- `renderVisualModel()` extract Mermaid blocks từ markdown, render trong `<pre><code>`. Custom markdown-to-HTML.

### Mục tiêu hàm:
| Hàm | Mục tiêu |
|---|---|
| `writeHtmlWorkflowReport()` | Sinh và ghi HTML report vào run directory. |
| `generateHtmlWorkflowReport()` | Build full HTML string với tất cả artifact sections + traceability matrix. |
| `renderVisualModel()` | Extract và render Mermaid diagram blocks. |

---

## 10. src/tools/final_done_validator.ts

### Nguồn tham khảo:
- **Definition of Done (DoD)** (Agile/Scrum): Checklist-based validation.
- **CI/CD Quality Gates**: Pass/fail checks với evidence.

### Điểm khác biệt:
- `validateFinalDone()` kiểm tra 5 điều kiện domain-specific.
- `validateProductizationDone()` mở rộng với 5 điều kiện thesis-specific (CLI help, HTML report, BA/visual artifacts, senior gates, evaluation tasks).
- Senior marker validation: kiểm tra 11 markers cụ thể trong artifact content.

### Mục tiêu hàm:
| Hàm | Mục tiêu |
|---|---|
| `validateFinalDone()` | Kiểm tra "done" criteria cơ bản cho workflow run. |
| `validateProductizationDone()` | Kiểm tra "done" criteria mở rộng cho thesis productization. |

---

## 11. src/tools/requirement_fusion.ts

### Nguồn tham khảo:
- **Multi-modal Input Fusion** (multi-modal AI systems): Kết hợp text/file/image/voice.
- **Strategy Pattern per input type**: Mỗi loại input có processor riêng.

### Điểm khác biệt:
- Hiện tại là mock/placeholder. Image understanding trả mock message. Voice hiểu transcript file (.txt).
- `fuseRequirements()` build unified markdown document kết hợp tất cả nguồn input.

### Mục tiêu hàm:
| Hàm | Mục tiêu |
|---|---|
| `processImageInput()` | Xử lý image input (hiện tại mock). |
| `processVoiceInput()` | Xử lý voice input (mock, nhưng xử lý .txt transcript thật). |
| `fuseRequirements()` | Kết hợp tất cả input sources thành UnifiedRequirement. |

---

## 12. src/tools/browser_runner.ts

### Nguồn tham khảo:
- **E2E Testing Pattern** (Playwright test format).
- **Page Object Step Definitions**: Actions (goto, click, fill, waitForText) map tới Playwright methods.

### Điểm khác biệt:
- `E2EScenario` format là custom simplified DSL cho E2E tests.
- Dynamic `require("playwright")` — graceful degradation khi Playwright chưa cài.
- Screenshot capture ở mỗi step + cuối cùng.

### Mục tiêu hàm:
| Hàm | Mục tiêu |
|---|---|
| `runE2EScenario()` | Chạy E2E scenario bằng Playwright, capture screenshot/results. |
| `parseE2EScenario()` | Parse và validate raw data thành E2E scenario object. |

---

## 13. src/tools/senior_value_gates.ts

### Nguồn tham khảo:
- **Quality Gate Pattern** (Cooper's Stage-Gate Model).
- **Balanced Scorecard** (Kaplan & Norton, 1992): 4 numeric scores.

### Điểm khác biệt:
- 7 gates (problem_framing, scope_decision, risk_assessment, architecture_judgment, priority_decision, quality_gate, handoff) — custom domain constructs.
- 4 scores (traceability: 95, test_readiness: 90, scope_risk: 88, architecture_fit: 92) — hardcoded deterministic.

### Mục tiêu hàm:
| Hàm | Mục tiêu |
|---|---|
| `buildSeniorValueAssessment()` | Build structured assessment với 7 gates + 4 scores. |
| `renderSeniorValueAssessment()` | Render assessment thành markdown. |

---

## 14. src/prompts/prompt_assembler.ts

### Nguồn tham khảo:
- **System/User Prompt Pattern** (OpenAI, Anthropic chat API).
- **Context Window Management** (LLM applications): MAX_CONTEXT_LENGTH = 8000.

### Điểm khác biệt:
- `AGENT_SYSTEM_PROMPTS` là mapping thủ công 11 agent → system prompt. Domain-specific prompt engineering.
- User prompt assembly: requirement + previous artifacts + repo context + verification results + output format.

### Mục tiêu hàm:
| Hàm | Mục tiêu |
|---|---|
| `assemblePrompt()` | Build system + user prompt cho agent dựa trên context. |
| `getAgentNames()` | Trả về danh sách tất cả agent names. |

---

## 15. src/server/server.ts

### Nguồn tham khảo:
- **Node.js HTTP Server** (Node.js docs): `http.createServer()`.
- **CORS Headers** (MDN Web Docs): `Access-Control-Allow-Origin`.
- **Static File Serving** (standard web server pattern).

### Điểm khác biệt:
- Không dùng Express/framework — routing hoàn toàn manual trong routes.ts.
- `readBody()` tự implement streaming chunks.
- Kết hợp static file serving + API routing trong 1 callback.

### Mục tiêu hàm:
| Hàm | Mục tiêu |
|---|---|
| `readBody()` | Đọc HTTP request body thành string. |
| `serveStatic()` | Serve static files từ public directory. |

---

## 16. src/server/routes.ts

### Nguồn tham khảo:
- **REST API Pattern** (RESTful Web Services, Richardson & Ruby, 2007).
- **Async Fire-and-Forget** (common pattern cho long-running operations).
- **URL Parameter Extraction via Regex** (minimal approach, không dùng routing framework).

### Điểm khác biệt:
- `handleRequest()` là monolithic function xử lý tất cả routes qua if/else chain.
- GitHub integration routes: import issue → workflow run, create PR từ run.
- Collaboration routes: comments, approval, request-changes, decision-log.
- Patch mode: `runPatchModeAsync()` — apply patch, build/test, generate diff, revert.
- Workspace scanning: recursive directory scan + recent workspace persistence.

### Mục tiêu hàm:
| Hàm | Mục tiêu |
|---|---|
| `handleRequest()` | Main request handler, dispatch tất cả API requests. |
| `runWorkflowAsync()` | Chạy workflow async, cập nhật run store. |
| `runPatchModeAsync()` | Chạy workflow + patch application async. |

---

## 17. src/server/model_provider.ts

### Nguồn tham khảo:
- **OpenAI API** (`/v1/chat/completions`): De facto standard cho LLM APIs.
- **Anthropic API** (`/v1/messages`, `x-api-key`, `anthropic-version`).
- **Gemini API** (`generativelanguage.googleapis.com`).
- **Ollama API** (`/api/generate`, `stream: false`).
- **Strategy/Factory Pattern** (GoF).

### Điểm khác biệt:
- Hỗ trợ 6 providers: mock, openai_compatible, anthropic, gemini, ollama, lmstudio.
- `LMStudioProvider` extends `OllamaProvider` (LM Studio expose Ollama-compatible API).
- Tất cả dùng native `fetch()` — không dùng HTTP client library.

### Mục tiêu hàm:
| Hàm | Mục tiêu |
|---|---|
| `loadModelConfig()` | Load model config từ env vars. |
| `createProvider()` | Factory trả về provider implementation phù hợp. |
| `generate(prompt)` | Gọi LLM API, trả về response content. |
| `testConnection()` | Kiểm tra kết nối tới provider. |

---

## 18. src/server/collaboration.ts

### Nguồn tham khảo:
- **Role-Based Access Control (RBAC)**: UserRole type (ba, developer, reviewer, tester, tech_lead).
- **Approval Workflow** (GitHub PR reviews): draft → ready_for_review → changes_requested → approved.
- **Decision Log / Audit Trail** (governance, compliance).

### Điểm khác biệt:
- Collaboration data model kết hợp comments (targeted: run/artifact/diff/finding), approvals, decision logs.
- `generateDecisionLogMarkdown()` render decision log thành markdown.

### Mục tiêu hàm:
| Hàm | Mục tiêu |
|---|---|
| `addComment()` | Thêm comment gắn với run/artifact/diff/finding. |
| `setApprovalState()` | Cập nhật trạng thái approval. |
| `addDecisionLogEntry()` | Ghi quyết định với rationale. |
| `generateDecisionLogMarkdown()` | Render decision log thành markdown. |

---

## 19. src/integrations/github/github_client.ts

### Nguồn tham khảo:
- **GitHub REST API v3** (docs.github.com/en/rest).
- **Git Data API** (get ref → get commit → create blobs → create tree → create commit → update ref).
- **Factory Pattern**: Mock vs Real client dựa trên token.

### Điểm khác biệt:
- `RealGitHubClient` dùng `fetch()` trực tiếp — không dùng Octokit/SDK.
- `commitFiles()` implement full Git Data API flow từ scratch.
- `MockGitHubClient` trả hardcoded responses cho offline development.

### Mục tiêu hàm:
| Hàm | Mục tiêu |
|---|---|
| `testConnection()` | Kiểm tra kết nối GitHub repo. |
| `listIssues()` | Lấy danh sách issues. |
| `getIssue()` | Lấy chi tiết issue. |
| `createBranch()` | Tạo branch mới từ base. |
| `commitFiles()` | Commit nhiều files qua Git Data API. |
| `createPullRequest()` | Tạo pull request. |

---

## 20. src/cli.ts

### Nguồn tham khảo:
- **CLI Argument Parsing** (standard pattern): commands, --key value, --flag, positionals.
- **Subcommand Pattern**: 5 commands (run, demo, validate, inspect, report).
- **Exit Code Convention**: 0 = ok, 1 = fail.

### Điểm khác biệt:
- Argument parser tự implement (không dùng yargs/commander).
- `getRequirement()` hỗ trợ nhiều nguồn: --requirement, --requirement-file, --image-reference, --voice-transcript.
- `require.main === module` guard cho dual module/CLI usage.

### Mục tiêu hàm:
| Hàm | Mục tiêu |
|---|---|
| `parseCliArgs()` | Parse CLI args thành command, options, positionals. |
| `executeCli()` | Main dispatcher, route tới command handler. |
| `runCommand()` | Chạy full workflow, in kết quả. |
| `demoCommand()` | Chạy demo end-to-end. |
| `validateCommand()` | Chạy workflow + validate "done" criteria. |
| `reportCommand()` | Chạy workflow + sinh HTML + markdown report. |

---

## 21. src/state/project_state.ts

### Nguồn tham khảo:
- **Immutable State Management** (Redux, Elm): Mỗi mutation trả object mới.
- **Event Sourcing Concept**: State tích lũy steps, artifacts, blockers, decisions.

### Điểm khác biệt:
- `ProjectState` aliased thành `WorkflowRun` — single source of truth.
- `ScopeLock` concept: định nghĩa scope (goal, source of truth, not doing now) — original concept.
- `resolveBlocker()` tự động chuyển status từ "blocked" → "running" khi tất cả blockers resolved.

### Mục tiêu hàm:
| Hàm | Mục tiêu |
|---|---|
| `createInitialProjectState()` | Tạo state mới từ requirement. |
| `addArtifact()` | Thêm artifact reference vào state. |
| `addBlocker()` | Ghi blocker, set status = blocked. |
| `completeStep()` | Đánh dấu step hoàn thành. |
| `resolveBlocker()` | Resolve blocker, có thể unblock workflow. |
| `setScopeLock()` | Đặt scope lock cho run. |

---

## 22. src/types/agents.ts

### Nguồn tham khảo:
- **TypeScript Type Definitions** (TypeScript Handbook).
- **Discriminated Union Pattern**: AgentStatus, AgentFinding.severity.

### Điểm khác biệt:
- 11 agent names là domain-specific.
- AgentInput chứa artifact paths là optional fields — encode workflow structure vào type system.

---

## 23. src/types/artifacts.ts

### Nguồn tham khảo:
- **Reference/Value Separation** (data engineering): ArtifactRef vs WorkflowArtifact.

### Điểm khác biệt:
- 13 ArtifactType values là domain-specific.
- `artifactTypeToFilename()` convert type → filename với special handling.

---

## 24. src/types/workflow.ts

### Nguồn tham khảo:
- **State Machine Concepts** (WorkflowRunStatus, WorkflowPhase).
- **DAG-based Workflow** (Airflow, Temporal): WorkflowStep có dependencies.

### Điểm khác biệt:
- `ScopeLock` — original concept: goal, source of truth, required outputs, not doing now.
- `Blocker` có `tried` và `requiredAction` — custom blocker model cho debugging.

---

## Patterns sử dụng xuyên suốt dự án

| Pattern | Nguồn | Ứng dụng |
|---|---|---|
| Immutable State | Redux/Elm | project_state.ts, agent_coordinator.ts |
| Factory | GoF | model_provider.ts, github_client.ts, mock_agents.ts |
| Strategy | GoF | agent_runner.ts, model_provider.ts |
| Template Method | GoF | base_agent.ts |
| Env-var Config | 12-Factor App | server.ts, model_provider.ts, cli.ts |
| Mock-first | TDD best practice | mock_agents.ts, model_provider.ts, github_client.ts |
| Pipeline/Chain | GoF | agent_coordinator.ts |
| Sidecar Metadata | Data engineering | artifact_store.ts |

## Components hoàn toàn original

1. `analyzeRequirement()` — Regex-based requirement classifier
2. Hybrid execution mode — mock-first, LLM-refine gated by output length
3. 11-step sequential agent pipeline — custom SDLC as workflow
4. `ScopeLock` concept — explicit scope definition with "not doing now"
5. `validateProductizationDone()` — thesis-specific acceptance criteria
6. Patch mode — apply patch, build/test, generate diff, revert
