from __future__ import annotations

import mimetypes
import os
import re
import shutil
import tempfile
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any
import logging

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.deps import get_db, require_admin
from app.db import models
from app.modules.translation_queue.queue import enqueue_translation_jobs
from app.services.translation_helper import seed_product_translations

from .inbox_repository import (
    add_inbox_item,
    claim_pending_item,
    count_pending_items,
    delete_all_items,
    delete_item,
    delete_items,
    get_pending_items,
    mark_item_assigned,
    mark_item_pending,
)
from .openai_async_batch import PreparedInboxItem, generate_inbox_drafts_batch
from .webp_converter import UPLOAD_DIR, convert_to_webp


router = APIRouter(prefix="/api/media-inbox", tags=["media-inbox"], dependencies=[Depends(require_admin)])
logger = logging.getLogger(__name__)

AI_CONCURRENCY = int(os.getenv("MEDIA_INBOX_AI_CONCURRENCY", "2") or "2")
AI_TIMEOUT_SEC = float(os.getenv("MEDIA_INBOX_AI_TIMEOUT_SEC", "90") or "90")


class AssignInboxItem(BaseModel):
    inbox_id: int
    assign_as: str = "product"
    parent_product_id: int | None = None


class AssignInboxRequest(BaseModel):
    items: list[AssignInboxItem]


class DeleteBatchRequest(BaseModel):
    ids: list[int]


def _save_upload_to_temp(upload: UploadFile) -> str:
    suffix = os.path.splitext(upload.filename or "")[1]
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        for chunk in iter(lambda: upload.file.read(1024 * 1024), b""):
            tmp.write(chunk)
        return tmp.name


def _relative_upload_path(abs_path: str) -> str:
    path = Path(abs_path)
    try:
        rel = path.resolve().relative_to(UPLOAD_DIR.resolve())
        return rel.as_posix()
    except Exception:
        return path.name


def _abs_upload_path(path: str) -> Path:
    raw = str(path or "").replace("\\", "/").strip()
    if raw.startswith("/uploads/"):
        raw = raw[len("/uploads/") :]
    raw = raw.lstrip("/")
    return (UPLOAD_DIR / raw).resolve()


def _delete_upload_file(path: str) -> None:
    if not path:
        return
    abs_path = _abs_upload_path(path)
    try:
        abs_path.unlink(missing_ok=True)
    except Exception:
        pass


def _slugify(value: str) -> str:
    raw = (value or "").strip().lower()
    raw = re.sub(r"[^a-z0-9]+", "-", raw).strip("-")
    return raw or "dilo"


def _build_unique_slug(db: Session, title: str) -> str:
    base = _slugify(title)
    slug = base
    idx = 2
    while db.query(models.Product).filter(models.Product.slug == slug).first():
        slug = f"{base}-{idx}"
        idx += 1
    return slug


def _product_media_dir(product_id: int) -> Path:
    path = UPLOAD_DIR / "products" / str(product_id)
    path.mkdir(parents=True, exist_ok=True)
    return path


def _manifest_path(product_id: int) -> Path:
    return _product_media_dir(product_id) / "manifest.json"


def _load_manifest(product_id: int) -> dict[str, Any]:
    path = _manifest_path(product_id)
    if not path.exists():
        return {"order": [], "items": {}}
    try:
        import json

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
    import json

    path = _manifest_path(product_id)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def _copy_media_to_product_gallery(webp_path: str, product_id: int) -> str:
    src = _abs_upload_path(webp_path)
    if not src.exists() or not src.is_file():
        raise ValueError("Inbox image file not found")

    dst_dir = _product_media_dir(product_id)
    dst = dst_dir / src.name
    if dst.exists():
        dst = dst_dir / f"{src.stem}-{uuid.uuid4().hex[:8]}{src.suffix}"
    shutil.copy2(src, dst)

    mime = mimetypes.guess_type(dst.name)[0] or "image/webp"
    size = dst.stat().st_size
    file_id = uuid.uuid4().hex
    rel_url = f"/uploads/products/{product_id}/{dst.name}"

    manifest = _load_manifest(product_id)
    manifest["items"][file_id] = {
        "id": file_id,
        "filename": dst.name,
        "mime": mime,
        "size": size,
        "kind": "image",
        "url": rel_url,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    manifest["order"].append(file_id)
    _save_manifest(product_id, manifest)
    return rel_url


def _default_title(item: dict[str, Any]) -> str:
    draft_title = str(item.get("draft_title") or "").strip()
    if draft_title:
        return draft_title
    filename = str(item.get("filename") or "").strip()
    if filename:
        return Path(filename).stem or "Bez názvu díla"
    return f"Dílo {int(item.get('id') or 0)}"


@router.post("/upload")
async def upload_media_inbox(
    files: list[UploadFile] = File(...),
) -> dict[str, Any]:
    prepared_items: list[PreparedInboxItem] = []
    imported = 0
    rag_adapted = 0
    rag_new_saved = 0
    rag_new_failed = 0

    for upload in list(files or []):
        if not upload or not upload.filename:
            continue
        temp_path = _save_upload_to_temp(upload)
        try:
            webp_abs_path = convert_to_webp(temp_path)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=f"{upload.filename}: {exc}") from exc
        webp_rel = _relative_upload_path(webp_abs_path)
        prepared_items.append(
            PreparedInboxItem(
                filename=upload.filename or "",
                webp_abs_path=webp_abs_path,
                webp_rel_path=webp_rel,
            )
        )

    draft_results = await generate_inbox_drafts_batch(
        prepared_items,
        concurrency=AI_CONCURRENCY,
        timeout_sec=AI_TIMEOUT_SEC,
    )

    for prepared, result in zip(prepared_items, draft_results):
        draft = dict(result.draft or {})
        if result.error:
            rag_new_failed += 1
            draft = {
                "title": Path(prepared.filename or prepared.webp_abs_path).stem or "Bez názvu díla",
                "description": "",
                "product_type": "other",
                "combined_tags": [],
                "provider_used": "openai_vision",
                "from_cache": False,
            }
        else:
            if bool(draft.get("from_cache")):
                rag_adapted += 1
            else:
                rag_new_saved += 1
        add_inbox_item(filename=prepared.filename, webp_path=prepared.webp_rel_path, draft=draft)
        imported += 1

    return {
        "imported": imported,
        "pending_items": count_pending_items(),
        "rag": {
            "adapted": rag_adapted,
            "new_saved": rag_new_saved,
            "new_failed": rag_new_failed,
            "total": rag_adapted + rag_new_saved + rag_new_failed,
        },
    }


