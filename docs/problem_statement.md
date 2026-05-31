# Problem Statement

This project addresses a common gap in AI-assisted software work: many assistants can answer questions or generate code snippets, but they do not reliably manage the full engineering workflow from requirement intake to verification and review.

The target problem is not generic chat. The system is designed to behave like a workflow-oriented engineering assistant that preserves context, produces traceable artifacts, validates outputs, and makes failures visible.

## Research Focus

The thesis focus is senior-like workflow support:

- Convert requirements into structured context and plans.
- Maintain traceability from requirement to artifacts, tests, verification, review, and final report.
- Use measurable gates for scope, risk, architecture fit, test readiness, and quality.
- Produce evidence before reporting completion.

## What This Is Not

This is not a generic chatbot. It does not optimize for open-ended conversation.

This is not a clone of coding tools. It does not aim to replace IDE features, autocomplete, or repository hosting workflows.

Instead, it studies how an AI workflow can coordinate engineering reasoning, artifact generation, and verification in a way that is inspectable by students, supervisors, and reviewers.

## Limitations

Current agents are deterministic and local. Real LLM calls, OCR, ASR, and external tool integrations are intentionally deferred. This keeps the demo reproducible and makes evaluation easier.

## Future Work

Future work can add real model calls, richer repository analysis, human approval gates, UI visualization, and comparison against baseline chatbot workflows.
