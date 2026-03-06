from __future__ import annotations

import os
import re
import uuid
from pathlib import Path

from PIL import Image, ImageOps, UnidentifiedImageError

try:
    from pillow_heif import register_heif_opener  # type: ignore

    register_heif_opener()
except Exception:
    pass


def _resolve_upload_root() -> Path:
    candidates = []
    env_dir = os.getenv("UPLOAD_DIR")
    if env_dir:
        candidates.append(Path(env_dir))
    candidates.append(Path("/app/uploads"))
    candidates.append(Path("/var/www/kunst/uploads"))
    candidates.append(Path(os.getcwd()) / "uploads")

    for p in candidates:
        try:
            p.mkdir(parents=True, exist_ok=True)
            return p
        except Exception:
            continue
    fallback = Path("./uploads")
    fallback.mkdir(parents=True, exist_ok=True)
    return fallback


UPLOAD_DIR = _resolve_upload_root()
INBOX_WEBP_DIR = UPLOAD_DIR / "media_inbox_webp"
DEFAULT_QUALITY = 78
DEFAULT_MAX_WIDTH = 1600


def _safe_stem(stem: str) -> str:
    clean = (stem or "").strip().lower()
    clean = re.sub(r"[^a-z0-9]+", "-", clean).strip("-")
    return clean or "item"


def convert_to_webp(
    input_path: str,
    *,
    quality: int = DEFAULT_QUALITY,
    max_width: int = DEFAULT_MAX_WIDTH,
) -> str:
    src = Path(input_path)
    INBOX_WEBP_DIR.mkdir(parents=True, exist_ok=True)

    base = _safe_stem(src.stem)
    out_path = INBOX_WEBP_DIR / f"{base}-{uuid.uuid4().hex[:10]}.webp"

    try:
        with Image.open(src) as img:
            img = ImageOps.exif_transpose(img)
            if img.mode not in ("RGB", "RGBA"):
                img = img.convert("RGB")
            elif img.mode == "RGBA":
                canvas = Image.new("RGB", img.size, (255, 255, 255))
                canvas.paste(img, mask=img.split()[-1])
                img = canvas

            if max_width and max_width > 0 and img.width > max_width:
                new_height = max(1, int(img.height * (max_width / img.width)))
                img = img.resize((max_width, new_height), Image.Resampling.LANCZOS)

            img.save(
                out_path,
                format="WEBP",
                quality=int(quality),
                method=6,
            )
    except (UnidentifiedImageError, OSError) as exc:
        try:
            src.unlink(missing_ok=True)
        except Exception:
            pass
        raise ValueError("Unsupported or corrupted image file") from exc

    try:
        src.unlink(missing_ok=True)
    except Exception:
        pass
    return str(out_path)

