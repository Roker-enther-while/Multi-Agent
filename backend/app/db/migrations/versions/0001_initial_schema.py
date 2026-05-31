"""initial schema

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-05-30
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0001_initial_schema"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "assets",
        sa.Column("asset_id", sa.Text(), primary_key=True),
        sa.Column("asset_type", sa.Text(), nullable=False),
        sa.Column("original_path", sa.Text(), nullable=False),
        sa.Column("media_path", sa.Text()),
        sa.Column("duration_seconds", sa.Float()),
        sa.Column("width", sa.Integer()),
        sa.Column("height", sa.Integer()),
        sa.Column("fps", sa.Float()),
        sa.Column("language_hint", sa.Text()),
        sa.Column("source", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'")),
    )
    op.create_table(
        "segments",
        sa.Column("segment_id", sa.Text(), primary_key=True),
        sa.Column("asset_id", sa.Text(), sa.ForeignKey("assets.asset_id", ondelete="CASCADE"), nullable=False),
        sa.Column("segment_type", sa.Text(), nullable=False),
        sa.Column("start_time", sa.Float()),
        sa.Column("end_time", sa.Float()),
        sa.Column("representative_frame_path", sa.Text()),
        sa.Column("caption_vi", sa.Text()),
        sa.Column("caption_en", sa.Text()),
        sa.Column("transcript", sa.Text()),
        sa.Column("ocr_text", sa.Text()),
        sa.Column("objects", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'")),
        sa.Column("audio_events", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'")),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_segments_asset_id", "segments", ["asset_id"])
    op.create_table(
        "evidence_items",
        sa.Column("evidence_id", sa.Text(), primary_key=True),
        sa.Column("segment_id", sa.Text(), sa.ForeignKey("segments.segment_id", ondelete="CASCADE"), nullable=False),
        sa.Column("evidence_type", sa.Text(), nullable=False),
        sa.Column("content", sa.Text()),
        sa.Column("confidence", sa.Float()),
        sa.Column("bbox", postgresql.JSONB(astext_type=sa.Text())),
        sa.Column("timestamp_start", sa.Float()),
        sa.Column("timestamp_end", sa.Float()),
        sa.Column("model_name", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_evidence_items_segment_id", "evidence_items", ["segment_id"])
    op.create_table(
        "search_logs",
        sa.Column("search_id", sa.Text(), primary_key=True),
        sa.Column("query", sa.Text(), nullable=False),
        sa.Column("parsed_query", postgresql.JSONB(astext_type=sa.Text())),
        sa.Column("retriever_outputs", postgresql.JSONB(astext_type=sa.Text())),
        sa.Column("final_results", postgresql.JSONB(astext_type=sa.Text())),
        sa.Column("latency_ms", sa.Integer()),
        sa.Column("mode", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("search_logs")
    op.drop_index("ix_evidence_items_segment_id", table_name="evidence_items")
    op.drop_table("evidence_items")
    op.drop_index("ix_segments_asset_id", table_name="segments")
    op.drop_table("segments")
    op.drop_table("assets")
