# Chú Thích Mã Nguồn Tiếng Việt

**Ngày:** 2026-05-31
**Mục đích:** Giải thích từng phần code với 3 tiêu chí: (1) Nguồn tham khảo, (2) Điểm khác biệt, (3) Mục tiêu/Yêu cầu.

---

## File: src/agents/mock_agents.ts

### Phần 1: Interface RequirementAnalysis (dòng 13–22)

```typescript
interface RequirementAnalysis {
  raw: string;
  type: "endpoint" | "validation" | "response_change" | "error_handling" | "docs" | "cli_option" | "config" | "test" | "report" | "bug_fix" | "general";
  subject: string;
  endpoints: string[];
  fields: string[];
  files: string[];
  actions: string[];
  constraints: string[];
}
```

**1. Nguồn tham khảo:**
- TypeScript Interface pattern (TypeScript Handbook)
- Discriminated Union type (`type` field) — chuẩn TypeScript

**2. Điểm khác biệt:**
- 11 loại requirement (`endpoint`, `validation`, `bug_fix`...) là domain-specific, không có trong bất kỳ framework nào
- `subject`, `endpoints`, `fields`, `constraints` là các trường tùy chỉnh cho việc phân tích requirement phần mềm

**3. Mục tiêu:**
- Định nghĩa cấu trúc dữ liệu để lưu kết quả phân tích requirement
- Mỗi requirement sẽ được phân loại thành 1 trong 11 loại, trích xuất endpoints, fields, files liên quan

---

### Phần 2: Hàm analyzeRequirement (dòng 24–64)

```typescript
function analyzeRequirement(requirement: string): RequirementAnalysis {
  const lower = requirement.toLowerCase();
  const raw = requirement;

  let type: RequirementAnalysis["type"] = "general";
  // Check docs first since it may contain "endpoint" or "api" references
  if (/update.*doc|documentation|readme|api\.md|curl example/i.test(requirement)) type = "docs";
  else if (/(?:GET|POST|PUT|DELETE|PATCH)\s+\/\S+/.test(requirement) || /add (?:a |the )?(?:new )?(?:endpoint|route)/i.test(requirement)) type = "endpoint";
  // ... các regex khác
```

**1. Nguồn tham khảo:**
- **Regex pattern matching** — kỹ thuật NLP cơ bản (không dùng thư viện NLP)
- **Rule-based classification** — phương pháp phân loại dựa trên quy tắc, tương tự expert systems thập niên 1980
- **Thứ tự ưu tiên if-else** — kiểm tra `docs` trước vì requirement về docs có thể chứa từ "endpoint" hoặc "api"

**2. Điểm khác biệt:**
- **Hoàn toàn original**: Không dùng thư viện NLP (spaCy, NLTK) hay LLM. Dùng regex thuần để phân loại.
- 11 loại requirement là domain-specific cho quy trình phát triển phần mềm
- Thứ tự kiểm tra được tối ưu: `docs` trước `endpoint` để tránh false positive
- Trích xuất đồng thời: endpoints (HTTP methods), fields (trong dấu ngoặc), files (đuôi .ts/.py/.md), actions (verbs), constraints (must/should/shall)

**3. Mục tiêu:**
- **Yêu cầu:** Hệ thống phải hiểu loại requirement để sinh artifact phù hợp. Ví dụ: requirement về endpoint cần test plan khác với requirement về bug fix.
- **Input:** Chuỗi requirement văn bản
- **Output:** Object RequirementAnalysis với type, subject, endpoints, fields, files, actions, constraints

---

### Phần 3: Hàm completedResult (dòng 66–88)

```typescript
function completedResult(
  agent: AgentName,
  report: string,
  decisions: AgentDecision[] = [],
  findings: AgentFinding[] = []
): AgentRunResult {
  const startedAt = new Date().toISOString();
  const output: AgentOutput = { report, artifacts: [], decisions, findings };
  return { agent, status: "completed", startedAt, endedAt: new Date().toISOString(), output };
}
```

**1. Nguồn tham khảo:**
- **Factory Helper Pattern** — hàm helper tạo object phức tạp
- **ISO 8601 timestamp** — chuẩn quốc tế cho date/time

**2. Điểm khác biệt:**
- `artifacts: []` — mảng rỗng vì artifacts được ghi bởi orchestrator, không phải bởi agent
- `startedAt` và `endedAt` gần bằng nhau vì mock agents chạy synchronous (mất <1ms)

**3. Mục tiêu:**
- **Yêu cầu:** Mỗi agent phải trả về AgentRunResult với status, timestamps, output
- Tạo object kết quả chuẩn hóa cho mọi mock agent

---

### Phần 4: Hàm findRelevantFiles (dòng ~110–140)

