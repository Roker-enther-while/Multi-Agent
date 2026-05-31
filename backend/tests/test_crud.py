from sqlalchemy.orm import Session

from app.db import crud
from app.schemas.asset import AssetCreate, AssetRead, SegmentCreate
from app.schemas.evidence import EvidenceItemCreate
from app.schemas.search import SearchLogCreate


def test_create_get_and_list_asset(db_session: Session):
    asset = crud.create_asset(
        db_session,
        AssetCreate(
            asset_id="image_001",
            asset_type="image",
            original_path="/raw/image_001.jpg",
            media_path="/media/image_001.jpg",
            width=1920,
            height=1080,
            metadata={"camera": "test"},
        ),
    )

    assert asset.asset_id == "image_001"
    assert asset.metadata_json == {"camera": "test"}
    assert crud.get_asset(db_session, "image_001") == asset
    assert [item.asset_id for item in crud.list_assets(db_session)] == ["image_001"]

    asset_read = AssetRead.model_validate(asset)
    assert asset_read.model_dump(by_alias=True)["metadata"] == {"camera": "test"}


def test_create_get_and_list_segment_by_asset(db_session: Session):
    crud.create_asset(
        db_session,
        AssetCreate(
            asset_id="video_001",
            asset_type="video",
            original_path="/raw/video_001.mp4",
        ),
    )

    segment = crud.create_segment(
        db_session,
        SegmentCreate(
            segment_id="video_001_scene_001",
            asset_id="video_001",
            segment_type="scene",
            start_time=1.5,
            end_time=4.0,
            caption_vi="Nguoi mac ao do dung gan xe may",
            ocr_text="BIEN HIEU",
            objects=["person", "motorbike"],
            metadata={"keyframe_index": 1},
        ),
    )

    assert segment.segment_id == "video_001_scene_001"
    assert segment.asset_id == "video_001"
    assert segment.objects == ["person", "motorbike"]
    assert crud.get_segment(db_session, "video_001_scene_001") == segment
    assert [item.segment_id for item in crud.list_segments_by_asset(db_session, "video_001")] == [
        "video_001_scene_001"
    ]


def test_create_and_list_evidence_item(db_session: Session):
    crud.create_asset(
        db_session,
        AssetCreate(asset_id="image_002", asset_type="image", original_path="/raw/image_002.jpg"),
    )
    crud.create_segment(
        db_session,
        SegmentCreate(
            segment_id="image_002_full",
            asset_id="image_002",
            segment_type="image",
        ),
    )

    evidence = crud.create_evidence_item(
        db_session,
        EvidenceItemCreate(
            evidence_id="ev_001",
            segment_id="image_002_full",
            evidence_type="ocr",
            content="Cafe Sai Gon",
            confidence=0.91,
            bbox={"x": 10, "y": 12, "w": 100, "h": 32},
            model_name="mock-ocr",
        ),
    )

    assert evidence.evidence_id == "ev_001"
    assert evidence.bbox == {"x": 10, "y": 12, "w": 100, "h": 32}
    assert [item.evidence_id for item in crud.list_evidence_by_segment(db_session, "image_002_full")] == [
        "ev_001"
    ]


def test_create_search_log(db_session: Session):
    search_log = crud.create_search_log(
        db_session,
        SearchLogCreate(
            search_id="search_001",
            query="Tim nguoi ao do",
            parsed_query={"target_modalities": ["visual"]},
            retriever_outputs={"text_sparse": []},
            final_results=[],
            latency_ms=12,
            mode="interactive",
        ),
    )

    assert search_log.search_id == "search_001"
    assert search_log.query == "Tim nguoi ao do"
    assert search_log.parsed_query == {"target_modalities": ["visual"]}
    assert search_log.final_results == []
