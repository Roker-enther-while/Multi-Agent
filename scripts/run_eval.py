import argparse
import csv
import json
from pathlib import Path
from statistics import mean
from typing import Any
from urllib import error, request


def timestamp_overlap(
    pred_start: float | None,
    pred_end: float | None,
    gt_start: float | None,
    gt_end: float | None,
) -> bool:
    if pred_start is None or pred_end is None or gt_start is None or gt_end is None:
        return False
    return max(pred_start, gt_start) < min(pred_end, gt_end)


def is_match(prediction: dict[str, Any], ground_truth: dict[str, Any]) -> bool:
    pred_segment = prediction.get("segment_id")
    gt_segment = ground_truth.get("segment_id")
    if pred_segment and gt_segment:
        return pred_segment == gt_segment

    if prediction.get("asset_id") != ground_truth.get("asset_id"):
        return False

    has_any_timestamp = any(
        value is not None
        for value in [
            prediction.get("timestamp_start"),
            prediction.get("timestamp_end"),
            ground_truth.get("timestamp_start"),
            ground_truth.get("timestamp_end"),
        ]
    )
    if not has_any_timestamp:
        return True
    return timestamp_overlap(
        prediction.get("timestamp_start"),
        prediction.get("timestamp_end"),
        ground_truth.get("timestamp_start"),
        ground_truth.get("timestamp_end"),
    )


def recall_at_k(predictions: list[dict[str, Any]], relevant: list[dict[str, Any]], k: int) -> float:
    if not relevant:
        return 0.0
    top_predictions = predictions[:k]
    return 1.0 if any(is_match(pred, gt) for pred in top_predictions for gt in relevant) else 0.0


def mrr(predictions: list[dict[str, Any]], relevant: list[dict[str, Any]]) -> float:
    if not relevant:
        return 0.0
    for index, prediction in enumerate(predictions, start=1):
        if any(is_match(prediction, gt) for gt in relevant):
            return 1.0 / index
    return 0.0


def percentile(values: list[float], pct: float) -> float:
    if not values:
        return 0.0
    sorted_values = sorted(values)
    if len(sorted_values) == 1:
        return sorted_values[0]
    rank = (len(sorted_values) - 1) * pct
    lower = int(rank)
    upper = min(lower + 1, len(sorted_values) - 1)
    fraction = rank - lower
    return sorted_values[lower] + (sorted_values[upper] - sorted_values[lower]) * fraction


def compute_metrics(eval_items: list[dict[str, Any]], predictions_by_query: dict[str, dict[str, Any]]) -> dict[str, Any]:
    recall_1: list[float] = []
    recall_5: list[float] = []
    recall_10: list[float] = []
    reciprocal_ranks: list[float] = []
    latencies: list[float] = []
    answered_queries = 0

    for item in eval_items:
        response = predictions_by_query.get(item["query_id"], {})
        predictions = response.get("answers", [])
        relevant = item.get("relevant", [])
        if predictions:
            answered_queries += 1
        recall_1.append(recall_at_k(predictions, relevant, 1))
        recall_5.append(recall_at_k(predictions, relevant, 5))
        recall_10.append(recall_at_k(predictions, relevant, 10))
        reciprocal_ranks.append(mrr(predictions, relevant))
        if response.get("latency_ms") is not None:
            latencies.append(float(response["latency_ms"]))

    return {
        "Recall@1": mean(recall_1) if recall_1 else 0.0,
        "Recall@5": mean(recall_5) if recall_5 else 0.0,
        "Recall@10": mean(recall_10) if recall_10 else 0.0,
        "MRR": mean(reciprocal_ranks) if reciprocal_ranks else 0.0,
        "latency_avg": mean(latencies) if latencies else 0.0,
        "latency_p50": percentile(latencies, 0.50),
        "latency_p95": percentile(latencies, 0.95),
        "total_queries": len(eval_items),
        "answered_queries": answered_queries,
    }


def call_auto_search(api_url: str, item: dict[str, Any], top_k: int, speed_mode: str, timeout: int) -> dict[str, Any]:
    payload = {
        "query_id": item["query_id"],
        "query": item["query"],
        "top_k": top_k,
        "return_format": "challenge_json",
        "speed_mode": speed_mode,
    }
    body = json.dumps(payload).encode("utf-8")
    req = request.Request(
        f"{api_url.rstrip('/')}/api/v1/auto/search",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with request.urlopen(req, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def write_reports(output_dir: Path, metrics: dict[str, Any], predictions: list[dict[str, Any]]) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "eval_report.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    (output_dir / "eval_predictions.json").write_text(json.dumps(predictions, ensure_ascii=False, indent=2), encoding="utf-8")
    with (output_dir / "eval_report.csv").open("w", encoding="utf-8", newline="") as file:
        writer = csv.writer(file)
        writer.writerow(["metric", "value"])
        for key, value in metrics.items():
            writer.writerow([key, value])


def print_metrics(metrics: dict[str, Any]) -> None:
    width = max(len(key) for key in metrics)
    print("Metric".ljust(width), "Value")
    print("-" * (width + 12))
    for key, value in metrics.items():
        rendered = f"{value:.4f}" if isinstance(value, float) else str(value)
        print(key.ljust(width), rendered)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Evaluate VietMIRA auto-search results.")
    parser.add_argument("--queries", required=True, help="Ground-truth eval JSON.")
    parser.add_argument("--api-url", default="http://localhost:8000", help="Backend base URL without /api/v1.")
    parser.add_argument("--top-k", type=int, default=10)
    parser.add_argument("--output-dir", default="reports")
    parser.add_argument("--speed-mode", choices=["fast", "balanced", "accurate"], default="balanced")
    parser.add_argument("--timeout", type=int, default=30)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    eval_items = json.loads(Path(args.queries).read_text(encoding="utf-8"))
    predictions: list[dict[str, Any]] = []
    try:
        for item in eval_items:
            predictions.append(call_auto_search(args.api_url, item, args.top_k, args.speed_mode, args.timeout))
    except (error.URLError, TimeoutError) as exc:
        raise SystemExit(f"Evaluation API call failed: {exc}") from exc

    predictions_by_query = {item["query_id"]: item for item in predictions}
    metrics = compute_metrics(eval_items, predictions_by_query)
    write_reports(Path(args.output_dir), metrics, predictions)
    print_metrics(metrics)


if __name__ == "__main__":
    main()
