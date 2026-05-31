from sqlalchemy.orm import Session

from app.db import crud
from app.schemas.asset import AssetCreate, SegmentCreate
from app.schemas.evidence import EvidenceItemCreate
from app.search.composer import AnswerComposer
from app.search.fusion import FusedResult
from app.search.query_planner import QueryPlanner
from app.search.validator import EvidenceValidator


def test_composer_output_has_matched_evidence_and_explanation(db_session: Session):
    crud.create_asset(
        db_session,
        AssetCreate(asset_id="asset_compose", asset_type="image", original_path="image.jpg"),
    )
    segment = crud.create_segment(
        db_session,
        SegmentCreate(
            segment_id="asset_compose_image_0",
            asset_id="asset_compose",
            segment_type="image",
            caption_en="person near motorbike",
            ocr_text="coffee sign",
            objects=["person", "motorbike"],
        ),
    )
    evidence = crud.create_evidence_item(
        db_session,
        EvidenceItemCreate(
            evidence_id="asset_compose_image_0_caption",
            segment_id=segment.segment_id,
            evidence_type="caption",
            content="person near motorbike",
            confidence=0.8,
        ),
    )
    plan = QueryPlanner().plan("Find image with person near motorbike and sign")
    validation = EvidenceValidator().validate(plan, segment, [evidence])

    result = AnswerComposer().compose(
        plan,
        FusedResult(
            segment_id=segment.segment_id,
            asset_id=segment.asset_id,
            final_score=0.42,
            component_scores={"text_sparse": 2.0},
            retrievers=["text_sparse"],
        ),
        segment,
        [evidence],
        validation,
    )

    assert result.matched_evidence.caption == "person near motorbike"
    assert result.matched_evidence.ocr == "coffee sign"
    assert result.matched_evidence.objects == ["person", "motorbike"]
    assert result.validation.validation_score > 0
    assert result.explanation


def test_composer_explanation_reports_missing_evidence(db_session: Session):
    crud.create_asset(
        db_session,
        AssetCreate(asset_id="asset_missing", asset_type="image", original_path="image.jpg"),
    )
    segment = crud.create_segment(
        db_session,
        SegmentCreate(
            segment_id="asset_missing_image_0",
            asset_id="asset_missing",
            segment_type="image",
            caption_en="street photo",
        ),
    )
    plan = QueryPlanner().plan("Find image with OCR sign text")
    validation = EvidenceValidator().validate(plan, segment, [])

    result = AnswerComposer().compose(
        plan,
        FusedResult(segment_id=segment.segment_id, asset_id=segment.asset_id, final_score=0.1),
        segment,
        [],
        validation,
    )

    assert "ocr_condition" in result.validation.missing
    assert "OCR" in result.explanation