@router.get("/pending")
async def list_pending_media_inbox() -> dict[str, Any]:
    items = get_pending_items()
    return {
        "items": [
            {
                "id": int(item.get("id") or 0),
                "filename": item.get("filename"),
                "webp_path": item.get("webp_path"),
                "product_type": item.get("product_type"),
                "status": item.get("status"),
                "draft_title": item.get("draft_title"),
                "draft_description": item.get("draft_description"),
                "image_key": item.get("image_key"),
            }
            for item in items
            if int(item.get("id") or 0) > 0
        ]
    }


@router.post("/delete-batch")
async def delete_media_inbox_batch(payload: DeleteBatchRequest) -> dict[str, Any]:
    deleted, errors, paths = delete_items(payload.ids or [])
    for path in paths:
        _delete_upload_file(path)
    return {"deleted": deleted, "errors": errors}


@router.delete("/all")
async def delete_media_inbox_all() -> dict[str, Any]:
    deleted_count, paths = delete_all_items()
    for path in paths:
        _delete_upload_file(path)
    return {"deleted": deleted_count}


@router.delete("/{item_id}")
async def delete_media_inbox_item(item_id: int) -> dict[str, Any]:
    deleted, path = delete_item(item_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="not found")
    if path:
        _delete_upload_file(path)
    return {"deleted_id": item_id}


@router.post("/assign")
async def assign_media_inbox(
    payload: AssignInboxRequest,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    if not payload.items:
        raise HTTPException(status_code=400, detail="items must not be empty")

    created_products: list[int] = []
    errors: list[dict[str, Any]] = []

    for req in payload.items:
        claimed_item: dict[str, Any] | None = None
        should_reset_to_pending = False
        try:
            mode = str(req.assign_as or "").strip().lower() or "product"
            if mode != "product":
                raise ValueError("Only assign_as='product' is supported in this project")

            claimed_item = claim_pending_item(req.inbox_id)
            if not claimed_item:
                raise ValueError(f"Inbox item {req.inbox_id} is not pending")
            should_reset_to_pending = True
            inbox_item = claimed_item

            title = _default_title(inbox_item)
            slug = _build_unique_slug(db, title)
            description = str(inbox_item.get("draft_description") or "").strip() or None

            product = models.Product(
                title=title,
                slug=slug,
                description=description,
                price=Decimal("0.00"),
                stock=1,
                is_active=True,
            )
            db.add(product)
            db.commit()
            db.refresh(product)

            _copy_media_to_product_gallery(str(inbox_item.get("webp_path") or ""), product.id)
            mark_item_assigned(req.inbox_id, product_id=product.id)
            should_reset_to_pending = False
            created_products.append(product.id)
            seed_product_translations(db, product)
            db.commit()
            try:
                enqueue_translation_jobs(
                    product_id=product.id,
                    title=product.title,
                    description=product.description,
                )
            except Exception as enqueue_exc:
                logger.error(
                    "translation.enqueue_failed inbox_id=%s product_id=%s error=%s",
                    req.inbox_id,
                    product.id,
                    enqueue_exc,
                )
                errors.append(
                    {
                        "inbox_id": req.inbox_id,
                        "error": f"translation_enqueue_failed: {enqueue_exc}",
                    }
                )
        except Exception as exc:
            db.rollback()
            if should_reset_to_pending and claimed_item is not None:
                mark_item_pending(req.inbox_id)
            errors.append({"inbox_id": req.inbox_id, "error": str(exc)})
            continue

    return {
        "assigned": len(created_products),
        "product_ids": created_products,
        "variant_ids": [],
        "errors": errors,
    }
