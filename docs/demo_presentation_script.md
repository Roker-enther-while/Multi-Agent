# Demo Presentation Script — Kịch Bản Trình Demo

**Thời gian:** 5–7 phút
**Yêu cầu:** Máy đã cài Node.js 18+, repo đã clone

---

## Chuẩn bị trước demo (2 phút)

```bash
cd src && npm install && npm run build && cd ..
node src/dist/server/server.js
```

Mở http://localhost:3456 trong trình duyệt.

---

## Phần 1: Giới thiệu UI (30 giây)

**Nói:** "Đây là DevMIRA — một công cụ local hỗ trợ quy trình phát triển phần mềm bằng multi-agent AI. Không phải chatbot, không phải coding assistant. Đây là workflow engine mô phỏng quy trình senior developer."

**Thao tác:**
- Chỉ vào chat panel: "Nhập yêu cầu ở đây"
- Chỉ vào sidebar: "Danh sách các lần chạy"
- Chỉ vào Settings: "Cấu hình model provider"

---

## Phần 2: Cấu hình Model (30 giây)

**Nói:** "Mặc định dùng mock provider — không cần API key, không cần GPU. Có thể cấu hình OpenAI, Anthropic, Gemini, Ollama, LM Studio."

**Thao tác:**
- Click Settings
- Chỉ vào Execution Mode: "Mock, Real LLM, hoặc Hybrid"
- Chỉ vào Provider: "6 loại provider"
- Click Test Connection → "Mock provider always available"
- Close settings

---

## Phần 3: Chạy Plan-Only Workflow (1.5 phút)

**Nói:** "Tôi sẽ nhập một yêu cầu phần mềm và chạy workflow. Hệ thống sẽ phân tích, tạo BA artifacts, test plan, implementation guidance, code review, và report."

**Thao tác:**
- Nhập: `Add GET /health/details returning app_name, version, and environment.`
- Click Run
- **Chỉ status:** "queued → running → completed — mất khoảng 1 giây"
- Click run completed trong sidebar
- **Chỉ artifacts:** "11 artifacts được tạo ra"
- Click `context_pack`: "Hệ thống phân tích repo và tìm file liên quan"
- Click `test_plan`: "4 loại test: positive, negative, edge, regression"
- Click `code_review_report`: "Review findings theo loại yêu cầu"
- Click "Open Report": "HTML report có thể mở trong trình duyệt"

---

## Phần 4: Chạy Patch Mode (1.5 phút)

**Nói:** "Bây giờ tôi sẽ chạy patch mode — hệ thống sẽ áp dụng code thay đổi thật vào workspace và chạy test."

**Thao tác:**
- Chọn "Patch Mode"
- Nhập workspace: `examples/patch_targets/ts_mini_app`
- Nhập: `Add email validation to createUser()`
- Click Run
- **Chỉ kết quả:** "Patch applied: ✅, Tests pass: ✅"
- Click "View Diff": "Đây là diff thật của code thay đổi"

---

## Phần 5: Export và Benchmark (30 giây)

**Nói:** "Có thể export toàn bộ kết quả thành JSON, chạy benchmark trên nhiều repo."

**Thao tác:**
- Click "Download Run Package (JSON)"
- **Nói:** "Benchmark: 3 repos, 12 tasks, scoring tự động"

---

## Phần 6: Tổng kết (15 giây)

**Nói:** "Tóm lại: DevMIRA tự động hóa quy trình phát triển phần mềm từ requirement đến report, với traceability đầy đủ, senior value gates, và real code patching. Hoạt động local, không cần GPU."

---

## Lưu ý khi demo

1. **Chạy server trước** ít nhất 1 phút
2. **Chuẩn bị sẵn** query trong clipboard
3. **Không giải thích code** — chỉ show kết quả
4. **Nếu có lỗi:** "Hệ thống có xử lý lỗi gracefully" → show error message
5. **Kết thúc đúng giờ** — không kéo dài
