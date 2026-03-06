from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from sqlalchemy.orm import Session

from app.db import models


def _resolve_upload_root() -> Path:
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


UPLOAD_DIR = _resolve_upload_root()
PRODUCTS_DIR = UPLOAD_DIR / "products"


def _manifest_path(product_id: int) -> Path:
    return PRODUCTS_DIR / str(product_id) / "manifest.json"


def _load_manifest(product_id: int) -> dict[str, Any]:
    path = _manifest_path(product_id)
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}
    return data if isinstance(data, dict) else {}


def _normalize_int(value: Any) -> int | None:
    if value in (None, ""):
        return None
    try:
        return int(value)
    except Exception:
        return None


def _ordered_manifest_items(manifest: dict[str, Any]) -> list[dict[str, Any]]:
    order = manifest.get("order")
    items = manifest.get("items")

    if isinstance(order, list) and isinstance(items, dict):
        ordered: list[dict[str, Any]] = []
        seen: set[str] = set()

        for media_id in order:
            key = str(media_id)
            meta = items.get(key)
            if isinstance(meta, dict):
                ordered.append(meta)
                seen.add(key)

        for key, meta in items.items():
            skey = str(key)
            if skey in seen:
                continue
            if isinstance(meta, dict):
                ordered.append(meta)
        return ordered

    legacy_images = manifest.get("images")
    if isinstance(legacy_images, list):
        return [x for x in legacy_images if isinstance(x, dict)]

    return []


def sync_manifest_to_product_media(db: Session, product_id: int) -> dict[str, int]:
    manifest = _load_manifest(product_id)
    manifest_items = _ordered_manifest_items(manifest)

    existing_rows = (
        db.query(models.ProductMedia)
        .filter(models.ProductMedia.product_id == int(product_id))
        .all()
    )
    by_filename = {str(row.filename): row for row in existing_rows}

    inserted = 0
    for position, item in enumerate(manifest_items):
        filename = str(item.get("filename") or item.get("file") or "").strip()
        if not filename:
            continue

        mime = str(item.get("mime") or "").strip() or None
        size = _normalize_int(item.get("size"))

        row = by_filename.get(filename)
        if row is None:
            row = models.ProductMedia(
                product_id=int(product_id),
                filename=filename,
                mime=mime,
                size=size,
                position=position,
            )
            db.add(row)
            by_filename[filename] = row
            inserted += 1
        else:
            row.position = position
            row.mime = mime
            row.size = size

    if inserted or manifest_items:
        db.commit()

    return {
        "product_id": int(product_id),
        "manifest_items": len(manifest_items),
        "inserted": inserted,
    }
