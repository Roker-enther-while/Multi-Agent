from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Asset, EvidenceItem, SearchLog, Segment
from app.schemas.asset import AssetCreate, SegmentCreate
from app.schemas.evidence import EvidenceItemCreate
from app.schemas.search import SearchLogCreate


def create_asset(db: Session, asset_in: AssetCreate) -> Asset:
    asset = Asset(**asset_in.model_dump(by_alias=False))
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset


def get_asset(db: Session, asset_id: str) -> Asset | None:
    return db.get(Asset, asset_id)


def get_asset_by_id(db: Session, asset_id: str) -> Asset | None:
    return get_asset(db, asset_id)


def list_assets(
    db: Session,
    *,
    asset_type: str | None = None,
    offset: int = 0,
    limit: int = 100,
) -> list[Asset]:
    stmt = select(Asset)
    if asset_type:
        stmt = stmt.where(Asset.asset_type == asset_type)
    stmt = stmt.order_by(Asset.created_at.desc(), Asset.asset_id).offset(offset).limit(limit)
    return list(db.scalars(stmt))


def update_asset_size(
    db: Session,
    asset: Asset,
    *,
    width: int | None = None,
    height: int | None = None,
) -> Asset:
    if width is not None:
        asset.width = width
    if height is not None:
        asset.height = height
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset


def update_asset_media_metadata(
    db: Session,
    asset: Asset,
    *,
    duration_seconds: float | None = None,
    fps: float | None = None,
    width: int | None = None,
    height: int | None = None,
) -> Asset:
    if duration_seconds is not None:
        asset.duration_seconds = duration_seconds
    if fps is not None:
        asset.fps = fps
    if width is not None:
        asset.width = width
    if height is not None:
        asset.height = height
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset


def create_segment(db: Session, segment_in: SegmentCreate) -> Segment:
    segment = Segment(**segment_in.model_dump(by_alias=False))
    db.add(segment)
    db.commit()
    db.refresh(segment)
    return segment


def get_segment(db: Session, segment_id: str) -> Segment | None:
    return db.get(Segment, segment_id)


def get_segments_by_ids(db: Session, segment_ids: list[str]) -> list[Segment]:
    if not segment_ids:
        return []
    stmt = select(Segment).where(Segment.segment_id.in_(segment_ids))
    segments = list(db.scalars(stmt))
    by_id = {segment.segment_id: segment for segment in segments}
    return [by_id[segment_id] for segment_id in segment_ids if segment_id in by_id]


def list_segments_by_asset(
    db: Session,
    asset_id: str,
    *,
    offset: int = 0,
    limit: int = 100,
) -> list[Segment]:
    stmt = (
        select(Segment)
        .where(Segment.asset_id == asset_id)
        .order_by(Segment.start_time.asc().nulls_last(), Segment.segment_id)
        .offset(offset)
        .limit(limit)
    )
    return list(db.scalars(stmt))


def list_image_segments_for_search(
    db: Session,
    *,
    asset_types: list[str] | None = None,
    limit: int = 500,
) -> list[Segment]:
    stmt = select(Segment).join(Asset).where(
        Segment.segment_type.in_(["image", "video_frame", "audio", "text_chunk"])
    )
    if asset_types:
        stmt = stmt.where(Asset.asset_type.in_(asset_types))
    stmt = stmt.order_by(Segment.created_at.desc(), Segment.segment_id).limit(limit)
    return list(db.scalars(stmt))


def list_evidence_for_segments(db: Session, segment_ids: list[str]) -> dict[str, list[EvidenceItem]]:
    if not segment_ids:
        return {}
    stmt = select(EvidenceItem).where(EvidenceItem.segment_id.in_(segment_ids))
    grouped: dict[str, list[EvidenceItem]] = {}
    for item in db.scalars(stmt):
        grouped.setdefault(item.segment_id, []).append(item)
    return grouped


def create_evidence_item(db: Session, evidence_in: EvidenceItemCreate) -> EvidenceItem:
    evidence_item = EvidenceItem(**evidence_in.model_dump())
    db.add(evidence_item)
    db.commit()
    db.refresh(evidence_item)
    return evidence_item


def list_evidence_by_segment(
    db: Session,
    segment_id: str,
    *,
    offset: int = 0,
    limit: int = 100,
) -> list[EvidenceItem]:
    stmt = (
        select(EvidenceItem)
        .where(EvidenceItem.segment_id == segment_id)
        .order_by(EvidenceItem.created_at.asc(), EvidenceItem.evidence_id)
        .offset(offset)
        .limit(limit)
    )
    return list(db.scalars(stmt))


def create_search_log(db: Session, search_log_in: SearchLogCreate) -> SearchLog:
    search_log = SearchLog(**search_log_in.model_dump())
    db.add(search_log)
    db.commit()
    db.refresh(search_log)
    return search_log


def get_search_log(db: Session, search_id: str) -> SearchLog | None:
    return db.get(SearchLog, search_id)
