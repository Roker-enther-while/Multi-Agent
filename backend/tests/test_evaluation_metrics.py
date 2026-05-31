import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from scripts.run_eval import (  # noqa: E402
    compute_metrics,
    is_match,
    mrr,
    recall_at_k,
    timestamp_overlap,
    write_reports,
)


def test_timestamp_overlap_true_and_false():
    assert timestamp_overlap(1.0, 3.0, 2.0, 4.0) is True
    assert timestamp_overlap(1.0, 2.0, 2.0, 3.0) is False
    assert timestamp_overlap(None, 2.0, 1.0, 3.0) is False


def test_is_match_segment_id_exact():
    assert is_match({"segment_id": "seg_1"}, {"segment_id": "seg_1"}) is True
    assert is_match({"segment_id": "seg_1"}, {"segment_id": "seg_2"}) is False


def test_is_match_asset_and_timestamp_overlap():
    prediction = {"asset_id": "video_1", "timestamp_start": 10.0, "timestamp_end": 15.0}
    relevant = {"asset_id": "video_1", "timestamp_start": 14.0, "timestamp_end": 18.0}
    assert is_match(prediction, relevant) is True


def test_recall_at_k_and_mrr():
    predictions = [
        {"asset_id": "asset_a", "segment_id": "seg_a"},
        {"asset_id": "asset_b", "segment_id": "seg_b"},
    ]
    relevant = [{"asset_id": "asset_b", "segment_id": "seg_b"}]

    assert recall_at_k(predictions, relevant, 1) == 0.0
    assert recall_at_k(predictions, relevant, 5) == 1.0
    assert mrr(predictions, relevant) == 0.5


def test_compute_metrics_and_report_writer(tmp_path):
    eval_items = [
        {
            "query_id": "q_001",
            "query": "find segment",
            "relevant": [{"asset_id": "asset_1", "segment_id": "seg_1"}],
        }
    ]
    predictions_by_query = {
        "q_001": {
            "query_id": "q_001",
            "latency_ms": 25,
            "answers": [{"asset_id": "asset_1", "segment_id": "seg_1"}],
        }
    }

    metrics = compute_metrics(eval_items, predictions_by_query)
    write_reports(tmp_path, metrics, list(predictions_by_query.values()))

    assert metrics["Recall@1"] == 1.0
    assert metrics["MRR"] == 1.0
    assert metrics["latency_p50"] == 25.0
    assert (tmp_path / "eval_report.json").exists()
    assert (tmp_path / "eval_report.csv").exists()
    assert (tmp_path / "eval_predictions.json").exists()
    assert json.loads((tmp_path / "eval_report.json").read_text(encoding="utf-8"))["total_queries"] == 1
