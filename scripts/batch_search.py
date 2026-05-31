import argparse
import json
from pathlib import Path
from typing import Any
from urllib import request


def build_payload(query_item: dict[str, Any], top_k: int, speed_mode: str) -> dict[str, Any]:
    return {
        "query_id": query_item["query_id"],
        "query": query_item["query"],
        "top_k": top_k,
        "return_format": "challenge_json",
        "speed_mode": speed_mode,
    }


def call_auto_search(api_url: str, payload: dict[str, Any], timeout: int = 30) -> dict[str, Any]:
    body = json.dumps(payload).encode("utf-8")
    req = request.Request(
        f"{api_url.rstrip('/')}/api/v1/auto/search",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with request.urlopen(req, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def run_batch(
    queries: list[dict[str, Any]],
    *,
    api_url: str,
    top_k: int,
    speed_mode: str,
    timeout: int,
) -> list[dict[str, Any]]:
    responses: list[dict[str, Any]] = []
    for item in queries:
        payload = build_payload(item, top_k, speed_mode)
        responses.append(call_auto_search(api_url, payload, timeout=timeout))
    return responses


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run VietMIRA auto search for a batch of queries.")
    parser.add_argument("--queries", required=True, help="Path to queries JSON.")
    parser.add_argument("--api-url", default="http://localhost:8000", help="Backend base URL without /api/v1.")
    parser.add_argument("--output", default="reports/answers.json", help="Output answers JSON path.")
    parser.add_argument("--top-k", type=int, default=10)
    parser.add_argument("--speed-mode", choices=["fast", "balanced", "accurate"], default="balanced")
    parser.add_argument("--timeout", type=int, default=30)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    queries_path = Path(args.queries)
    output_path = Path(args.output)
    queries = json.loads(queries_path.read_text(encoding="utf-8"))
    responses = run_batch(
        queries,
        api_url=args.api_url,
        top_k=args.top_k,
        speed_mode=args.speed_mode,
        timeout=args.timeout,
    )
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(responses, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(responses)} auto search responses to {output_path}")


if __name__ == "__main__":
    main()
