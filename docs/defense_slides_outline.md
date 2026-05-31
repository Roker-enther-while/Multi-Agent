# Defense Slides Outline — Dàn Trang Trình Chiếu Bảo Vệ

**Tổng số slide:** 13
**Thời gian trình bày:** 15–20 phút

---

## Slide 1: Trang bìa
- **Tiêu đề:** Multi-Agent AI hỗ trợ phát triển phần mềm từ yêu cầu đến test case và review code
- **Tên:** [Tên sinh viên]
- **GVHD:** [Tên giảng viên]
- **Ngày:** 2026

---

## Slide 2: Vấn đề (Problem)
- Phát triển phần mềm thiếu traceability: requirement → code → test → review
- Không có công cụ tự động hóa toàn bộ pipeline
- Manual workflow dễ mất thông tin khi team thay đổi
- **Hình:** Minh họa quy trình thủ công với các mắt xích đứt gãy

---

## Slide 3: Động lực (Motivation)
- BA/Senior tốn thời gian viết tài liệu thủ công
- Code review thiếu cấu trúc, phụ thuộc kinh nghiệm cá nhân
- Test plan thường bị bỏ qua hoặc không đầy đủ
- Không có bằng chứng truy vết từ requirement đến implementation
- **Hình:** So sánh thời gian manual vs automated

---

## Slide 4: Công cụ hiện có (Existing Tools)
- **ChatGPT/Claude:** Sinh code ad-hoc, không có workflow structure
- **Cursor/Copilot:** Code completion, không có BA/review/traceability
- **Jira/Linear:** Theo dõi issue nhưng không tự động hóa workflow
- **Hình:** Bảng so sánh features

---

## Slide 5: Hệ thống đề xuất (Proposed System)
- **Tên:** DevMIRA — Developer Multi-Agent Intelligent Retrieval Assistant
- **Không phải chatbot** — là workflow engine
- **Không phải coding assistant** — là senior-like process automation
- **11 agents** chạy tuần tự, mỗi agent tạo artifact có thể truy vết
- **Hình:** Overview diagram

---

## Slide 6: Kiến trúc (Architecture)
- **3 components:** Workflow Engine + Web UI + Backend API
- **11 agents** chạy theo pipeline
- **Artifact-centric:** Mọi output là markdown có metadata
- **Mock-first:** Mặc định deterministic, có thể nâng cấp lên LLM thật
- **Hình:** System architecture diagram (Mermaid)

---

## Slide 7: Agent Workflow
- **Pipeline:** Requirement → Context → BA → Visual → Senior → Plan → Test → Impl → Verify → Review → Traceability → Final
- **Mỗi agent** có system prompt riêng, input từ artifacts trước đó
- **Output validation** với retry correction
- **Hình:** Agent workflow diagram

---

## Slide 8: Senior Value Layer (Đóng góp chính)
- **7 Gates:** Problem Framing, Scope Decision, Risk Assessment, Architecture Judgment, Priority Decision, Quality Gate, Handoff
- **4 Scores:** Traceability (95), Test Readiness (90), Scope Risk (88), Architecture Fit (92)
- **Đây là original contribution** — không có tool nào khác có
- **Hình:** Senior value gates diagram

---

## Slide 9: Model Provider Layer
- **6 providers:** Mock, OpenAI Compatible, Anthropic, Gemini, Ollama, LM Studio
- **3 execution modes:** Mock (deterministic), Real (LLM), Hybrid (mock + LLM refine)
- **Config qua env vars**, không hardcode API key
- **Hình:** Provider architecture

---

## Slide 10: Demo Flow (5–7 phút)
1. Start app → Open UI
2. Configure mock provider
3. Submit requirement → Show workflow progress
4. Show artifacts (context_pack, test_plan, code_review)
5. Show report.html
6. Patch mode → Show diff
7. Export package
- **Hình:** Screenshot UI

---

## Slide 11: Đánh giá (Evaluation)
- **Unit tests:** 77/77 pass
- **Evaluation tasks:** 5/5 pass
- **Real-world validation:** 80.1/100 (10 scenarios)
- **Patch validation:** 91/100 (5 scenarios, 5/5 pass)
- **Multi-repo benchmark:** 3 repos, 12 tasks
- **Hình:** Evaluation results chart

---

## Slide 12: Hạn chế & Hướng phát triển
**Hạn chế:**
- Mock agents (chưa dùng LLM thật)
- In-memory run store
- Chưa có authentication

**Hướng phát triển:**
- Tích hợp LLM thật (v1.1 đã có framework)
- Database persistence
- CI/CD integration
- Autonomous patch generation

---

## Slide 13: Kết luận
- **Đóng góp chính:**
  1. Workflow orchestration với 11 agents
  2. Senior value gates (7 gates + 4 scores)
  3. Full traceability từ requirement đến report
  4. Real code patching với verification
  5. Local web tool hoàn chỉnh
  6. Multi-repo benchmark
- **Hệ thống hoạt động:** npm install → npm run build → node server.js
- **Không cần GPU/API key** cho chế độ mặc định