```typescript
function findRelevantFiles(analysis: RequirementAnalysis, allFiles: string[]): string[] {
  const relevant: string[] = [];
  switch (analysis.type) {
    case "endpoint":
      allFiles.filter((f) => /routes?|api|endpoint|handler/i.test(f)).forEach(...);
      break;
    case "bug_fix":
      allFiles.filter((f) => /temporal|retriev/i.test(f)).forEach(...);
      break;
    // ...
  }
  return relevant.slice(0, 15);
}
```

**1. Nguồn tham khảo:**
- **Keyword-based file matching** — kỹ thuật IR cơ bản (Information Retrieval)
- **Pattern matching** — regex matching file paths

**2. Điểm khác biệt:**
- **Original logic:** Ánh xạ loại requirement → pattern file liên quan. Ví dụ: `endpoint` → tìm file có `routes|api|handler`; `bug_fix` → tìm file liên quan đến bug description.
- Kết hợp type-based matching (theo loại requirement) và keyword matching (theo từ khóa trong subject)
- Giới hạn 15 files để tránh quá tải context

**3. Mục tiêu:**
- **Yêu cầu:** Context pack phải liệt kê file liên quan, không phải tất cả file trong repo
- Giúp developer biết file nào cần sửa cho requirement cụ thể

---

### Phần 5: Hàm generateUserStories (dòng ~264–310)

```typescript
function generateUserStories(analysis: RequirementAnalysis): string[] {
  switch (analysis.type) {
    case "endpoint":
      stories.push(
        `- As a client developer, I want ${analysis.subject} so that I can retrieve the required data through the API.`,
        `- As a backend developer, I want to implement the endpoint with proper error handling so that clients get predictable responses.`
      );
      break;
    // ...
  }
}
```

**1. Nguồn tham khảo:**
- **User Story format** (Mike Cohn, "User Stories Applied", 2004): "As a [role], I want [feature] so that [benefit]"
- **BDD (Behavior-Driven Development)** format

**2. Điểm khác biệt:**
- **Original:** Tự động sinh user stories từ requirement analysis, không cần LLM
- Mỗi loại requirement có template user story riêng (endpoint → client/backend developer; validation → user/developer; bug_fix → user/developer)
- `${analysis.subject}` được inject vào template để tạo nội dung requirement-specific

**3. Mục tiêu:**
- **Yêu cầu:** BA artifact phải có user stories theo chuẩn Agile
- Tự động hóa việc viết user stories từ requirement text

---

### Phần 6: Hàm generateTestCases (dòng ~520–600)

