from __future__ import annotations

from app.db.models import EvidenceItem, Segment
from app.schemas.search import ValidationChecks, ValidationResult
from app.search.query_planner import QueryPlan


class EvidenceValidator:
    def validate(
        self,
        query_plan: QueryPlan,
        segment: Segment,
        evidence_items: list[EvidenceItem],
    ) -> ValidationResult:
        evidence_by_type = {item.evidence_type for item in evidence_items}
        checks = ValidationChecks(
            visual_condition_met=self._has_visual_evidence(segment, evidence_by_type),
            ocr_condition_met=self._has_ocr_evidence(segment, evidence_by_type),
            audio_condition_met=self._has_audio_evidence(segment, evidence_by_type),
            text_condition_met=self._has_text_evidence(segment, evidence_by_type),
            temporal_condition_met=self._has_temporal_evidence(query_plan, segment),
        )
        required_conditions = self._required_conditions(query_plan)
        missing = [
            condition
            for condition in required_conditions
            if not getattr(checks, f"{condition}_met")
        ]
        passed = len(required_conditions) - len(missing)
        validation_score = passed / len(required_conditions) if required_conditions else 1.0
        return ValidationResult(
            checks=checks,
            missing=missing,
            validation_score=round(validation_score, 4),
        )

    def _required_conditions(self, query_plan: QueryPlan) -> list[str]:
        modalities = set(query_plan.target_modalities)
        required: list[str] = []
        if "visual" in modalities:
            required.append("visual_condition")
        if "ocr" in modalities:
            required.append("ocr_condition")
        if "audio" in modalities:
            required.append("audio_condition")
        if "text" in modalities or query_plan.intent == "document_qa":
            required.append("text_condition")
        if "temporal" in modalities:
            required.append("temporal_condition")
        return required or ["text_condition"]

    def _has_visual_evidence(self, segment: Segment, evidence_by_type: set[str]) -> bool:
        return bool(
            segment.representative_frame_path
            or segment.caption_vi
            or segment.caption_en
            or segment.objects
            or "caption" in evidence_by_type
        )

    def _has_ocr_evidence(self, segment: Segment, evidence_by_type: set[str]) -> bool:
        return bool(segment.ocr_text or "ocr" in evidence_by_type)

    def _has_audio_evidence(self, segment: Segment, evidence_by_type: set[str]) -> bool:
        return bool(segment.transcript or segment.audio_events or "transcript" in evidence_by_type)

    def _has_text_evidence(self, segment: Segment, evidence_by_type: set[str]) -> bool:
        return bool(
            segment.transcript
            or segment.caption_vi
            or segment.caption_en
            or "text_chunk" in evidence_by_type
            or "caption" in evidence_by_type
        )

    def _has_temporal_evidence(self, query_plan: QueryPlan, segment: Segment) -> bool:
        if "temporal" not in set(query_plan.target_modalities):
            return True
        return segment.start_time is not None or segment.end_time is not None
