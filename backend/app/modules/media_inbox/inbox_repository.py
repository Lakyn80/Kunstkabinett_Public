from __future__ import annotations

import json
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .webp_converter import UPLOAD_DIR


STATE_DIR = UPLOAD_DIR / "media_inbox"
STATE_FILE = STATE_DIR / "items.json"
_LOCK = threading.Lock()


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _default_state() -> dict[str, Any]:
    return {"next_id": 1, "items": []}


def _ensure_state_dir() -> None:
    STATE_DIR.mkdir(parents=True, exist_ok=True)


def _load_state_unlocked() -> dict[str, Any]:
    _ensure_state_dir()
    if not STATE_FILE.exists():
        return _default_state()
    try:
        raw = json.loads(STATE_FILE.read_text(encoding="utf-8"))
    except Exception:
        return _default_state()
    if not isinstance(raw, dict):
        return _default_state()
    needs_save = False
    if not isinstance(raw.get("items"), list):
        raw["items"] = []
        needs_save = True

    normalized_items: list[dict[str, Any]] = []
    used_ids: set[int] = set()
    max_id = 0

    for item in list(raw.get("items") or []):
        if not isinstance(item, dict):
            needs_save = True
            continue

        row = dict(item)
        try:
            item_id = int(row.get("id") or 0)
        except Exception:
            item_id = 0

        if item_id <= 0 or item_id in used_ids:
            needs_save = True
            item_id = max_id + 1
            while item_id in used_ids:
                item_id += 1

        row["id"] = item_id
        row["status"] = _normalize_status(row.get("status"))
        if not row.get("created_at"):
            row["created_at"] = _utc_now_iso()
            needs_save = True
        if not row.get("updated_at"):
            row["updated_at"] = row["created_at"]
            needs_save = True

        normalized_items.append(row)
        used_ids.add(item_id)
        if item_id > max_id:
            max_id = item_id

    raw["items"] = normalized_items

    next_id_raw = raw.get("next_id")
    try:
        next_id = int(next_id_raw)
    except Exception:
        next_id = 0
    if next_id <= max_id:
        next_id = max_id + 1
        needs_save = True
    raw["next_id"] = max(next_id, 1)

    if needs_save:
        _save_state_unlocked(raw)
    return raw


def _save_state_unlocked(state: dict[str, Any]) -> None:
    _ensure_state_dir()
    STATE_FILE.write_text(
        json.dumps(state, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def _normalize_status(value: Any) -> str:
    status = str(value or "").strip().lower()
    return status or "pending"


def _sort_desc(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(items, key=lambda x: int(x.get("id") or 0), reverse=True)


def add_inbox_item(filename: str, webp_path: str, draft: dict[str, Any]) -> dict[str, Any]:
    with _LOCK:
        state = _load_state_unlocked()
        item_id = int(state.get("next_id") or 1)
        state["next_id"] = item_id + 1
        item = {
            "id": item_id,
            "filename": str(filename or "").strip() or None,
            "webp_path": str(webp_path or "").strip(),
            "draft_title": str(draft.get("title") or "").strip() or None,
            "draft_description": str(draft.get("description") or "").strip() or None,
            "product_type": str(draft.get("product_type") or "").strip() or "other",
            "combined_tags": list(draft.get("combined_tags") or []),
            "image_key": str(draft.get("image_key") or "").strip() or None,
            "provider_used": str(draft.get("provider_used") or "").strip() or None,
            "from_cache": bool(draft.get("from_cache")),
            "status": "pending",
            "assigned_product_id": None,
            "assigned_variant_id": None,
            "created_at": _utc_now_iso(),
            "updated_at": _utc_now_iso(),
        }
        state["items"].append(item)
        _save_state_unlocked(state)
        return dict(item)


def get_all_items() -> list[dict[str, Any]]:
    with _LOCK:
        state = _load_state_unlocked()
        return _sort_desc(list(state.get("items") or []))


def get_pending_items() -> list[dict[str, Any]]:
    with _LOCK:
        state = _load_state_unlocked()
        items = [i for i in list(state.get("items") or []) if _normalize_status(i.get("status")) == "pending"]
        return _sort_desc(items)


def count_pending_items() -> int:
    return len(get_pending_items())


def get_item(item_id: int) -> dict[str, Any] | None:
    with _LOCK:
        state = _load_state_unlocked()
        for item in list(state.get("items") or []):
            if int(item.get("id") or 0) == int(item_id):
                return dict(item)
        return None


def claim_pending_item(item_id: int) -> dict[str, Any] | None:
    with _LOCK:
        state = _load_state_unlocked()
        for item in list(state.get("items") or []):
            if int(item.get("id") or 0) != int(item_id):
                continue
            if _normalize_status(item.get("status")) != "pending":
                return None
            item["status"] = "processing"
            item["updated_at"] = _utc_now_iso()
            _save_state_unlocked(state)
            return dict(item)
        return None


def mark_item_pending(item_id: int) -> dict[str, Any] | None:
    with _LOCK:
        state = _load_state_unlocked()
        for item in list(state.get("items") or []):
            if int(item.get("id") or 0) != int(item_id):
                continue
            item["status"] = "pending"
            item["updated_at"] = _utc_now_iso()
            _save_state_unlocked(state)
            return dict(item)
        return None


def mark_item_assigned(item_id: int, product_id: int | None = None) -> dict[str, Any] | None:
    with _LOCK:
        state = _load_state_unlocked()
        for item in list(state.get("items") or []):
            if int(item.get("id") or 0) != int(item_id):
                continue
            item["status"] = "assigned"
            item["assigned_product_id"] = int(product_id) if product_id else None
            item["assigned_variant_id"] = None
            item["updated_at"] = _utc_now_iso()
            _save_state_unlocked(state)
            return dict(item)
        return None


def delete_item(item_id: int) -> tuple[bool, str | None]:
    with _LOCK:
        state = _load_state_unlocked()
        items = list(state.get("items") or [])
        keep: list[dict[str, Any]] = []
        deleted_path: str | None = None
        deleted = False
        for item in items:
            if int(item.get("id") or 0) == int(item_id):
                deleted = True
                deleted_path = str(item.get("webp_path") or "").strip() or None
                continue
            keep.append(item)
        if not deleted:
            return False, None
        state["items"] = keep
        _save_state_unlocked(state)
        return True, deleted_path


def delete_items(ids: list[int]) -> tuple[list[int], list[dict[str, Any]], list[str]]:
    id_set = {int(i) for i in (ids or [])}
    with _LOCK:
        state = _load_state_unlocked()
        items = list(state.get("items") or [])
        keep: list[dict[str, Any]] = []
        deleted_ids: list[int] = []
        deleted_paths: list[str] = []
        found = set()

        for item in items:
            item_id = int(item.get("id") or 0)
            if item_id in id_set:
                found.add(item_id)
                deleted_ids.append(item_id)
                path = str(item.get("webp_path") or "").strip()
                if path:
                    deleted_paths.append(path)
                continue
            keep.append(item)

        errors = [{"id": item_id, "error": "not found"} for item_id in sorted(id_set - found)]
        state["items"] = keep
        _save_state_unlocked(state)
        return deleted_ids, errors, deleted_paths


def delete_all_items() -> tuple[int, list[str]]:
    with _LOCK:
        state = _load_state_unlocked()
        items = list(state.get("items") or [])
        paths = [str(item.get("webp_path") or "").strip() for item in items if str(item.get("webp_path") or "").strip()]
        state["items"] = []
        _save_state_unlocked(state)
        return len(items), paths
