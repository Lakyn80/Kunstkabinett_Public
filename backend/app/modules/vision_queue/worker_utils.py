from __future__ import annotations

import asyncio
import hashlib
import os
from pathlib import Path
from typing import Any

from app.modules.ai.art.service import describe_art_image


def resolve_upload_root() -> Path:
    candidates: list[Path] = []
    env_dir = os.getenv("UPLOAD_DIR")
    if env_dir:
        candidates.append(Path(env_dir))
    candidates.append(Path("/app/uploads"))
    candidates.append(Path("/var/www/kunst/uploads"))
    candidates.append(Path(os.getcwd()) / "uploads")

    for path in candidates:
        try:
            path.mkdir(parents=True, exist_ok=True)
            return path
        except Exception:
            continue

    fallback = Path("./uploads")
    fallback.mkdir(parents=True, exist_ok=True)
    return fallback


def build_product_media_image_path(product_id: int, filename: str) -> Path:
    root = resolve_upload_root()
    safe_name = str(filename or "").strip().replace("\\", "/").split("/")[-1]
    return (root / "products" / str(int(product_id)) / safe_name).resolve()


def read_product_media_image_bytes(product_id: int, filename: str) -> bytes:
    path = build_product_media_image_path(product_id=product_id, filename=filename)
    data = path.read_bytes()
    if not data:
        raise ValueError(f"Image file is empty: {path}")
    return data


def compute_image_hash(image_bytes: bytes) -> str:
    digest = hashlib.sha256()
    digest.update(image_bytes or b"")
    return digest.hexdigest()


def _guess_mime_from_filename(filename: str) -> str:
    lower = str(filename or "").strip().lower()
    if lower.endswith(".jpg") or lower.endswith(".jpeg"):
        return "image/jpeg"
    if lower.endswith(".png"):
        return "image/png"
    if lower.endswith(".webp"):
        return "image/webp"
    if lower.endswith(".avif"):
        return "image/avif"
    if lower.endswith(".gif"):
        return "image/gif"
    return "image/webp"


def generate_vision_description(image_bytes: bytes, *, filename: str | None = None) -> dict[str, Any]:
    mime_type = _guess_mime_from_filename(filename or "")
    result = asyncio.run(
        describe_art_image(
            image_bytes=image_bytes,
            mime_type=mime_type,
            art_type="auto",
            save_to_rag=False,
        )
    )
    description = str((result or {}).get("description") or "").strip()
    vision_json = dict(result or {})
    return {
        "description": description,
        "vision_json": vision_json,
    }
