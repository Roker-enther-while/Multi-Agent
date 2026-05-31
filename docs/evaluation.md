# Evaluation

VietMIRA evaluates automatic challenge search by calling `/api/v1/auto/search` for each query and comparing top-k answers with ground truth.

## Ground Truth Format

```json
[
  {
    "query_id": "q_001",
    "query": "Tim nguoi mac ao do dung canh xe may",
    "task_type": "known_item",
    "relevant": [
      {
        "asset_id": "video_00012",
        "segment_id": "video_00012_frame_0",
        "timestamp_start": 132.4,
        "timestamp_end": 139.8
      }
    ]
  }
]
```

## Run

```bash
python scripts/run_eval.py --queries data/eval.sample.json --api-url http://localhost:8000 --top-k 10 --output-dir reports
```

Outputs:

- `reports/eval_report.json`
- `reports/eval_report.csv`
- `reports/eval_predictions.json`

## Metrics

- `Recall@1`, `Recall@5`, `Recall@10`: one if any relevant item appears in the top-k results for a query, averaged over queries.
- `MRR`: reciprocal rank of the first matching result, averaged over queries.
- `latency_avg`, `latency_p50`, `latency_p95`: milliseconds returned by the auto search endpoint.
- `total_queries`, `answered_queries`: coverage counters.

## Match Logic

1. If both prediction and ground truth have `segment_id`, exact `segment_id` match is required.
2. If `segment_id` is absent, `asset_id` plus timestamp overlap is used.
3. For text/audio items without timestamps, `asset_id` match is accepted only when `segment_id` is absent.
4. Timestamp overlap is MVP strict positive interval overlap.

## Known Limitations

The current retrieval stack uses deterministic mock OCR, captioning, embeddings, and ASR. Evaluation therefore validates API and metric plumbing, not real model quality yet.
