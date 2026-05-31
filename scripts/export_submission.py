import argparse
import json
from pathlib import Path
from typing import Any


def export_submission(answers: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for response in answers:
        query_id = response.get("query_id")
        for answer in response.get("answers", []):
            rows.append(
                {
                    "query_id": query_id,
                    "rank": answer.get("rank"),
                    "asset_id": answer.get("asset_id"),
                    "segment_id": answer.get("segment_id"),
                    "timestamp_start": answer.get("timestamp_start"),
                    "timestamp_end": answer.get("timestamp_end"),
                    "score": answer.get("score"),
                }
            )
    return rows


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Export VietMIRA auto-search responses to challenge rows.")
    parser.add_argument("--answers", required=True, help="Path to answers JSON from batch_search.py.")
    parser.add_argument("--output", default="reports/challenge_submission.json", help="Output submission JSON.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    answers_path = Path(args.answers)
    output_path = Path(args.output)
    answers = json.loads(answers_path.read_text(encoding="utf-8"))
    rows = export_submission(answers)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(rows)} submission rows to {output_path}")


if __name__ == "__main__":
    main()
