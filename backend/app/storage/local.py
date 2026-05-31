from pathlib import Path, PurePath
from re import sub
from shutil import copyfileobj
from uuid import uuid4

from fastapi import UploadFile


IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
VIDEO_EXTENSIONS = {".mp4", ".avi", ".mov", ".mkv", ".webm"}
AUDIO_EXTENSIONS = {".wav", ".mp3", ".m4a", ".flac", ".ogg"}
TEXT_EXTENSIONS = {".txt", ".json", ".csv", ".md", ".pdf", ".docx"}


class UnsafeFilenameError(ValueError):
    pass


class UnsupportedAssetTypeError(ValueError):
    pass


def detect_asset_type(filename: str) -> str:
    extension = Path(filename).suffix.lower()
    if extension in IMAGE_EXTENSIONS:
        return "image"
    if extension in VIDEO_EXTENSIONS:
        return "video"
    if extension in AUDIO_EXTENSIONS:
        return "audio"
    if extension in TEXT_EXTENSIONS:
        return "text"
    raise UnsupportedAssetTypeError(f"Unsupported file extension: {extension or '<none>'}")


def sanitize_filename(filename: str | None) -> str:
    if not filename or not filename.strip():
        return f"upload-{uuid4().hex}.bin"

    raw_name = filename.strip()
    pure = PurePath(raw_name)
    if (
        ".." in pure.parts
        or "/" in raw_name
        or "\\" in raw_name
        or Path(raw_name).is_absolute()
    ):
        raise UnsafeFilenameError("Filename must not contain path components")

    safe_name = sub(r"[^A-Za-z0-9._-]+", "_", raw_name).strip("._")
    if not safe_name:
        return f"upload-{uuid4().hex}.bin"
    return safe_name


class LocalStorage:
    def __init__(self, root: Path | str) -> None:
        self.root = Path(root)

    @property
    def resolved_root(self) -> Path:
        return self.root.resolve(strict=False)

    def save_upload(self, *, asset_id: str, upload_file: UploadFile, safe_filename: str) -> str:
        asset_dir = self._safe_join(asset_id)
        asset_dir.mkdir(parents=True, exist_ok=True)
        destination = (asset_dir / safe_filename).resolve(strict=False)
        self._ensure_inside_root(destination)

        with destination.open("wb") as output:
            copyfileobj(upload_file.file, output)

        return str(Path(asset_id) / safe_filename).replace("\\", "/")

    def resolve_media_path(self, media_path: str) -> Path:
        relative = PurePath(media_path)
        if (
            not media_path
            or ".." in relative.parts
            or Path(media_path).is_absolute()
        ):
            raise UnsafeFilenameError("Stored media path is unsafe")

        resolved = (self.resolved_root / Path(media_path)).resolve(strict=False)
        self._ensure_inside_root(resolved)
        return resolved

    def _safe_join(self, *parts: str) -> Path:
        resolved = self.resolved_root.joinpath(*parts).resolve(strict=False)
        self._ensure_inside_root(resolved)
        return resolved

    def _ensure_inside_root(self, path: Path) -> None:
        root = self.resolved_root
        try:
            path.relative_to(root)
        except ValueError as exc:
            raise UnsafeFilenameError("Resolved path escapes storage root") from exc
