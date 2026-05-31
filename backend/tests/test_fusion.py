from app.search.fusion import reciprocal_rank_fusion, weighted_fusion
from app.search.retrievers import RetrieverResult


def rr(segment_id: str, score: float, retriever: str = "text_sparse") -> RetrieverResult:
    return RetrieverResult(
        segment_id=segment_id,
        asset_id=f"asset_{segment_id}",
        score=score,
        retriever=retriever,
        evidence="evidence",
    )


def test_reciprocal_rank_fusion_combines_ranked_results():
    fused = reciprocal_rank_fusion(
        {
            "text_sparse": [rr("a", 0.9), rr("b", 0.8)],
            "ocr": [rr("b", 0.95, "ocr")],
        },
        k=60,
    )

    assert [item.segment_id for item in fused] == ["b", "a"]
    assert fused[0].component_scores == {"text_sparse": 0.8, "ocr": 0.95}
    assert set(fused[0].retrievers) == {"text_sparse", "ocr"}


def test_weighted_fusion_normalizes_per_retriever():
    fused = weighted_fusion(
        {
            "text_sparse": [rr("a", 2.0), rr("b", 1.0)],
            "ocr": [rr("b", 10.0, "ocr")],
        },
        weights={"text_sparse": 0.25, "ocr": 0.75},
    )

    assert fused[0].segment_id == "b"
    assert fused[0].final_score == 0.875
