# Evaluation Method

The evaluation method checks whether the workflow consistently produces the expected evidence for different requirement types.

## Dataset

Sample tasks are stored in `examples/evaluation_tasks/`:

1. Add health details endpoint
2. Add validation rule
3. Update API response field
4. Add UI button requirement
5. Add error handling requirement

Each task is a Markdown requirement. `expected_checklist.json` defines required artifact types and required headings.

## Evaluation Script

Run from the repository root after build:

```bash
node src/dist/evaluation/run_evaluation.js
```

The script runs the full workflow for each requirement and checks:

- required artifacts are generated
- required headings exist
- final validation passes

## Success Criteria

An evaluation task passes only when all artifact checks, heading checks, and final validation checks pass.

## Interpretation

This evaluation does not measure model intelligence because the current workflow is deterministic. It measures workflow completeness, traceability, and verification discipline. This is appropriate for the current thesis stage because it proves the system architecture before adding real LLM behavior.

## Future Evaluation

Future work can compare deterministic agents, LLM-backed agents, and generic chatbot baselines on traceability quality, missed requirements, verification accuracy, and reviewer effort.
