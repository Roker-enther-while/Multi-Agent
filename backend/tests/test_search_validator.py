from sqlalchemy.orm import Session

from app.db import crud
from app.schemas.asset import AssetCreate, SegmentCreate
from app.schemas.evidence import EvidenceItemCreate
from app.search.query_planner import QueryPlanner
from app.search.validator import EvidenceValidator


def test_validator_visual_condition_passes_with_caption(db_session: Session):
    segment = _create_segment(
        db_session,
        asset_id="asset_visual",
        asset_type="image",
        segment_id="asset_visual_image_0",
        segment_type="image",
        caption_en="person in red shirt",
    )
    plan = QueryPlanner().plan("Find a person in red shirt")

    validation = EvidenceValidator().validate(plan, segment, [])

    assert validation.checks.visual_condition_met is True
    assert "visual_condition" not in validation.missing


def test_validator_reports_missing_ocr_when_required(db_session: Session):
    segment = _create_segment(
        db_session,
        asset_id="asset_ocr",
        asset_type="image",
        segment_id="asset_ocr_image_0",
        segment_type="image",
        caption_en="street photo",
    )
    plan = QueryPlanner().plan("Find image with OCR sign text")

    validation = EvidenceValidator().validate(plan, segment, [])

    assert validation.checks.ocr_condition_met is False
    assert "ocr_condition" in validation.missing
    assert validation.validation_score < 1.0


def test_validator_audio_condition_passes_with_transcript(db_session: Session):
    segment = _create_segment(
        db_session,
        asset_id="asset_audio",
        asset_type="audio",
        segment_id="asset_audio_audio_0",
        segment_type="audio",
        transcript="mock transcript with horn sound",
    )
    plan = QueryPlanner().plan("Find audio with horn sound")

    validation = EvidenceValidator().validate(plan, segment, [])

    assert validation.checks.audio_condition_met is True
    assert "audio_condition" not in validation.missing


def test_validator_text_chunk_condition_passes_with_evidence(db_session: Session):
    segment = _create_segment(
        db_session,
        asset_id="asset_text",
        asset_type="text",
        segment_id="asset_text_text_0",
        segment_type="text_chunk",
    )
    evidence = crud.create_evidence_item(
        db_session,
        EvidenceItemCreate(
            evidence_id="asset_text_text_0_text_chunk",
            segment_id=segment.segment_id,
            evidence_type="text_chunk",
            content="quarterly revenue increased",
            confidence=1.0,
        ),
    )
    plan = QueryPlanner().plan("Find content in document about revenue")

    validation = EvidenceValidator().validate(plan, segment, [evidence])

    assert validation.checks.text_condition_met is True
    assert "text_condition" not in validation.missing


def test_validator_temporal_condition_required(db_session: Session):
    segment = _create_segment(
        db_session,
        asset_id="asset_temporal",
        asset_type="video",
        segment_id="asset_temporal_frame_0",
        segment_type="video_frame",
        caption_en="person standing",
    )
    plan = QueryPlanner().plan("Find person standing then horn sound")

    validation = EvidenceValidator().validate(plan, segment, [])

    assert validation.checks.temporal_condition_met is False
    assert "temporal_condition" in validation.missing


def _create_segment(
    db_session: Session,
    *,
    asset_id: str,
    asset_type: str,
    segment_id: str,
    segment_type: str,
    caption_en: str | None = None,
    transcript: str | None = None,
):
    crud.create_asset(
        db_session,
        AssetCreate(asset_id=asset_id, asset_type=asset_type, original_path=f"{asset_id}.dat"),
    )
    return crud.create_segment(
        db_session,
        SegmentCreate(
            segment_id=segment_id,
            asset_id=asset_id,
            segment_type=segment_type,
            caption_en=caption_en,
            transcript=transcript,
        ),
    )
