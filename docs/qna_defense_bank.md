# Q&A Defense Bank — Ngân Hàng Câu Hỏi Bảo Vệ

**Tổng số câu:** 30

---

## Nhóm 1: Tổng quan hệ thống

### Q1: Tại sao dùng multi-agent mà không dùng một LLM lớn?
**A:** Mỗi agent có vai trò riêng (BA, Senior, Test Designer...) giống như team thật. Một LLM lớn không thể đồng thời phân tích requirement, viết test plan, và review code với chất lượng cao. Multi-agent cho phép specialization và traceability từng bước.

### Q2: Hệ thống này khác gì với ChatGPT/Claude Code?
**A:** ChatGPT/Claude Code sinh code ad-hoc, không có workflow structure. DevMIRA là workflow engine với 11 bước tuần tự, mỗi bước tạo artifact có thể truy vết. Có senior value gates, test plan 4 loại, và verification — những thứ chatbot không có.

### Q3: Tại sao gọi là "senior-like"?
**A:** Vì hệ thống mô phỏng quy trình làm việc của senior developer: phân tích context trước khi code, tạo BA artifacts, đặt value gates, design test trước khi implement, review code, và tạo traceability report.

### Q4: Mock mode có thực sự hữu ích không?
**A:** Có. Mock mode giúp: (1) Chạy offline không cần API key, (2) Kết quả deterministic cho testing, (3) Nhanh — mất 1 giây thay vì 10-30 giây với LLM thật, (4) Framework sẵn sàng để tích hợp LLM thật.

---

## Nhóm 2: Kiến trúc và kỹ thuật

### Q5: 11 agents chạy như thế nào?
**A:** Chạy tuần tự (sequential), mỗi agent nhận input từ artifacts của agent trước. Orchestrator quản lý lifecycle: chạy agent → validate output → ghi artifact → chuyển agent tiếp theo. Nếu fail → blocker → dừng workflow.

### Q6: Tại sao không chạy song song?
**A:** Vì dependency: BA artifact cần context pack, test plan cần task plan, code review cần verification results. Chạy song song sẽ mất traceability.

### Q7: State management hoạt động thế nào?
**A:** Immutable state pattern (giống Redux). Mọi mutation trả object mới. ProjectState là single source of truth, chứa steps, artifacts, blockers, decisions, verification results.

### Q8: Artifact store hoạt động thế nào?
**A:** Filesystem-based với sidecar metadata. Mỗi artifact là file markdown + file .meta.json. Timestamp prefix cho chronological ordering. Path traversal protection.

### Q9: Output validation hoạt động thế nào?
**A:** Kiểm tra required sections theo agent name, placeholder failures (UNKNOWN, NEED_CONFIRMATION), minimum length, refusal language. Nếu fail → retry 1 lần với correction prompt.

### Q10: Hybrid mode hoạt động thế nào?
**A:** Chạy mock trước → gọi LLM → chỉ dùng output LLM nếu dài hơn mock. Nếu LLM fail → fallback về mock. Đây là heuristic "mock-first, LLM-refine".

---

## Nhóm 3: Đánh giá và kiểm thử

### Q11: Đánh giá hệ thống bằng cách nào?
**A:** 4 phương pháp: (1) Unit tests 77/77, (2) Evaluation tasks 5/5, (3) Real-world validation 10 scenarios, (4) Patch validation 5 scenarios. Mỗi phương pháp kiểm tra một khía cạnh khác nhau.

### Q12: Real-world validation scoring như thế nào?
**A:** 5 tiêu chí: context relevance, artifact completeness, test plan usefulness, implementation readiness, review usefulness. Mỗi tiêu chí 0-100. Kết quả: 80.1/100.

### Q13: Patch validation có thật không?
**A:** Có. Áp dụng code changes thật vào TypeScript sample app, chạy build và test thật. 5/5 scenarios pass với score 91/100.

