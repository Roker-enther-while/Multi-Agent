from hashlib import sha256
from math import sqrt


class ImageEmbeddingModel:
    def __init__(self, dimension: int = 64) -> None:
        if dimension <= 0:
            raise ValueError("Embedding dimension must be positive")
        self._dimension = dimension

    @property
    def dimension(self) -> int:
        return self._dimension

    def embed_image(self, image_path: str) -> list[float]:
        return self._embed(f"image:{image_path}")

    def embed_text(self, text: str) -> list[float]:
        return self._embed(f"text:{text}")

    def _embed(self, value: str) -> list[float]:
        numbers: list[float] = []
        counter = 0
        while len(numbers) < self.dimension:
            digest = sha256(f"{value}:{counter}".encode("utf-8")).digest()
            numbers.extend((byte / 127.5) - 1.0 for byte in digest)
            counter += 1

        vector = numbers[: self.dimension]
        norm = sqrt(sum(item * item for item in vector)) or 1.0
        return [item / norm for item in vector]


class TextEmbeddingModel(ImageEmbeddingModel):
    def embed_text(self, text: str) -> list[float]:
        return self._embed(f"text:{text}")


EmbeddingModel = ImageEmbeddingModel
