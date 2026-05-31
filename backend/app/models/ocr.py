from dataclasses import dataclass
from pathlib import Path
from re import sub


@dataclass(frozen=True)
class OCRResult:
    text: str
    confidence: float
    model_name: str = "mock-ocr"


class OCRModel:
    def extract_text(self, image_path: str) -> OCRResult:
        stem = Path(image_path).stem
        text = sub(r"[_-]+", " ", stem)
        text = sub(r"[^0-9A-Za-zÀ-ỹ ]+", " ", text)
        text = " ".join(part for part in text.split() if not part.lower().startswith("image"))
        confidence = 0.35 if text else 0.0
        return OCRResult(text=text, confidence=confidence)
