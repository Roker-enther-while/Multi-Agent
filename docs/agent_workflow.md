# Agent Workflow

The agent workflow models senior-like engineering coordination rather than free-form chat.

## Agent Roles

- Context Reader: summarizes repository context for the requirement.
- BA Artifact: writes user stories, acceptance criteria, workflow, API draft, data draft, and UI draft.
- Visual Modeling: creates Mermaid diagrams for workflow, state, and data relationships.
- Senior Layer: evaluates gates and scores for problem framing, scope, risk, architecture, priority, quality, and handoff.
- Planner: creates the task plan.
- Test Designer: lists verification commands.
- Implementation Agent: summarizes implementation scope.
- Test Runner Debugger: records verification results and blockers.
- Code Reviewer: generates review findings.
- Reporter Traceability: links artifacts into traceability and final reports.

## Senior Value Gates

The senior layer produces measurable fields:

- `traceability_score`
- `test_readiness_score`
- `scope_risk_score`
- `architecture_fit_score`

These scores are included in the senior review and final report. They make reasoning inspectable instead of hidden in natural-language claims.

## Traceability

Each agent produces an artifact. The orchestrator records artifact paths and metadata in project state. The final report and HTML report expose the chain for review.

## Failure Handling

When verification fails, the workflow records a blocker and stops before code review and final reporting. This prevents false done reports.
