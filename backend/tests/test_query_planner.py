from app.search.query_planner import QueryPlanner


def test_vietnamese_visual_query_detects_objects_and_rewrite():
    plan = QueryPlanner().plan("Tìm người mặc áo đỏ đứng cạnh xe máy")

    assert plan.query_language == "vi"
    assert "visual" in plan.target_modalities
    assert "person" in plan.object_filters
    assert "motorbike" in plan.object_filters
    assert "person" in plan.visual_query
    assert "motorbike" in plan.visual_query
    assert "red shirt" in plan.visual_query


def test_ocr_query_detects_ocr_modality():
    plan = QueryPlanner().plan("Tìm ảnh có biển hiệu tiếng Việt")

    assert plan.intent == "image_retrieval"
    assert "ocr" in plan.target_modalities


def test_audio_query_detects_audio_modality():
    plan = QueryPlanner().plan("Tìm đoạn có tiếng còi xe")

    assert plan.intent == "audio_retrieval"
    assert "audio" in plan.target_modalities


def test_temporal_query_adds_constraint():
    plan = QueryPlanner().plan("Tìm cảnh người đứng cạnh xe máy sau đó có tiếng còi")

    assert plan.intent == "video_moment_retrieval"
    assert "temporal" in plan.target_modalities
    assert "audio" in plan.target_modalities
    assert plan.temporal_constraints == [
        {"type": "after", "raw": "Tìm cảnh người đứng cạnh xe máy sau đó có tiếng còi"}
    ]


def test_english_visual_query():
    plan = QueryPlanner().plan("Find a person in a red shirt near a motorbike")

    assert plan.query_language == "en"
    assert "visual" in plan.target_modalities
    assert {"person", "motorbike"}.issubset(set(plan.object_filters))


def test_document_query_detects_document_intent_and_text_modality():
    plan = QueryPlanner().plan("Tìm nội dung trong tài liệu nói về doanh thu")

    assert plan.intent == "document_qa"
    assert "text" in plan.target_modalities


def test_filters_are_copied_to_metadata_filters():
    plan = QueryPlanner().plan("Find text", {"asset_type": ["text"], "source": "local_test"})

    assert plan.metadata_filters == {"asset_type": ["text"], "source": "local_test"}