### Q14: Benchmark multi-repo là gì?
**A:** 3 repos (TypeScript API, FastAPI, Node.js CLI), 12 tasks. Chạy workflow trên mỗi task, scoring artifact completeness, traceability, review usefulness.

---

## Nhóm 4: Hạn chế và rủi ro

### Q15: Hạn chế lớn nhất là gì?
**A:** Mock agents deterministic — chất lượng artifact phụ thuộc vào rule/pattern matching, không có reasoning sâu như LLM thật. Tuy nhiên, framework đã sẵn sàng cho LLM integration.

### Q16: LLM hallucination có phải vấn đề không?
**A:** Có, nếu dùng LLM thật. Đã có mitigation: output validation kiểm tra required sections, retry với correction prompt, fallback về mock nếu fail 2 lần.

### Q17: Context window limits?
**A:** Prompt assembler giới hạn 8000 characters, truncation nếu quá dài. Đây là heuristic đơn giản, không tính theo token.

### Q18: Security risks?
**A:** Đã có: upload size limit (1MB), file type whitelist, path traversal guard, API key masking, token không log. Chưa có authentication — đây là hạn chế đã ghi nhận.

### Q19: In-memory run store có vấn đề không?
**A:** Chạy mất data khi restart server. Mitigation: export run as JSON. Future work: database persistence.

---

## Nhóm 5: So sánh với công cụ khác

### Q20: Khác gì Devin?
**A:** Devin là commercial product với real LLM và cloud infrastructure. DevMIRA là thesis project chạy local, mock-first, focus vào traceability và senior value gates — những thứ Devin không có.

### Q21: Khác gì GitHub Copilot?
**A:** Copilot là code completion inline. DevMIRA là workflow engine tạo BA artifacts, test plan, code review, traceability — scope rộng hơn nhiều.

### Q22: Tại sao không dùng Octokit cho GitHub?
**A:** Tránh dependency. Dùng fetch() trực tiếp, implement Git Data API flow từ scratch. Ít dependency = ít vulnerability, dễ maintain.

---

## Nhóm 6: Đóng góp và original work

### Q23: Đóng góp chính là gì?
**A:** 6 đóng góp: (1) Workflow orchestration 11 agents, (2) Senior value gates, (3) Full traceability, (4) Real code patching, (5) Local web tool, (6) Multi-repo benchmark.

### Q24: Cái nào là original nhất?
**A:** Senior value gates (7 gates + 4 scores) — không có tool nào khác có. ScopeLock concept — định nghĩa scope rõ ràng với "not doing now". Hybrid execution mode — mock-first, LLM-refine.

### Q25: Source code có phải copy không?
**A:** Có file `docs/source_origin_analysis.md` ghi rõ: patterns tham khảo từ GoF, Redux, 12-Factor App; API specs từ OpenAI, Anthropic, GitHub. Nhưng logic domain (analyzeRequirement, generateTestCases, senior gates) là hoàn toàn original.

---

## Nhóm 7: Thực tế sử dụng

### Q26: Ai sẽ dùng hệ thống này?
**A:** BA, developer, reviewer, tech lead trong team phần mềm. Hoặc sinh viên muốn hiểu quy trình phát triển phần mềm chuyên nghiệp.

### Q27: Hệ thống có scale được không?
**A:** Hiện tại: single-user, in-memory. Có thể scale bằng: database persistence, authentication, parallel agents, CI/CD integration.

### Q28: Chi phí chạy hệ thống?
**A:** Mock mode: miễn phí, không cần API key. Real mode: phụ thuộc provider (OpenAI ~$0.01-0.10/request, Ollama miễn phí local).

### Q29: Thời gian chạy một workflow?
**A:** Mock mode: ~1 giây. Real LLM mode: 10-30 giây tùy provider.

### Q30: Có thể tích hợp vào CI/CD không?
**A:** Có. API endpoints sẵn sàng. Có thể trigger workflow qua POST /api/runs, lấy kết quả qua GET /api/runs/:runId. GitHub integration đã có (mock + real).
