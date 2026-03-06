from __future__ import annotations

import mimetypes
from pathlib import Path
from typing import Any

from app.modules.ai.art.service import describe_art_image


async def generate_draft_for_inbox_image(
    image_path: str,
    *,
    filename: str | None = None,
    style_hint: str | None = None,
) -> dict[str, Any]:
    path = Path(image_path)
    if not path.exists() or not path.is_file():
        raise ValueError("Image file not found")

    image_bytes = path.read_bytes()
    if not image_bytes:
        raise ValueError("Image file is empty")

    mime_type, _ = mimetypes.guess_type(path.name)
    mime = (mime_type or "image/webp").lower()
    if not mime.startswith("image/"):
        mime = "image/webp"

    result = await describe_art_image(
        image_bytes=image_bytes,
        mime_type=mime,
        art_type="auto",
        style_hint=style_hint,
        save_to_rag=True,
        image_asset_key=str(filename or path.name or "").strip() or None,
    )

    title = str(result.get("title") or "").strip() or (Path(filename or path.name).stem or "Bez názvu")
    description = str(result.get("description") or "").strip()
    tags = list(result.get("tags") or [])
    art_type = str(result.get("art_type") or "other").strip().lower() or "other"

    return {
        "title": title,
        "description": description,
        "product_type": art_type,
        "combined_tags": tags,
        "image_key": str(result.get("image_key") or "").strip() or None,
        "provider_used": str(result.get("provider_used") or "").strip() or "openai_vision",
        "from_cache": bool(result.get("from_cache")),
    }
