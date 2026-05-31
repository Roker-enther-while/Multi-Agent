# Comparison with Existing Tools — Bảng So Sánh Chi Tiết

---

## So sánh tổng quan

| Tiêu chí | DevMIRA | Claude Code | Cursor | GitHub Copilot | Devin | Thủ công |
|---|---|---|---|---|---|---|
| **Loại công cụ** | Workflow engine | Coding assistant | Coding assistant | Code completion | AI agent | Manual process |
| **Phân tích requirement** | ✅ Cấu trúc (10 loại) | ⚠️ Ad-hoc | ❌ | ❌ | ⚠️ Tự nhiên | ⚠️ Thủ công |
| **BA artifacts** | ✅ Auto (user stories, AC) | ⚠️ Khi yêu cầu | ❌ | ❌ | ⚠️ Hạn chế | ❌ Thủ công |
| **Visual modeling** | ✅ Mermaid diagrams | ⚠️ Khi yêu cầu | ❌ | ❌ | ❌ | ❌ Thủ công |
| **Senior review gates** | ✅ 7 gates + 4 scores | ❌ | ❌ | ❌ | ❌ | ⚠️ Phụ thuộc người |
| **Test plan** | ✅ 4 loại (pos/neg/edge/reg) | ⚠️ Ad-hoc | ⚠️ Inline | ⚠️ Inline | ⚠️ Cơ bản | ⚠️ Thủ công |
| **Code review** | ✅ Theo loại + risk | ⚠️ Ad-hoc | ❌ | ❌ | ⚠️ Cơ bản | ⚠️ Phụ thuộc người |
| **Traceability** | ✅ Full chain | ❌ | ❌ | ❌ | ❌ | ⚠️ Thủ công |
| **Verification** | ✅ Chạy commands | ❌ | ❌ | ❌ | ✅ Chạy test | ⚠️ Thủ công |
| **HTML report** | ✅ Auto | ❌ | ❌ | ❌ | ❌ | ❌ Thủ công |
| **Patch mode** | ✅ Real code patches | ⚠️ Inline | ⚠️ Inline | ⚠️ Inline | ✅ Full | ❌ Thủ công |
| **GitHub PR** | ✅ Full workflow | ❌ | ❌ | ⚠️ Copilot PR | ✅ Full | ⚠️ Thủ công |
| **E2E testing** | ✅ Playwright | ❌ | ❌ | ❌ | ❌ | ⚠️ Thủ công |
| **Multi-source input** | ✅ Text/file/image/voice | ⚠️ Text only | ❌ | ❌ | ⚠️ Text/image | ⚠️ Thủ công |
| **Export** | ✅ JSON package | ❌ | ❌ | ❌ | ⚠️ Limited | ⚠️ Thủ công |
| **Chạy local** | ✅ | ❌ Cloud | ⚠️ Local + Cloud | ❌ Cloud | ❌ Cloud | ✅ |
| **Cần API key** | ❌ (mock mode) | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Giá** | Miễn phí | $20/tháng | $20/tháng | $10/tháng | $500/tháng | Miễn phí |

---

## So sánh chi tiết từng công cụ

### DevMIRA vs Claude Code

| Khía cạnh | DevMIRA | Claude Code |
|---|---|---|
| **Mục đích** | Workflow automation | Code generation |
| **Cách tiếp cận** | 11 agents tuần tự | Single LLM call |
| **Output** | 11 artifacts + report.html | Code snippets |
| **Traceability** | Full chain | Không có |
| **Senior review** | 7 gates + scores | Không có |
| **Test plan** | 4 loại test | Ad-hoc |
| **Verification** | Chạy commands thật | Không có |
| **Điểm mạnh** | Structure, traceability | Flexibility, reasoning |
| **Điểm yếu** | Deterministic (mock) | Không có workflow |

### DevMIRA vs Cursor

| Khía cạnh | DevMIRA | Cursor |
|---|---|---|
| **Mục đích** | Workflow automation | Code editing |
| **Cách tiếp cận** | Agent pipeline | IDE integration |
| **Output** | Full artifacts | Inline suggestions |
| **Context** | Full repo analysis | Current file context |
| **Review** | Type-specific findings | Inline suggestions |
| **Điểm mạnh** | Full workflow | IDE experience |
| **Điểm yếu** | Separate UI | No workflow structure |

### DevMIRA vs GitHub Copilot

| Khía cạnh | DevMIRA | GitHub Copilot |
|---|---|---|
| **Mục đích** | Workflow automation | Code completion |
| **Cách tiếp cận** | Standalone tool | IDE plugin |
| **Output** | Full artifacts | Inline completions |
| **Scope** | Full SDLC | Code writing only |
| **Điểm mạnh** | Workflow + review | Speed, integration |
| **Điểm yếu** | Separate tool | No workflow |

### DevMIRA vs Devin

| Khía cạnh | DevMIRA | Devin |
|---|---|---|
| **Mục đích** | Workflow automation | Autonomous coding |
| **Cách tiếp cận** | Deterministic pipeline | LLM-driven |
| **Output** | Structured artifacts | Code + PR |
| **Senior review** | 7 gates + scores | Không có |
| **Traceability** | Full chain | Limited |
| **Điểm mạnh** | Structure, local | Autonomy |
| **Điểm yếu** | Mock agents | Expensive, cloud |

### DevMIRA vs Manual Workflow

| Khía cạnh | DevMIRA | Thủ công |
|---|---|---|
| **Tốc độ** | ~1 giây (mock) | Giờ/ngày |
| **Consistency** | 100% deterministic | Phụ thuộc người |
| **Traceability** | Auto | Manual, dễ mất |
| **Test plan** | 4 loại tự động | Viết tay |
| **Review** | Theo loại + risk | Phụ thuộc kinh nghiệm |
| **Điểm mạnh** | Nhanh, consistent, traceable | Flexible, creative |
| **Điểm yếu** | Không có reasoning sâu | Tốn thời gian, dễ sai |

---

## Điểm khác biệt cốt lõi của DevMIRA

1. **Workflow Engine** — Không phải chatbot, là pipeline 11 bước
2. **Senior Value Gates** — 7 gates + 4 scores (original contribution)
3. **Full Traceability** — Requirement → artifact chain → report
4. **Real Code Patching** — Áp dụng code thật, chạy test thật
5. **Local-first** — Không cần cloud, không cần API key
6. **Source Origin Transparency** — Ghi rõ nguồn tham khảo cho mọi file
