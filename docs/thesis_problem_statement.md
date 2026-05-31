# Thesis Problem Statement

## Problem

Software development workflows lack structured traceability. When a requirement is implemented, there is often no clear link between:
- The original requirement
- The analysis and design decisions
- The test cases
- The actual code changes
- The review findings
- The verification results

This leads to:
- Missed requirements
- Untested code paths
- Inconsistent reviews
- Difficulty auditing changes
- Knowledge loss when team members leave

## Why Existing Tools Are Insufficient

### AI Chatbots (ChatGPT, Claude)
- Generate code snippets without workflow context
- No traceability from requirement to implementation
- No verification or review gates
- No artifact persistence

### Coding Assistants (Cursor, GitHub Copilot)
- Focus on code completion, not workflow management
- No structured requirement analysis
- No BA/senior role simulation
- No end-to-end traceability

### Project Management Tools (Jira, Linear)
- Track issues but don't automate the workflow
- No code generation or review
- No verification integration
- No artifact generation

## Core Difference

This system is not a chatbot. It is not a coding assistant. It is a **workflow engine** that simulates a senior-like software development process:

1. **Context Analysis**: Understands the repository structure and identifies relevant files
2. **BA Artifacts**: Generates user stories, acceptance criteria, and flow diagrams
3. **Visual Modeling**: Creates workflow, state, and data relationship diagrams
4. **Senior Review**: Applies structured value gates with numeric scoring
5. **Task Planning**: Creates type-specific implementation steps
6. **Test Planning**: Generates positive, negative, edge, and regression tests
7. **Implementation Guidance**: Provides concrete file-level instructions
8. **Verification**: Executes commands and records results
9. **Code Review**: Generates requirement-specific findings with risk assessment
10. **Traceability**: Links every artifact back to the original requirement

The key innovation is **structured traceability** — every artifact is linked, every decision is recorded, and every verification is documented.
