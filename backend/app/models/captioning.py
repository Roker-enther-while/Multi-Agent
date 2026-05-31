from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class CaptionResult:
    caption: str
    confidence: float
    model_name: str = "mock-captioning"


class CaptioningModel:
    def generate_caption(self, image_path: str) -> CaptionResult:
        filename = Path(image_path).name
        return CaptionResult(caption=f"Image file {filename}", confidence=0.5)