```typescript
function generateTestCases(analysis: RequirementAnalysis): string[] {
  const cases: string[] = [];
  // Positive Tests
  cases.push("## Positive Tests");
  switch (analysis.type) {
    case "endpoint":
      cases.push(
        `### TC-P01: ${analysis.endpoints[0] ?? "Endpoint"} returns expected response`,
        `- Send a valid request to ${analysis.endpoints[0] ?? "the endpoint"}.`,
        `- Assert response status is 200.`,
        // ...
      );
      break;
    // ...
  }
  // Negative Tests, Edge Cases, Regression Tests
}
```

**1. Nguồn tham khảo:**
- **Test categorization** (ISTQB Foundation Level): Positive tests, Negative tests, Boundary value analysis
- **Regression testing** (standard software testing practice)

**2. Điểm khác biệt:**
- **Original:** Tự động sinh 4 loại test (Positive, Negative, Edge, Regression) từ requirement analysis
- `${analysis.endpoints[0]}` được inject để tạo test case cụ thể cho endpoint
- Mỗi loại requirement có test template riêng (endpoint → 404/400 tests; validation → boundary tests; bug_fix → reproduction tests)
- Requirement-specific scenarios được trích xuất từ `constraints`

**3. Mục tiêu:**
- **Yêu cầu:** Test plan phải đầy đủ 4 loại test, không chỉ happy path
- Giúp developer viết test nhanh hơn với template có sẵn

---

### Phần 7: Hàm generateImplementationGuidance (dòng ~780–870)

```typescript
function generateImplementationGuidance(analysis: RequirementAnalysis): string[] {
  switch (analysis.type) {
    case "endpoint":
      guidance.push(
        "**Files to create or modify:**",
        "- Route handler file (e.g., `backend/app/api/routes_*.ts`)",
        "- Schema file (e.g., `backend/app/schemas/*.py`)",
        // ...
      );
      break;
    // ...
  }
}
```

**1. Nguồn tham khảo:**
- **Implementation checklist** (standard software engineering practice)
- **File naming conventions** (project-specific patterns)

**2. Điểm khác biệt:**
- **Original:** Tự động liệt kê file cần sửa và bước implementation cho từng loại requirement
- Mỗi loại requirement có implementation template riêng (endpoint → route + schema + error handling; bug_fix → locate → understand → fix → test)
- `${analysis.endpoints[0]}` và `${analysis.fields.join(", ")}` được inject

**3. Mục tiêu:**
- **Yêu cầu:** Implementation guidance phải cụ thể đến file level, không chỉ abstract steps
- Giúp developer biết bắt đầu từ đâu khi implement requirement

---

## File: src/orchestrator/agent_coordinator.ts

### Phần 1: WORKFLOW_STEPS array (dòng ~59–137)

```typescript
const WORKFLOW_STEPS: WorkflowAgentStep[] = [
  { id: "context-pack", phase: "context_reading", artifactType: "context_pack", ... },
  { id: "ba-requirement-package", phase: "planning", artifactType: "ba_requirement_package", ... },
  // ... 11 steps
  { id: "final-report", phase: "reporting", artifactType: "final_report", ... },
];
```

**1. Nguồn tham khảo:**
- **Pipeline Pattern** (GoF Design Patterns)
- **DAG-based workflow** (Apache Airflow, Temporal)

**2. Điểm khác biệt:**
- **Original:** 11-step sequential pipeline mô phỏng SDLC thật (Software Development Life Cycle)
- Mỗi step có `dependencies` array — thể hiện thứ tự tuần tự
- `phase` field nhóm các step theo giai đoạn (context_reading, planning, test_design, implementation, verification, code_review, reporting)

**3. Mục tiêu:**
- **Yêu cầu:** Workflow phải chạy tuần tự, mỗi step tạo artifact cho step tiếp theo
- Định nghĩa cấu trúc pipeline 11 bước

---

### Phần 2: AgentCoordinator.run() (dòng ~150–285)

```typescript
public async run(requirement: string, options: AgentCoordinatorOptions = {}): Promise<AgentCoordinatorResult> {
  // ...
  state = setWorkflowStatus(state, "running");
  state = setScopeLock(state, { goal: "...", sourceOfTruth: "...", ... });

  for (let index = 0; index < WORKFLOW_STEPS.length; index += 1) {
    const step = WORKFLOW_STEPS[index];
    const agent = this.agents[index];
    // Run agent → validate → write artifact → record decisions
  }
}
```

**1. Nguồn tham khảo:**
- **Orchestrator Pattern** (microservices / saga pattern)
- **Immutable State Pattern** (Redux)
- **ScopeLock** — concept gốc

**2. Điểm khác biệt:**
- **Original:**
  - `ScopeLock` mechanism: định nghĩa scope (goal, source of truth, required outputs, "not doing now") — không có trong bất kỳ orchestration framework nào
  - `createAgentInput()`: tích lũy context từ tất cả artifacts trước đó trước khi chạy agent tiếp theo
  - Blocker handling: agent fail → blocker → workflow halt
  - Verification integration: chạy shell commands và ghi kết quả

**3. Mục tiêu:**
- **Yêu cầu:** Chạy toàn bộ 11 agents tuần tự, ghi artifact, xử lý blocker, trả về kết quả
- Đây là hàm chính của toàn bộ hệ thống

---

## File: src/tools/senior_value_gates.ts

### Phần 1: buildSeniorValueAssessment (dòng ~30–80)

```typescript
export function buildSeniorValueAssessment(requirement: string): SeniorValueAssessment {
  return {
    gates: [
      { id: "problem_framing", decision: "Treat the input as a workflow requirement...", ... },
      { id: "scope_decision", decision: "Keep execution deterministic...", ... },
      // ... 7 gates
    ],
    scores: {
      traceability_score: 95,
      test_readiness_score: 90,
      scope_risk_score: 88,
      architecture_fit_score: 92,
    },
  };
}
```

**1. Nguồn tham khảo:**
- **Cooper's Stage-Gate Model** (project management)
- **Balanced Scorecard** (Kaplan & Norton, 1992)

**2. Điểm khác biệt:**
- **Hoàn toàn original:** 7 gates (problem_framing, scope_decision, risk_assessment, architecture_judgment, priority_decision, quality_gate, handoff) là custom domain constructs
- 4 scores là hardcoded deterministic values (trong mock mode)
- Không có tool nào khác có senior value gates

**3. Mục tiêu:**
- **Yêu cầu:** Hệ thống phải đánh giá chất lượng workflow ở cấp senior engineer
- 7 gates kiểm tra các khía cạnh: hiểu vấn đề, phạm vi, rủi ro, kiến trúc, ưu tiên, chất lượng, bàn giao
- 4 scores cho biết mức độ sẵn sàng: traceability, test readiness, scope risk, architecture fit

---

## File: src/tools/patch_applicator.ts

### Phần 1: Hàm applyPatch (dòng ~25–55)

```typescript
export function applyPatch(projectDir: string, operations: PatchOperation[]): PatchResult {
  for (const op of operations) {
    let content = fs.readFileSync(filePath, "utf-8");
    if (op.oldCode && op.newCode) {
      content = content.replace(op.oldCode, op.newCode);
    }
    if (op.insertAfter && op.insertBlock) {
      content = content.replace(op.insertAfter, op.insertAfter + op.insertBlock);
    }
    fs.writeFileSync(filePath, content, "utf-8");
  }
}
```

**1. Nguồn tham khảo:**
- **String replacement** (concept từ `sed` command)
- **Snapshot/Revert Pattern** (undo/rollback)

**2. Điểm khác biệt:**
- **Original:** PatchOperation interface hỗ trợ 3 loại operations: old/new replacement, insert-after, import replacement
- Không dùng unified diff format — simplified string-based patching
- `snapshotFiles()` và `revertPatch()` cho phép rollback sau khi patch

**3. Mục tiêu:**
- **Yêu cầu:** Áp dụng code changes thật vào workspace, chạy test, tạo diff, rồi revert
- Hỗ trợ patch mode trong workflow

---

## File: src/server/model_provider.ts

### Phần 1: createProvider factory (dòng ~30–45)

```typescript
export function createProvider(config: ModelConfig): ModelProvider {
  switch (config.provider) {
    case "mock": return new MockProvider();
    case "openai_compatible": return new OpenAICompatibleProvider(config);
    case "anthropic": return new AnthropicProvider(config);
    // ...
  }
}
```

**1. Nguồn tham khảo:**
- **Factory Pattern** (GoF)
- **Strategy Pattern** (GoF)
- **OpenAI API** (`/v1/chat/completions`), **Anthropic API** (`/v1/messages`), **Ollama API** (`/api/generate`)

**2. Điểm khác biệt:**
- **Original:** Hỗ trợ 6 providers trong 1 factory, mỗi provider implement cùng interface
- `LMStudioProvider` extends `OllamaProvider` (LM Studio expose Ollama-compatible API)
- Tất cả dùng native `fetch()` — không dùng HTTP client library

**3. Mục tiêu:**
- **Yêu cầu:** Hệ thống phải hỗ trợ nhiều LLM provider, dễ dàng thêm provider mới
- Mock provider là default, không cần API key

---

## File: src/server/routes.ts

### Phần 1: handleRequest (dòng ~31–200)

```typescript
export async function handleRequest(method: string, url: string, body: string | undefined, ctx: ApiContext): Promise<ApiResponse> {
  if (method === "GET" && pathname === "/api/health") { ... }
  if (method === "POST" && pathname === "/api/runs") { ... }
  // ... 25+ routes
}
```

**1. Nguồn tham khảo:**
- **REST API Pattern** (Richardson & Ruby, 2007)
- **URL parameter extraction via regex** (manual routing)

**2. Điểm khác biệt:**
- **Original:** Monolithic handler function xử lý 25+ routes qua if/else chain — không dùng Express/framework
- GitHub integration routes: import issue → workflow run, create PR từ run
- Collaboration routes: comments, approval, decision-log
- Patch mode: `runPatchModeAsync()` — apply patch, build/test, generate diff, revert

**3. Mục tiêu:**
- **Yêu cầu:** HTTP server phải xử lý tất cả API requests cho workflow, settings, GitHub, collaboration
- Không dùng framework để tránh dependency

---

## File: src/agents/agent_runner.ts

### Phần 1: runAgentWithMode (dòng ~30–80)

```typescript
export async function runAgentWithMode(agentName, input, mockExecute, config): Promise<AgentRunResult> {
  if (config.mode === "mock") return mockExecute(input);
  if (config.mode === "real") { /* call LLM */ }
  if (config.mode === "hybrid") {
    const mockResult = mockExecute(input);
    const llmResult = await runLlmAgent(...);
    if (llmResult.content.length > mockResult.output.report.length) {
      return { ...mockResult, output: { ...mockResult.output, report: llmResult.content } };
    }
    return mockResult;
  }
}
```

**1. Nguồn tham khảo:**
- **Strategy Pattern** (GoF)
- **Self-Refine** (Madaan et al., 2023)

**2. Điểm khác biệt:**
- **Original:** Hybrid mode — mock-first, LLM-refine. Chỉ dùng output LLM nếu dài hơn mock. Đây là heuristic không có trong framework nào.
- Fallback chain: real fail → error; hybrid fail → mock

**3. Mục tiêu:**
- **Yêu cầu:** Hỗ trợ 3 chế độ chạy: mock (deterministic), real (LLM), hybrid (mock + LLM refine)
- Mock là default, real/hybrid cần cấu hình provider
