from sqlalchemy import inspect
from sqlalchemy.orm import Session

from app.db.models import Base


def test_required_tables_and_columns_exist(db_session: Session):
    inspector = inspect(db_session.bind)

    assert set(inspector.get_table_names()) == {
        "assets",
        "segments",
        "evidence_items",
        "search_logs",
    }

    columns_by_table = {
        table: {column["name"] for column in inspector.get_columns(table)}
        for table in inspector.get_table_names()
    }

    assert {
        "asset_id",
        "asset_type",
        "original_path",
        "media_path",
        "duration_seconds",
        "width",
        "height",
        "fps",
        "language_hint",
        "source",
        "created_at",
        "metadata",
    }.issubset(columns_by_table["assets"])
    assert "metadata_json" not in columns_by_table["assets"]
    assert "metadata" in Base.metadata.tables["assets"].columns

    assert {
        "segment_id",
        "asset_id",
        "segment_type",
        "start_time",
        "end_time",
        "representative_frame_path",
        "caption_vi",
        "caption_en",
        "transcript",
        "ocr_text",
        "objects",
        "audio_events",
        "metadata",
        "created_at",
    }.issubset(columns_by_table["segments"])

    assert {
        "evidence_id",
        "segment_id",
        "evidence_type",
        "content",
        "confidence",
        "bbox",
        "timestamp_start",
        "timestamp_end",
        "model_name",
        "created_at",
    }.issubset(columns_by_table["evidence_items"])

    assert {
        "search_id",
        "query",
        "parsed_query",
        "retriever_outputs",
        "final_results",
        "latency_ms",
        "mode",
        "created_at",
    }.issubset(columns_by_table["search_logs"])
