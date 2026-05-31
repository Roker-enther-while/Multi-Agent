# Thesis Outline

## Title
Multi-Agent AI System for Software Development Workflow Automation

## Chapter 1: Introduction
- Problem statement: software development workflows lack traceability
- Motivation: automate requirement-to-report pipeline
- Contributions: deterministic multi-agent workflow, real code patching, local web tool

## Chapter 2: Background and Related Work
- Multi-agent systems in software engineering
- AI-assisted code generation and review
- Workflow automation tools
- Traceability in software development

## Chapter 3: System Architecture
- Overview: requirement → context → plan → test → implementation → review → report
- Agent roles: PM, Context Reader, BA, Visual Modeler, Senior, Planner, Test Designer, Implementation, Verification, Code Reviewer, Reporter
- Orchestrator: sequential agent coordination
- Artifact store: markdown/JSON outputs with metadata

## Chapter 4: Implementation
- TypeScript workflow engine
- Mock agent implementations with requirement-specific content generation
- Patch applicator for real code changes
- Node.js HTTP API server
- Single-page web UI
- Model provider layer (mock, OpenAI, Anthropic, Gemini, Ollama, LM Studio)

## Chapter 5: Evaluation
- Real-world validation: 10 scenarios, 80.1/100 score
- Real code patch validation: 5 scenarios, 91/100 score
- Artifact completeness analysis
- Test plan quality analysis
- Context relevance analysis

## Chapter 6: Demo and Case Studies
- End-to-end demo walkthrough
- Patch mode demonstration
- Multi-source input handling
- Export and reporting

## Chapter 7: Conclusion and Future Work
- Summary of contributions
- Limitations: deterministic mocks, no real LLM integration
- Future work: LLM integration, parallel agents, CI/CD integration

## Appendices
- A: API reference
- B: Configuration reference
- C: Evaluation data
