from __future__ import annotations

from app.db.models import EvidenceItem, Segment
from app.schemas.search import MatchedEvidence, SearchResult, ValidationResult
from app.search.fusion import FusedResult
from app.search.query_planner import QueryPlan


class AnswerComposer:
    def compose(
        self,
        query_plan: QueryPlan,
        fused_result: FusedResult,
        segment: Segment,
        evidence_items: list[EvidenceItem],
        validation: ValidationResult,
    ) -> SearchResult:
        matched_evidence = self._matched_evidence(segment, evidence_items)
        return SearchResult(
            asset_id=segment.asset_id,
            segment_id=segment.segment_id,
            source_type=segment.asset.asset_type,
            score=fused_result.final_score,
            component_scores=fused_result.component_scores,
            preview_image=segment.representative_frame_path,
            timestamp_start=segment.start_time,
            timestamp_end=segment.end_time,
            matched_evidence=matched_evidence,
            validation=validation,
            explanation=self._explain(query_plan, matched_evidence, validation),
        )

    def _matched_evidence(self, segment: Segment, evidence_items: list[EvidenceItem]) -> MatchedEvidence:
        return MatchedEvidence(
            caption=self._first_non_empty(
                segment.caption_en,
                segment.caption_vi,
                self._join_evidence(evidence_items, "caption"),
            ),
            ocr=self._first_non_empty(segment.ocr_text, self._join_evidence(evidence_items, "ocr")),
            transcript=self._first_non_empty(
                segment.transcript,
                self._join_evidence(evidence_items, "transcript"),
            ),
            objects=segment.objects or [],
            audio_events=segment.audio_events or [],
            text=self._first_non_empty(
                self._join_evidence(evidence_items, "text_chunk"),
                segment.transcript if segment.segment_type == "text_chunk" else "",
            ),
        )

    def _explain(
        self,
        query_plan: QueryPlan,
        matched_evidence: MatchedEvidence,
        validation: ValidationResult,
    ) -> str:
        evidence_parts: list[str] = []
        if matched_evidence.caption:
            evidence_parts.append("caption")
        if matched_evidence.ocr:
            evidence_parts.append("OCR")
        if matched_evidence.transcript:
            evidence_parts.append("transcript")
        if matched_evidence.text:
            evidence_parts.append("text evidence")
        if matched_evidence.objects:
            evidence_parts.append("objects")
        if matched_evidence.audio_events:
            evidence_parts.append("audio events")

        if evidence_parts:
            explanation = "Ket qua dua tren bang chung: " + ", ".join(evidence_parts) + "."
        else:
            explanation = "Khong co bang chung manh, ket qua dua tren diem truy xuat."

        if validation.missing:
            missing_text = ", ".join(self._human_missing(item) for item in validation.missing)
            explanation = f"{explanation} Thieu bang chung: {missing_text}."
        elif query_plan.target_modalities:
            explanation = f"{explanation} Cac dieu kien bat buoc co bang chung phu hop."
        return explanation

    def _join_evidence(self, evidence_items: list[EvidenceItem], evidence_type: str) -> str:
        return " ".join(item.content or "" for item in evidence_items if item.evidence_type == evidence_type).strip()

    def _first_non_empty(self, *values: str | None) -> str:
        for value in values:
            if value:
                stripped = value.strip()
                if stripped:
                    return stripped
        return ""

    def _human_missing(self, condition: str) -> str:
        labels = {
            "visual_condition": "visual",
            "ocr_condition": "OCR",
            "audio_condition": "audio",
            "text_condition": "text",
            "temporal_condition": "temporal",
        }
        return labels.get(condition, condition)
