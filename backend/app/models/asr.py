from dataclasses import dataclass, field
from pathlib import Path
from re import sub


@dataclass(frozen=True)
class ASRResult:
    text: str
    language: str | None = None
    confidence: float = 0.45
    segments: list[dict] = field(default_factory=list)
    model_name: str = "mock_asr"


class ASRModel:
    def transcribe(self, audio_path: str) -> ASRResult:
        filename = Path(audio_path).name
        stem = Path(audio_path).stem
        readable = sub(r"[_-]+", " ", stem)
        readable = sub(r"[^0-9A-Za-zÀ-ỹ ]+", " ", readable).strip()
        suffix = f" containing {readable}" if readable else ""
        return ASRResult(
            text=f"Mock transcript for audio file {filename}{suffix}",
            language=None,
            confidence=0.45,
            segments=[],
        )
