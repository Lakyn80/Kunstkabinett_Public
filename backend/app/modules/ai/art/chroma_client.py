from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional
import uuid


CHROMA_PATH = Path(__file__).resolve().parent / "chroma_db"
CHROMA_COLLECTION = "arte_moderno_art_rag"

_client = None
_collection = None


def _metadata_hint_text(metadata: Optional[Dict[str, Any]]) -> str:
    meta = metadata if isinstance(metadata, dict) else {}
    title = str(meta.get("title") or "").strip()
    art_type = str(meta.get("art_type") or "").strip()
    style = str(meta.get("style") or "").strip()
    materials = str(meta.get("materials") or "").strip()
    movement = str(meta.get("movement") or "").strip()
    tags = str(meta.get("tags") or "").strip()

    parts: List[str] = []
    if title:
        parts.append(f"title: {title}")
    if art_type:
        parts.append(f"art_type: {art_type}")
    if style:
        parts.append(f"style: {style}")
    if tags:
        parts.append(f"keywords: {tags}")
    if materials:
        parts.append(f"materials: {materials}")
    if movement:
        parts.append(f"movement: {movement}")
    return " | ".join(parts)


def _get_collection():
    global _client, _collection

    if _collection is not None:
        return _collection

    try:
        import chromadb
    except Exception as exc:  # pragma: no cover
        raise RuntimeError("chromadb package is required for AI RAG module") from exc

    CHROMA_PATH.mkdir(parents=True, exist_ok=True)

    if _client is None:
        _client = chromadb.PersistentClient(path=str(CHROMA_PATH))

    _collection = _client.get_or_create_collection(name=CHROMA_COLLECTION)
    return _collection


def add_document(
    text: str,
    metadata: Optional[Dict[str, Any]] = None,
    doc_id: Optional[str] = None,
) -> str:
    clean_text = (text or "").strip()
    if not clean_text:
        raise ValueError("Document text cannot be empty")

    did = (doc_id or f"art_{uuid.uuid4().hex}").strip()
    col = _get_collection()
    col.upsert(ids=[did], documents=[clean_text], metadatas=[metadata or {}])
    return did


def get_document(doc_id: str) -> Optional[Dict[str, Any]]:
    clean_id = (doc_id or "").strip()
    if not clean_id:
        return None

    col = _get_collection()
    result = col.get(ids=[clean_id], include=["documents", "metadatas"])
    ids = result.get("ids") or []
    if not ids:
        return None

    docs = result.get("documents") or []
    metas = result.get("metadatas") or []

    text = docs[0] if docs else ""
    metadata = metas[0] if metas and isinstance(metas[0], dict) else {}
    return {
        "id": str(ids[0]),
        "text": str(text or "").strip(),
        "metadata": metadata,
    }


def search(
    query: str,
    n_results: int = 5,
    where: Optional[Dict[str, Any]] = None,
    metadata_only: bool = True,
) -> List[Dict[str, Any]]:
    clean_query = (query or "").strip()
    if not clean_query:
        return []

    col = _get_collection()
    include_fields = ["metadatas", "distances"]
    if not metadata_only:
        include_fields.insert(0, "documents")
    result = col.query(
        query_texts=[clean_query],
        n_results=max(1, min(int(n_results or 5), 20)),
        where=where,
        include=include_fields,
    )

    ids = (result.get("ids") or [[]])[0]
    docs = (result.get("documents") or [[]])[0] if not metadata_only else []
    metas = (result.get("metadatas") or [[]])[0]
    dists = (result.get("distances") or [[]])[0]

    items: List[Dict[str, Any]] = []
    for idx, doc_id in enumerate(ids):
        metadata = metas[idx] if idx < len(metas) and isinstance(metas[idx], dict) else {}
        if metadata_only:
            text = _metadata_hint_text(metadata)
        else:
            text = str(docs[idx]) if idx < len(docs) and docs[idx] is not None else ""
        items.append(
            {
                "id": str(doc_id),
                "text": text,
                "metadata": metadata,
                "distance": float(dists[idx]) if idx < len(dists) and dists[idx] is not None else None,
            }
        )

    return items
