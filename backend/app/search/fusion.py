from __future__ import annotations

from dataclasses import dataclass, field

from app.search.retrievers import RetrieverResult


DEFAULT_WEIGHTS = {
    "image_text": 0.30,
    "text_sparse": 0.25,
    "ocr": 0.15,
    "transcript": 0.15,
    "object": 0.10,
    "metadata": 0.05,
    "audio_event": 0.15,
    "temporal": 0.05,
}


@dataclass
class FusedResult:
    segment_id: str
    asset_id: str
    final_score: float
    component_scores: dict[str, float] = field(default_factory=dict)
    retrievers: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "segment_id": self.segment_id,
            "asset_id": self.asset_id,
            "final_score": self.final_score,
            "component_scores": self.component_scores,
            "retrievers": self.retrievers,
        }


def reciprocal_rank_fusion(
    results_by_retriever: dict[str, list[RetrieverResult]],
    k: int = 60,
) -> list[FusedResult]:
    by_segment: dict[str, FusedResult] = {}
    for retriever_name, results in results_by_retriever.items():
        for rank, result in enumerate(results, start=1):
            fused = by_segment.setdefault(
                result.segment_id,
                FusedResult(
                    segment_id=result.segment_id,
                    asset_id=result.asset_id,
                    final_score=0.0,
                    component_scores={},
                    retrievers=[],
                ),
            )
            contribution = 1.0 / float(k + rank)
            fused.final_score += contribution
            fused.component_scores[retriever_name] = result.score
            if retriever_name not in fused.retrievers:
                fused.retrievers.append(retriever_name)
    return sorted(by_segment.values(), key=lambda item: item.final_score, reverse=True)


def weighted_fusion(
    results_by_retriever: dict[str, list[RetrieverResult]],
    weights: dict[str, float] | None = None,
) -> list[FusedResult]:
    weights = weights or DEFAULT_WEIGHTS
    by_segment: dict[str, FusedResult] = {}
    max_by_retriever = {
        retriever_name: max((result.score for result in results), default=0.0)
        for retriever_name, results in results_by_retriever.items()
    }
    for retriever_name, results in results_by_retriever.items():
        max_score = max_by_retriever[retriever_name] or 1.0
        weight = weights.get(retriever_name, 0.05)
        for result in results:
            fused = by_segment.setdefault(
                result.segment_id,
                FusedResult(
                    segment_id=result.segment_id,
                    asset_id=result.asset_id,
                    final_score=0.0,
                    component_scores={},
                    retrievers=[],
                ),
            )
            normalized_score = result.score / max_score
            fused.final_score += weight * normalized_score
            fused.component_scores[retriever_name] = result.score
            if retriever_name not in fused.retrievers:
                fused.retrievers.append(retriever_name)
    return sorted(by_segment.values(), key=lambda item: item.final_score, reverse=True)


class FusionEngine:
    def rrf(self, results_by_retriever: dict[str, list[RetrieverResult]], k: int = 60) -> list[FusedResult]:
        return reciprocal_rank_fusion(results_by_retriever, k=k)
