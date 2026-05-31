from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


Intent = Literal[
    "video_moment_retrieval",
    "image_retrieval",
    "document_qa",
    "audio_retrieval",
    "general_search",
]


class QueryPlan(BaseModel):
    intent: Intent
    query_language: Literal["vi", "en", "unknown"]
    target_modalities: list[str]
    visual_query: str
    text_query: str
    ocr_query: str
    audio_query: str
    object_filters: list[str] = Field(default_factory=list)
    temporal_constraints: list[dict[str, str]] = Field(default_factory=list)
    metadata_filters: dict[str, Any] = Field(default_factory=dict)
    search_strategy: str = "hybrid_multimodal"
    confidence: float = 0.0


class QueryPlanner:
    VI_MARKERS = set("ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ")
    VI_KEYWORDS = {
        "người",
        "xe",
        "xe máy",
        "ô tô",
        "áo",
        "đỏ",
        "xanh",
        "đứng",
        "đi",
        "cảnh",
        "ảnh",
        "hình",
        "âm thanh",
        "tiếng",
        "nói",
        "tài liệu",
        "văn bản",
        "nội dung",
    }
    EN_KEYWORDS = {
        "find",
        "person",
        "car",
        "motorbike",
        "motorcycle",
        "red",
        "blue",
        "shirt",
        "image",
        "video",
        "audio",
        "document",
        "text",
        "speech",
        "sound",
    }

    VISUAL_KEYWORDS = {
        "người",
        "xe",
        "xe máy",
        "ô tô",
        "áo",
        "màu",
        "đỏ",
        "xanh",
        "đứng",
        "đi",
        "chạy",
        "cảnh",
        "vật thể",
        "person",
        "car",
        "motorbike",
        "motorcycle",
        "shirt",
        "red",
        "blue",
        "standing",
        "walking",
        "object",
        "scene",
    }
    OCR_KEYWORDS = {"chữ", "biển hiệu", "bảng hiệu", "logo", "văn bản trong ảnh", "text in image", "sign", "signboard", "ocr"}
    AUDIO_KEYWORDS = {"tiếng", "âm thanh", "còi", "nhạc", "nói", "giọng nói", "speech", "sound", "horn", "music", "voice"}
    TEXT_KEYWORDS = {"văn bản", "tài liệu", "nội dung", "đoạn văn", "document", "text", "paragraph", "file"}
    TEMPORAL_KEYWORDS = {"sau đó", "trước khi", "rồi", "tiếp theo", "trước đó", "afterward", "before", "then", "next", "after"}
    METADATA_KEYWORDS = {"nguồn", "source", "thời gian", "ngày", "location", "địa điểm", "camera"}

    VIDEO_INTENT_KEYWORDS = {"video", "đoạn video", "clip", "timestamp", "cảnh", "frame", "khoảnh khắc", "moment"}
    IMAGE_INTENT_KEYWORDS = {"ảnh", "hình", "image", "photo", "picture"}
    DOCUMENT_INTENT_KEYWORDS = {"tài liệu", "văn bản", "file", "document", "text", "nội dung", "đoạn văn"}
    AUDIO_INTENT_KEYWORDS = {"âm thanh", "audio", "tiếng", "giọng nói", "nói", "speech", "sound", "horn", "music"}

    OBJECT_PATTERNS = {
        "person": {"person", "người"},
        "motorbike": {"motorbike", "motorcycle", "xe máy"},
        "car": {"car", "ô tô", "oto"},
        "signboard": {"signboard", "sign", "biển hiệu", "bảng hiệu"},
        "dog": {"dog", "chó"},
        "cat": {"cat", "mèo"},
    }

    VI_REWRITE_REPLACEMENTS = [
        ("xe máy", "motorbike"),
        ("ô tô", "car"),
        ("áo đỏ", "red shirt"),
        ("áo xanh", "blue shirt"),
        ("biển hiệu", "signboard"),
        ("bảng hiệu", "signboard"),
        ("đi bộ", "walking"),
        ("người", "person"),
        ("chó", "dog"),
        ("mèo", "cat"),
        ("đứng", "standing"),
    ]

    def plan(self, query: str, filters: dict[str, Any] | None = None) -> QueryPlan:
        normalized = self._normalize(query)
        query_language = self._detect_language(normalized)
        intent = self._detect_intent(normalized)
        target_modalities = self._detect_modalities(normalized, intent)
        object_filters = self._detect_objects(normalized)
        temporal_constraints = self._detect_temporal_constraints(normalized, query)
        metadata_filters = dict(filters or {})

        return QueryPlan(
            intent=intent,
            query_language=query_language,
            target_modalities=target_modalities,
            visual_query=self._rewrite_visual_query(query, query_language),
            text_query=query,
            ocr_query=query if "ocr" in target_modalities else "",
            audio_query=query if "audio" in target_modalities else "",
            object_filters=object_filters,
            temporal_constraints=temporal_constraints,
            metadata_filters=metadata_filters,
            confidence=self._confidence(target_modalities, intent),
        )

    def _detect_language(self, normalized: str) -> Literal["vi", "en", "unknown"]:
        if any(char in self.VI_MARKERS for char in normalized) or self._contains_any(normalized, self.VI_KEYWORDS):
            return "vi"
        if self._contains_any(normalized, self.EN_KEYWORDS):
            return "en"
        return "unknown"

    def _detect_intent(self, normalized: str) -> Intent:
        if self._contains_any(normalized, self.VIDEO_INTENT_KEYWORDS):
            return "video_moment_retrieval"
        if self._contains_any(normalized, self.DOCUMENT_INTENT_KEYWORDS):
            return "document_qa"
        if self._contains_any(normalized, self.IMAGE_INTENT_KEYWORDS):
            return "image_retrieval"
        if self._contains_any(normalized, self.AUDIO_INTENT_KEYWORDS):
            return "audio_retrieval"
        return "general_search"

    def _detect_modalities(self, normalized: str, intent: Intent) -> list[str]:
        modalities: list[str] = []
        self._append_if(modalities, "visual", self._contains_any(normalized, self.VISUAL_KEYWORDS))
        self._append_if(modalities, "ocr", self._contains_any(normalized, self.OCR_KEYWORDS))
        self._append_if(modalities, "audio", self._contains_any(normalized, self.AUDIO_KEYWORDS))
        self._append_if(modalities, "text", self._contains_any(normalized, self.TEXT_KEYWORDS))
        self._append_if(modalities, "temporal", self._contains_any(normalized, self.TEMPORAL_KEYWORDS))
        self._append_if(modalities, "metadata", self._contains_any(normalized, self.METADATA_KEYWORDS))

        if intent == "video_moment_retrieval" and not any(item in modalities for item in ["visual", "audio", "text"]):
            modalities.append("visual")
        if intent == "document_qa" and "text" not in modalities:
            modalities.append("text")
        if intent == "audio_retrieval" and "audio" not in modalities:
            modalities.append("audio")
        if not modalities:
            modalities.append("text")
        return modalities

    def _detect_objects(self, normalized: str) -> list[str]:
        objects = []
        for canonical, patterns in self.OBJECT_PATTERNS.items():
            if self._contains_any(normalized, patterns):
                objects.append(canonical)
        return objects

    def _detect_temporal_constraints(self, normalized: str, raw_query: str) -> list[dict[str, str]]:
        constraints = []
        if self._contains_any(normalized, {"sau đó", "after", "afterward", "then", "rồi", "tiếp theo", "next"}):
            constraints.append({"type": "after", "raw": raw_query})
        if self._contains_any(normalized, {"trước khi", "trước đó", "before"}):
            constraints.append({"type": "before", "raw": raw_query})
        return constraints

    def _rewrite_visual_query(self, query: str, query_language: str) -> str:
        if query_language != "vi":
            return query
        rewritten = query.lower()
        for source, target in self.VI_REWRITE_REPLACEMENTS:
            rewritten = rewritten.replace(source, target)
        return rewritten

    def _confidence(self, target_modalities: list[str], intent: Intent) -> float:
        base = 0.45 if intent == "general_search" else 0.6
        return min(base + 0.08 * len(target_modalities), 0.95)

    def _contains_any(self, normalized: str, keywords: set[str]) -> bool:
        return any(keyword.lower() in normalized for keyword in keywords)

    def _append_if(self, modalities: list[str], modality: str, condition: bool) -> None:
        if condition and modality not in modalities:
            modalities.append(modality)

    def _normalize(self, query: str) -> str:
        return " ".join(query.lower().split())
