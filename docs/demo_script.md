# Demo Script

Use this script for thesis demonstrations or supervisor reviews.

## 1. Build and Test

```bash
cd src
npm run lint
npx tsc -p tsconfig.test.json
npm test
npm run build
cd ..
```

Expected result: all commands pass.

## 2. Show CLI Help

```bash
node src/dist/cli.js --help
```

Expected result: commands `run`, `demo`, `validate`, `inspect`, and `report` are listed.

## 3. Run End-to-End Demo

```bash
node src/dist/demo/run_demo.js
```

Expected result:

- status is `completed`
- `finalValidation.passed` is `true`
- `htmlReportPath` points to `.ai_runs/end-to-end-demo/report.html`

## 4. Inspect Artifacts

Open `.ai_runs/end-to-end-demo/` and show:

- BA requirement package
- visual model package
- senior review
- verification report
- code review report
- final report
- `report.html`

## 5. Run Evaluation

```bash
node src/dist/evaluation/run_evaluation.js
```

Expected result: five tasks pass.

## Key Talking Points

This project is not a generic chatbot and not a clone of coding tools. The contribution is a senior-like workflow that emphasizes context, traceability, verification, review, and measurable handoff evidence.
