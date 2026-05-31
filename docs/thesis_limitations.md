# Thesis Limitations

## Current Limitations

### 1. Deterministic Mock Agents
The default execution mode uses deterministic mock agents that generate content based on rule/pattern matching, not real LLM reasoning. This limits:
- Requirement analysis depth
- Natural language quality of artifacts
- Handling of complex/ambiguous requirements

### 2. No Real OCR/ASR/Vision
Image and voice input processors are mock implementations. Real OCR, ASR, and vision providers are not integrated.

### 3. In-Memory Run Store
Runs are stored in memory and lost on server restart. No database persistence.

### 4. Single-User Mode
No authentication or multi-user support. Collaboration features are local-only.

### 5. Limited Patch Intelligence
Patch mode uses pre-defined patch scenarios, not AI-generated patches. The system cannot autonomously generate code changes for arbitrary requirements.

### 6. No CI/CD Integration
No integration with CI/CD pipelines. Verification is limited to local command execution.

### 7. Browser Automation Optional
Playwright is an optional dependency. E2E testing requires separate installation.

### 8. GitHub Integration Requires Token
Real GitHub integration requires a personal access token. Mock mode is available for testing.

## Mitigation

Each limitation has a mitigation strategy:
- Mock agents can be replaced with real LLM providers
- OCR/ASR/Vision can be added as provider plugins
- Run store can be replaced with database
- Authentication can be added as middleware
- Patch intelligence can be improved with LLM integration
- CI/CD can be added via webhook/API integration
