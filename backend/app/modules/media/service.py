from __future__ import annotations

import json
import os
from datetime import datetime, timezone
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
        return {"order": [], "items": {}}
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {"order": [], "items": {}}

    if not isinstance(raw, dict):
        return {"order": [], "items": {}}
    if not isinstance(raw.get("order"), list):
        raw["order"] = []
    if not isinstance(raw.get("items"), dict):
        raw["items"] = {}
    return raw


def _save_manifest(product_id: int, data: dict[str, Any]) -> None:
    path = _manifest_path(product_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def _parse_dt(value: Any) -> datetime | None:
    raw = str(value or "").strip()
    if not raw:
        return None
    raw = raw.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(raw)
    except Exception:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _normalize_filter_dt(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _gather_entries(db: Session) -> list[dict[str, Any]]:
    products = db.query(models.Product).all()
    category_ids = {int(p.category_id) for p in products if p.category_id is not None}
    artist_ids = {int(p.artist_id) for p in products if p.artist_id is not None}

    categories = {
        int(c.id): str(c.name or "")
        for c in db.query(models.Category).filter(models.Category.id.in_(category_ids)).all()
    } if category_ids else {}
    artists = {
        int(a.id): str(a.name or "")
        for a in db.query(models.Artist).filter(models.Artist.id.in_(artist_ids)).all()
    } if artist_ids else {}

    entries: list[dict[str, Any]] = []

    for product in products:
        manifest = _load_manifest(int(product.id))
        order = [str(x) for x in list(manifest.get("order") or [])]
        items = manifest.get("items") if isinstance(manifest.get("items"), dict) else {}
        if not isinstance(items, dict):
            items = {}

        media_ids = [mid for mid in order if mid in items]
        for mid in items.keys():
            smid = str(mid)
            if smid not in media_ids:
                media_ids.append(smid)

        for media_id in media_ids:
            meta = items.get(media_id) if isinstance(items.get(media_id), dict) else {}
            filename = str(meta.get("filename") or "").strip()
            if not filename:
                continue

            kind = str(meta.get("kind") or "").strip().lower() or "file"
            mime = str(meta.get("mime") or "").strip().lower() or None
            size_raw = meta.get("size")
            try:
                size = int(size_raw) if size_raw is not None else None
            except Exception:
                size = None

            created_at = _parse_dt(meta.get("created_at"))
            path = PRODUCTS_DIR / str(product.id) / filename
            has_file = path.exists() and path.is_file()
            url = str(meta.get("url") or "").strip() or f"/uploads/products/{product.id}/{filename}"

            entries.append(
                {
                    "media_id": str(media_id),
                    "product_id": int(product.id),
                    "product_title": str(product.title or ""),
                    "product_slug": str(product.slug or ""),
                    "category_id": int(product.category_id) if product.category_id is not None else None,
                    "category_name": categories.get(int(product.category_id)) if product.category_id is not None else None,
                    "artist_id": int(product.artist_id) if product.artist_id is not None else None,
                    "artist_name": artists.get(int(product.artist_id)) if product.artist_id is not None else None,
                    "filename": filename,
                    "kind": kind,
                    "mime": mime,
                    "size": size,
                    "url": url,
                    "created_at": created_at,
                    "has_file": has_file,
                }
            )

    return entries


def _apply_filters(
    entries: list[dict[str, Any]],
    *,
    q: str | None = None,
    product_id: int | None = None,
    category_id: int | None = None,
    artist_id: int | None = None,
    kind: str | None = None,
    mime_prefix: str | None = None,
    created_from: datetime | None = None,
    created_to: datetime | None = None,
    has_file: bool | None = None,
) -> list[dict[str, Any]]:
    q_lower = str(q or "").strip().lower()
    kind_lower = str(kind or "").strip().lower()
    mime_prefix_lower = str(mime_prefix or "").strip().lower()
    created_from_dt = _normalize_filter_dt(created_from)
    created_to_dt = _normalize_filter_dt(created_to)

    out: list[dict[str, Any]] = []
    for item in entries:
        if product_id is not None and item["product_id"] != int(product_id):
            continue
        if category_id is not None and item.get("category_id") != int(category_id):
            continue
        if artist_id is not None and item.get("artist_id") != int(artist_id):
            continue
        if kind_lower and str(item.get("kind") or "").lower() != kind_lower:
            continue
        if mime_prefix_lower and not str(item.get("mime") or "").lower().startswith(mime_prefix_lower):
            continue
        if has_file is not None and bool(item.get("has_file")) is not bool(has_file):
            continue

        item_created = item.get("created_at")
        if created_from_dt is not None:
            if not isinstance(item_created, datetime) or item_created < created_from_dt:
                continue
        if created_to_dt is not None:
            if not isinstance(item_created, datetime) or item_created > created_to_dt:
                continue

        if q_lower:
            hay = " ".join(
                [
                    str(item.get("filename") or ""),
                    str(item.get("product_title") or ""),
                    str(item.get("product_slug") or ""),
                    str(item.get("artist_name") or ""),
                    str(item.get("category_name") or ""),
                ]
            ).lower()
            if q_lower not in hay:
                continue

        out.append(item)

    return out


def _sort_entries(entries: list[dict[str, Any]], *, sort_by: str, sort_dir: str) -> list[dict[str, Any]]:
    field = (sort_by or "created_at").strip().lower()
    direction = (sort_dir or "desc").strip().lower()
    reverse = direction != "asc"

    def _key(item: dict[str, Any]):
        if field == "filename":
            return str(item.get("filename") or "").lower()
        if field == "product_title":
            return str(item.get("product_title") or "").lower()
        if field == "product_id":
            return int(item.get("product_id") or 0)
        if field == "size":
            return int(item.get("size") or 0)
        if field == "kind":
            return str(item.get("kind") or "").lower()
        if field == "mime":
            return str(item.get("mime") or "").lower()
        dt = item.get("created_at")
        if isinstance(dt, datetime):
            return dt
        return datetime.min.replace(tzinfo=timezone.utc)

    return sorted(entries, key=_key, reverse=reverse)


def list_media(
    db: Session,
    *,
    q: str | None = None,
    product_id: int | None = None,
    category_id: int | None = None,
    artist_id: int | None = None,
    kind: str | None = None,
    mime_prefix: str | None = None,
    created_from: datetime | None = None,
    created_to: datetime | None = None,
    has_file: bool | None = None,
    limit: int = 50,
    offset: int = 0,
    sort_by: str = "created_at",
    sort_dir: str = "desc",
) -> dict[str, Any]:
    entries = _gather_entries(db)
    filtered = _apply_filters(
        entries,
        q=q,
        product_id=product_id,
        category_id=category_id,
        artist_id=artist_id,
        kind=kind,
        mime_prefix=mime_prefix,
        created_from=created_from,
        created_to=created_to,
        has_file=has_file,
    )
    sorted_items = _sort_entries(filtered, sort_by=sort_by, sort_dir=sort_dir)
    total = len(sorted_items)
    sliced = sorted_items[max(0, int(offset)): max(0, int(offset)) + max(1, int(limit))]
    return {
        "total": total,
        "limit": max(1, int(limit)),
        "offset": max(0, int(offset)),
        "items": sliced,
    }


def get_media_filters(db: Session) -> dict[str, Any]:
    entries = _gather_entries(db)

    products_map: dict[int, dict[str, Any]] = {}
    categories_map: dict[int, str] = {}
    artists_map: dict[int, str] = {}
    kinds: set[str] = set()
    mime_prefixes: set[str] = set()

    for item in entries:
        product_id = int(item.get("product_id") or 0)
        if product_id > 0:
            products_map[product_id] = {
                "id": product_id,
                "title": str(item.get("product_title") or ""),
                "slug": str(item.get("product_slug") or ""),
            }

        category_id = item.get("category_id")
        if category_id is not None:
            categories_map[int(category_id)] = str(item.get("category_name") or "")

        artist_id = item.get("artist_id")
        if artist_id is not None:
            artists_map[int(artist_id)] = str(item.get("artist_name") or "")

        kind = str(item.get("kind") or "").strip().lower()
        if kind:
            kinds.add(kind)

        mime = str(item.get("mime") or "").strip().lower()
        if "/" in mime:
            mime_prefixes.add(mime.split("/", 1)[0] + "/")

    products = sorted(products_map.values(), key=lambda x: (str(x["title"]).lower(), int(x["id"])))
    categories = sorted(
        [{"id": cid, "name": name} for cid, name in categories_map.items()],
        key=lambda x: (str(x["name"]).lower(), int(x["id"])),
    )
    artists = sorted(
        [{"id": aid, "name": name} for aid, name in artists_map.items()],
        key=lambda x: (str(x["name"]).lower(), int(x["id"])),
    )

    return {
        "products": products,
        "categories": categories,
        "artists": artists,
        "kinds": sorted(kinds),
        "mime_prefixes": sorted(mime_prefixes),
    }


def delete_media(db: Session, media_id: str) -> dict[str, Any] | None:
    media_id_str = str(media_id or "").strip()
    if not media_id_str:
        return None

    products = db.query(models.Product).all()
    for product in products:
        manifest = _load_manifest(int(product.id))
        items = manifest.get("items") if isinstance(manifest.get("items"), dict) else {}
        if not isinstance(items, dict):
            continue
        if media_id_str not in items:
            continue

        meta = items.get(media_id_str) if isinstance(items.get(media_id_str), dict) else {}
        filename = str(meta.get("filename") or "").strip()
        if filename:
            file_path = PRODUCTS_DIR / str(product.id) / filename
            try:
                if file_path.exists():
                    file_path.unlink()
            except Exception:
                pass

        items.pop(media_id_str, None)
        order = [str(x) for x in list(manifest.get("order") or []) if str(x) != media_id_str]
        manifest["items"] = items
        manifest["order"] = order
        _save_manifest(int(product.id), manifest)

        return {
            "message": "Médium bylo úspěšně smazáno.",
            "media_id": media_id_str,
            "product_id": int(product.id),
        }

    return None
