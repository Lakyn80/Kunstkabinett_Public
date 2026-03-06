from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional
import uuid


CHROMA_PATH = Path(__file__).resolve().parent / "chroma_db"
CHROMA_COLLECTION = "arte_moderno_artist_bio_rag"

_client = None
_collection = None


def _get_collection():
    global _client, _collection

    if _collection is not None:
        return _collection

    try:
        import chromadb
    except Exception as exc:  # pragma: no cover
        raise RuntimeError("chromadb package is required for AI Artist Bio module") from exc

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

    did = (doc_id or f"artist_bio_{uuid.uuid4().hex}").strip()
    col = _get_collection()
    col.upsert(ids=[did], documents=[clean_text], metadatas=[metadata or {}])
    return did


def search(
    query: str,
    n_results: int = 5,
    where: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    clean_query = (query or "").strip()
    if not clean_query:
        return []

    col = _get_collection()
    result = col.query(
        query_texts=[clean_query],
        n_results=max(1, min(int(n_results or 5), 20)),
        where=where,
        include=["documents", "metadatas", "distances"],
    )

    ids = (result.get("ids") or [[]])[0]
    docs = (result.get("documents") or [[]])[0]
    metas = (result.get("metadatas") or [[]])[0]
    dists = (result.get("distances") or [[]])[0]

    items: List[Dict[str, Any]] = []
    for idx, doc_id in enumerate(ids):
        items.append(
            {
                "id": str(doc_id),
                "text": str(docs[idx]) if idx < len(docs) and docs[idx] is not None else "",
                "metadata": metas[idx] if idx < len(metas) and isinstance(metas[idx], dict) else {},
                "distance": float(dists[idx]) if idx < len(dists) and dists[idx] is not None else None,
            }
        )

    return items


def find_cached_bio_by_artist_name(artist_name_norm: str) -> Optional[Dict[str, Any]]:
    clean_name = (artist_name_norm or "").strip().lower()
    if not clean_name:
        return None

    items = search(query=clean_name, n_results=1, where={"artist_name_norm": clean_name})
    if not items:
        return None
    return items[0]
