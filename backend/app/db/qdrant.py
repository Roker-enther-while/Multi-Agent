from qdrant_client import QdrantClient
from qdrant_client.models import Distance, FieldCondition, Filter, MatchAny, PointStruct, VectorParams
from uuid import NAMESPACE_URL, uuid5

from app.core.config import get_settings


def get_qdrant_client() -> QdrantClient:
    settings = get_settings()
    return QdrantClient(url=settings.qdrant_url)


def ensure_collection(collection_name: str, vector_size: int, client: QdrantClient | None = None) -> None:
    qdrant = client or get_qdrant_client()
    if not qdrant.collection_exists(collection_name=collection_name):
        qdrant.create_collection(
            collection_name=collection_name,
            vectors_config=VectorParams(size=vector_size, distance=Distance.COSINE),
        )


def upsert_point(
    collection_name: str,
    point_id: str,
    vector: list[float],
    payload: dict,
    client: QdrantClient | None = None,
) -> None:
    qdrant = client or get_qdrant_client()
    qdrant.upsert(
        collection_name=collection_name,
        points=[
            PointStruct(
                id=str(uuid5(NAMESPACE_URL, point_id)),
                vector=vector,
                payload=payload,
            )
        ],
    )


def search(
    collection_name: str,
    vector: list[float],
    top_k: int,
    filters: dict | None = None,
    client: QdrantClient | None = None,
):
    qdrant = client or get_qdrant_client()
    query_filter = _build_filter(filters)
    return qdrant.query_points(
        collection_name=collection_name,
        query=vector,
        limit=top_k,
        query_filter=query_filter,
    )


def _build_filter(filters: dict | None) -> Filter | None:
    if not filters:
        return None
    conditions = []
    asset_types = filters.get("asset_type")
    if asset_types:
        conditions.append(FieldCondition(key="asset_type", match=MatchAny(any=asset_types)))
    if not conditions:
        return None
    return Filter(must=conditions)
