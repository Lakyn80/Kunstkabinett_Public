# app/api/v1/routes_media_upload.py
from __future__ import annotations

import json
import os
import re
import secrets
from datetime import datetime
from io import BytesIO
from pathlib import Path
from typing import Literal, Optional

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, status as http_status
from pydantic import BaseModel
from PIL import Image, ImageOps, UnidentifiedImageError

router = APIRouter(prefix="/media", tags=["media"])


def _resolve_root() -> Path:
    """
    Pick upload root consistent with static mount.
    Preference: env UPLOAD_DIR -> /app/uploads -> /var/www/kunst/uploads -> ./uploads
    """
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


ROOT = _resolve_root()

# Allowed extensions + size limit (.svg disabled to avoid XSS)
ALLOWED_EXT: tuple[str, ...] = (".jpg", ".jpeg", ".png", ".webp", ".avif", ".jfif")
MAX_BYTES = 20 * 1024 * 1024  # 20 MB
BLOG_MAX_SIDE = 1800
BLOG_THUMB_MAX_SIDE = 640
BLOG_MAX_MAIN_BYTES = 900 * 1024

_slug_re = re.compile(r"[^a-z0-9]+")


def _slugify(name: str) -> str:
    base = name.strip().lower()
    base = base.encode("ascii", "ignore").decode("ascii")
    base = _slug_re.sub("-", base).strip("-")
    return base or secrets.token_hex(4)


def _safe_ext(filename: str) -> str:
    _, ext = os.path.splitext(filename or "file")
    return ext.lower()


def _ensure_allowed_ext(ext: str):
    if ext not in ALLOWED_EXT:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail=f"Nepovoleny typ souboru: {ext} (povolene: {', '.join(ALLOWED_EXT)})",
        )


def _target_dir(scope: str, entity_id: Optional[int]) -> Path:
    """
    Target directory selection:
      - artists -> uploads/artists
      - products + entity_id -> uploads/products/{id}
      - blog -> uploads/blog
      - default -> uploads
    """
    s = (scope or "").strip().lower()
    if s == "artists":
        return ROOT / "artists"
    if s == "products" and entity_id:
        return ROOT / "products" / str(entity_id)
    if s == "blog":
        return ROOT / "blog"
    return ROOT


def _write_file(data: bytes, out_dir: Path, original_name: str) -> tuple[str, Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    name_wo_ext = _slugify(os.path.splitext(original_name)[0])
    ext = _safe_ext(original_name)
    _ensure_allowed_ext(ext)
    safe_name = f"{name_wo_ext}-{secrets.token_hex(4)}{ext}"
    out_path = out_dir / safe_name
    out_path.write_bytes(data)
    return safe_name, out_path


def _save_webp_bytes(image: Image.Image, quality: int) -> bytes:
    buf = BytesIO()
    image.save(buf, format="WEBP", quality=quality, method=6)
    return buf.getvalue()


def _convert_blog_image_to_webp_variants(data: bytes) -> tuple[bytes, bytes]:
    try:
        with Image.open(BytesIO(data)) as src:
            img = ImageOps.exif_transpose(src)
            if img.mode not in ("RGB", "RGBA"):
                img = img.convert("RGBA")

            main = img.copy()
            main.thumbnail((BLOG_MAX_SIDE, BLOG_MAX_SIDE), Image.Resampling.LANCZOS)

            main_bytes = None
            for q in (78, 72, 66, 60, 54):
                candidate = _save_webp_bytes(main, q)
                main_bytes = candidate
                if len(candidate) <= BLOG_MAX_MAIN_BYTES:
                    break

            thumb = main.copy()
            thumb.thumbnail((BLOG_THUMB_MAX_SIDE, BLOG_THUMB_MAX_SIDE), Image.Resampling.LANCZOS)
            thumb_bytes = _save_webp_bytes(thumb, 62)

            if not main_bytes:
                raise ValueError("failed_to_create_main_webp")
            return main_bytes, thumb_bytes
    except UnidentifiedImageError:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="Soubor není validní obrázek.",
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail=f"Konverze obrázku selhala: {exc}",
        )


def _write_blog_webp_and_thumb(data: bytes, out_dir: Path, original_name: str) -> tuple[str, Path, str, Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    name_wo_ext = _slugify(os.path.splitext(original_name)[0])
    token = secrets.token_hex(4)
    main_name = f"{name_wo_ext}-{token}.webp"
    thumb_name = f"{name_wo_ext}-{token}-thumb.webp"
    main_path = out_dir / main_name
    thumb_path = out_dir / thumb_name

    main_bytes, thumb_bytes = _convert_blog_image_to_webp_variants(data)
    main_path.write_bytes(main_bytes)
    thumb_path.write_bytes(thumb_bytes)
    return main_name, main_path, thumb_name, thumb_path


def _try_update_manifest_for_product(product_dir: Path, filename: str):
    """
    Non-invasive manifest update for /uploads/products/{id}/manifest.json.

    * If manifest.json is missing -> create {"images":[...]}.
    * If it exists and has "images" list -> append entry.
    * Other formats are left untouched.
    """
    manifest = product_dir / "manifest.json"
    entry = {
        "file": filename,
        "uploaded_at": datetime.utcnow().isoformat() + "Z",
    }

    if not manifest.exists():
        data = {"images": [entry]}
        manifest.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        return

    try:
        obj = json.loads(manifest.read_text(encoding="utf-8") or "{}")
    except Exception:
        return

    images = obj.get("images")
    if isinstance(images, list):
        images.append(entry)
        try:
            manifest.write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding="utf-8")
        except Exception:
            pass


class UploadResponse(BaseModel):
    ok: Literal[True]
    filename: str
    size: int
    url: str
    thumb_url: Optional[str] = None
    scope: str
    entity_id: Optional[int] = None


@router.post("/upload", response_model=UploadResponse)
async def upload_media(
    file: UploadFile = File(..., description="Obrazek / media"),
    scope: str = Form("misc", description="artists|products|blog|misc"),
    entity_id: Optional[int] = Form(None, description="napr. product_id pro products"),
) -> UploadResponse:
    # Validate
    original = file.filename or "file"
    ext = _safe_ext(original)
    _ensure_allowed_ext(ext)

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Soubor je prazdny.")
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="Soubor je prilis velky.")

    # Destination
    dest_dir = _target_dir(scope, entity_id)

    thumb_url = None
    if (scope or "").strip().lower() == "blog":
        filename, out_path, _, thumb_path = _write_blog_webp_and_thumb(data, dest_dir, original)
        rel_url = f"/uploads/{out_path.relative_to(ROOT).as_posix()}"
        thumb_url = f"/uploads/{thumb_path.relative_to(ROOT).as_posix()}"
        size = out_path.stat().st_size
    else:
        # Save
        filename, out_path = _write_file(data, dest_dir, original)
        # Public URL (Vite proxy -> /uploads)
        rel_url = f"/uploads/{out_path.relative_to(ROOT).as_posix()}"
        size = len(data)

    # Products: gently update manifest if meaningful
    if (scope or "").lower() == "products" and entity_id:
        _try_update_manifest_for_product(dest_dir, filename)

    return UploadResponse(
        ok=True,
        filename=filename,
        size=size,
        url=rel_url,
        thumb_url=thumb_url,
        scope=scope,
        entity_id=entity_id,
    )
