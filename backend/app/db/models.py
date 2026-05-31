from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, func, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.types import JSON


class Base(DeclarativeBase):
    pass


json_object_type = JSON().with_variant(JSONB, "postgresql")
json_array_type = JSON().with_variant(JSONB, "postgresql")


class Asset(Base):
    __tablename__ = "assets"

    asset_id: Mapped[str] = mapped_column(Text, primary_key=True)
    asset_type: Mapped[str] = mapped_column(Text, nullable=False)
    original_path: Mapped[str] = mapped_column(Text, nullable=False)
    media_path: Mapped[str | None] = mapped_column(Text)
    duration_seconds: Mapped[float | None] = mapped_column(Float)
    width: Mapped[int | None] = mapped_column(Integer)
    height: Mapped[int | None] = mapped_column(Integer)
    fps: Mapped[float | None] = mapped_column(Float)
    language_hint: Mapped[str | None] = mapped_column(Text)
    source: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    metadata_json: Mapped[dict[str, Any]] = mapped_column(
        "metadata",
        json_object_type,
        nullable=False,
        default=dict,
        server_default=text("'{}'"),
    )

    segments: Mapped[list["Segment"]] = relationship(
        back_populates="asset",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class Segment(Base):
    __tablename__ = "segments"

    segment_id: Mapped[str] = mapped_column(Text, primary_key=True)
    asset_id: Mapped[str] = mapped_column(
        Text,
        ForeignKey("assets.asset_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    segment_type: Mapped[str] = mapped_column(Text, nullable=False)
    start_time: Mapped[float | None] = mapped_column(Float)
    end_time: Mapped[float | None] = mapped_column(Float)
    representative_frame_path: Mapped[str | None] = mapped_column(Text)
    caption_vi: Mapped[str | None] = mapped_column(Text)
    caption_en: Mapped[str | None] = mapped_column(Text)
    transcript: Mapped[str | None] = mapped_column(Text)
    ocr_text: Mapped[str | None] = mapped_column(Text)
    objects: Mapped[list[dict[str, Any]] | list[str]] = mapped_column(
        json_array_type,
        nullable=False,
        default=list,
        server_default=text("'[]'"),
    )
    audio_events: Mapped[list[dict[str, Any]] | list[str]] = mapped_column(
        json_array_type,
        nullable=False,
        default=list,
        server_default=text("'[]'"),
    )
    metadata_json: Mapped[dict[str, Any]] = mapped_column(
        "metadata",
        json_object_type,
        nullable=False,
        default=dict,
        server_default=text("'{}'"),
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    asset: Mapped[Asset] = relationship(back_populates="segments")
    evidence_items: Mapped[list["EvidenceItem"]] = relationship(
        back_populates="segment",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class EvidenceItem(Base):
    __tablename__ = "evidence_items"

    evidence_id: Mapped[str] = mapped_column(Text, primary_key=True)
    segment_id: Mapped[str] = mapped_column(
        Text,
        ForeignKey("segments.segment_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    evidence_type: Mapped[str] = mapped_column(Text, nullable=False)
    content: Mapped[str | None] = mapped_column(Text)
    confidence: Mapped[float | None] = mapped_column(Float)
    bbox: Mapped[dict[str, Any] | list[float] | None] = mapped_column(json_object_type)
    timestamp_start: Mapped[float | None] = mapped_column(Float)
    timestamp_end: Mapped[float | None] = mapped_column(Float)
    model_name: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    segment: Mapped[Segment] = relationship(back_populates="evidence_items")


class SearchLog(Base):
    __tablename__ = "search_logs"

    search_id: Mapped[str] = mapped_column(Text, primary_key=True)
    query: Mapped[str] = mapped_column(Text, nullable=False)
    parsed_query: Mapped[dict[str, Any] | None] = mapped_column(json_object_type)
    retriever_outputs: Mapped[dict[str, Any] | list[Any] | None] = mapped_column(json_object_type)
    final_results: Mapped[dict[str, Any] | list[Any] | None] = mapped_column(json_object_type)
    latency_ms: Mapped[int | None] = mapped_column(Integer)
    mode: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
