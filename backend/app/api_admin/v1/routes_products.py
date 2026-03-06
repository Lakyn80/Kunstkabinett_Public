from __future__ import annotations
from decimal import Decimal
from typing import Optional, List, Tuple, Set
import os
import json
import uuid
import mimetypes
from datetime import datetime
import re
import logging

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status, UploadFile, File
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from sqlalchemy import delete as sa_delete, text

from app.core.deps import get_db, require_admin
from app.db import models
from app.modules.translation_queue.queue import enqueue_translation_jobs
from app.services.translation_helper import clear_product_specs_translations, seed_product_translations

router = APIRouter(prefix="/products", tags=["admin: products"])
logger = logging.getLogger(__name__)


def _featured_store_path() -> str:
    candidates = []
    env_dir = os.getenv("UPLOAD_DIR")
    if env_dir:
        candidates.append(env_dir)
    candidates.append("/app/uploads")
    candidates.append(os.path.join(os.getcwd(), "uploads"))
    for base in candidates:
        try:
            os.makedirs(base, exist_ok=True)
            return os.path.join(base, "featured_products.json")
        except Exception:
            continue
    return os.path.join(os.getcwd(), "featured_products.json")


def _load_featured_ids() -> Set[int]:
    path = _featured_store_path()
    if not os.path.exists(path):
        return set()
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, list):
            return set()
        return {int(x) for x in data if str(x).isdigit()}
    except Exception:
        return set()


def _save_featured_ids(ids: Set[int]) -> None:
    path = _featured_store_path()
    with open(path, "w", encoding="utf-8") as f:
        json.dump(sorted(list(ids)), f, ensure_ascii=False, indent=2)


_MISSING = object()


def _product_specs_store_path() -> str:
    candidates = []
    env_dir = os.getenv("UPLOAD_DIR")
    if env_dir:
        candidates.append(env_dir)
    candidates.append("/app/uploads")
    candidates.append(os.path.join(os.getcwd(), "uploads"))
    for base in candidates:
        try:
            os.makedirs(base, exist_ok=True)
            return os.path.join(base, "product_specs.json")
        except Exception:
            continue
    return os.path.join(os.getcwd(), "product_specs.json")


def _load_product_specs_store() -> dict:
    path = _product_specs_store_path()
    if not os.path.exists(path):
        return {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict):
            return data
    except Exception:
        pass
    return {}


def _save_product_specs_store(store: dict) -> None:
    path = _product_specs_store_path()
    with open(path, "w", encoding="utf-8") as f:
        json.dump(store, f, ensure_ascii=False, indent=2)


def _normalize_specs_year(value) -> Optional[int]:
    if value in (None, ""):
        return None
    try:
        return int(value)
    except Exception:
        return None


def _normalize_specs_text(value) -> Optional[str]:
    if value is None:
        return None
    text_value = str(value).strip()
    return text_value or None


def _read_product_specs(product_id: int) -> dict:
    store = _load_product_specs_store()
    row = store.get(str(product_id), {})
    if not isinstance(row, dict):
        row = {}
    return {
        "year": _normalize_specs_year(row.get("year")),
        "technique": _normalize_specs_text(row.get("technique")),
        "materials": _normalize_specs_text(row.get("materials")),
        "dimensions": _normalize_specs_text(row.get("dimensions")),
    }


def _write_product_specs(
    product_id: int,
    *,
    year=_MISSING,
    technique=_MISSING,
    materials=_MISSING,
    dimensions=_MISSING,
) -> None:
    if all(x is _MISSING for x in (year, technique, materials, dimensions)):
        return

    store = _load_product_specs_store()
    key = str(product_id)
    row = store.get(key, {})
    if not isinstance(row, dict):
        row = {}

    if year is not _MISSING:
        row["year"] = _normalize_specs_year(year)
    if technique is not _MISSING:
        row["technique"] = _normalize_specs_text(technique)
    if materials is not _MISSING:
        row["materials"] = _normalize_specs_text(materials)
    if dimensions is not _MISSING:
        row["dimensions"] = _normalize_specs_text(dimensions)

    if all(row.get(k) in (None, "") for k in ("year", "technique", "materials", "dimensions")):
        store.pop(key, None)
    else:
        store[key] = {
            "year": _normalize_specs_year(row.get("year")),
            "technique": _normalize_specs_text(row.get("technique")),
            "materials": _normalize_specs_text(row.get("materials")),
            "dimensions": _normalize_specs_text(row.get("dimensions")),
        }

    _save_product_specs_store(store)


def _delete_product_specs(product_id: int) -> None:
    store = _load_product_specs_store()
    key = str(product_id)
    if key in store:
        store.pop(key, None)
        _save_product_specs_store(store)

# ---- LIST (s filtrem & stránkováním) ----
@router.get("/", dependencies=[Depends(require_admin)])
def admin_list_products(
    q: Optional[str] = Query(None, description="Fulltext: title/slug"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    featured_ids = _load_featured_ids()
    specs_store = _load_product_specs_store()
    # základ pro total
    base = db.query(models.Product)
    if q:
        q_like = f"%{q}%"
        base = base.filter(
            (models.Product.title.ilike(q_like)) | (models.Product.slug.ilike(q_like))
        )
    total = base.count()

    # dotaz s LEFT JOIN na artist kvůli jménu
    rows = (
        base
        .outerjoin(models.Artist, models.Product.artist_id == models.Artist.id)
        .add_columns(models.Artist.name.label("artist_name"))
        .order_by(models.Product.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    items = []
    for rec in rows:
        # rec je tuple (Product, artist_name) kvůli add_columns
        p: models.Product = rec[0]
        artist_name = rec[1]
        row_specs = specs_store.get(str(p.id), {}) if isinstance(specs_store, dict) else {}
        items.append({
            "id": p.id,
            "title": p.title,
            "slug": p.slug,
            "description": p.description,
            "price": p.price,
            "price_eur": getattr(p, "price_eur", None),
            "stock": p.stock,
            "category_id": p.category_id,
            "artist_id": p.artist_id,
            "artist_name": artist_name or None,
            "is_active": getattr(p, "is_active", True),
            "featured": p.id in featured_ids,
            "year": _normalize_specs_year((row_specs or {}).get("year")),
            "technique": _normalize_specs_text((row_specs or {}).get("technique")),
            "materials": _normalize_specs_text((row_specs or {}).get("materials")),
            "dimensions": _normalize_specs_text((row_specs or {}).get("dimensions")),
        })

    return {"total": total, "limit": limit, "offset": offset, "items": items}

# ---- DETAIL ----
@router.get("/{id_or_slug}", dependencies=[Depends(require_admin)])
def admin_get_product(
    id_or_slug: str = Path(..., description="ID nebo slug produktu"),
    db: Session = Depends(get_db),
):
    featured_ids = _load_featured_ids()
    product = None
    if id_or_slug.isdigit():
        product = db.get(models.Product, int(id_or_slug))
    if product is None:
        product = db.query(models.Product).filter(models.Product.slug == id_or_slug).first()
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Produkt nenalezen.")

    # zjisti jméno autora (bez spoléhání na vztahy)
    artist_name = None
    if product.artist_id:
        artist = db.get(models.Artist, int(product.artist_id))
        if artist:
            artist_name = artist.name
    specs = _read_product_specs(product.id)

    return {
        "id": product.id,
        "title": product.title,
        "slug": product.slug,
        "description": product.description,
        "price": product.price,
        "price_eur": getattr(product, "price_eur", None),
        "stock": product.stock,
        "category_id": product.category_id,
        "artist_id": product.artist_id,
        "artist_name": artist_name,
        "is_active": getattr(product, "is_active", True),
        "featured": product.id in featured_ids,
        "year": specs["year"],
        "technique": specs["technique"],
        "materials": specs["materials"],
        "dimensions": specs["dimensions"],
    }

# ---- CREATE ----
@router.post("/", status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_admin)])
def admin_create_product(
    payload: dict,
    db: Session = Depends(get_db)
):
    try:
        data = dict(payload)
        featured = bool(data.pop("featured", False))
        year = data.pop("year", _MISSING)
        technique = data.pop("technique", _MISSING)
        materials = data.pop("materials", _MISSING)
        dimensions = data.pop("dimensions", _MISSING)

        cat_id = data.get("category_id")
        if cat_id is not None:
            exists = db.get(models.Category, int(cat_id))
            if not exists:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Category with id={cat_id} does not exist.",
                )

        artist_id = data.get("artist_id")
        if artist_id is not None:
            a_exists = db.get(models.Artist, int(artist_id))
            if not a_exists:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Artist with id={artist_id} does not exist.",
                )

        if data.get("price") is not None:
            data["price"] = Decimal(str(data["price"]))
        if data.get("price_eur") is not None:
            data["price_eur"] = Decimal(str(data["price_eur"]))

        new_product = models.Product(**data)
        db.add(new_product)
        db.commit()
        db.refresh(new_product)

        if featured:
            featured_ids = _load_featured_ids()
            featured_ids.add(new_product.id)
            _save_featured_ids(featured_ids)
        _write_product_specs(
            new_product.id,
            year=year,
            technique=technique,
            materials=materials,
            dimensions=dimensions,
        )

        specs = _read_product_specs(new_product.id)

        seed_product_translations(db, new_product)
        db.commit()
        try:
            enqueue_translation_jobs(
                product_id=new_product.id,
                title=new_product.title,
                description=new_product.description,
                technique=specs["technique"],
                materials=specs["materials"],
            )
        except Exception as exc:
            logger.error("translation.enqueue_failed product=%s error=%s", new_product.id, exc)

        artist_name = None
        if new_product.artist_id:
            a = db.get(models.Artist, int(new_product.artist_id))
            artist_name = a.name if a else None

        return {
            "id": new_product.id,
            "title": new_product.title,
            "slug": new_product.slug,
            "description": new_product.description,
            "price": new_product.price,
            "price_eur": getattr(new_product, "price_eur", None),
            "stock": new_product.stock,
            "category_id": new_product.category_id,
            "artist_id": new_product.artist_id,
            "artist_name": artist_name,
            "is_active": getattr(new_product, "is_active", True),
            "featured": featured,
            "year": specs["year"],
            "technique": specs["technique"],
            "materials": specs["materials"],
            "dimensions": specs["dimensions"],
        }

    except HTTPException:
        db.rollback()
        raise
    except IntegrityError as ie:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Produkt se stejným 'slug' už existuje.",
        ) from ie
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Chyba při vytváření produktu: {e}",
        ) from e

# ---- UPDATE (PATCH-like) ----
@router.patch("/{id}", dependencies=[Depends(require_admin)])
def admin_update_product(
    id: int,
    payload: dict,
    db: Session = Depends(get_db),
):
    product = db.get(models.Product, id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Produkt nenalezen.")

    try:
        data = dict(payload)
        featured_value = data.pop("featured", None)
        year = data.pop("year", _MISSING)
        technique = data.pop("technique", _MISSING)
        materials = data.pop("materials", _MISSING)
        dimensions = data.pop("dimensions", _MISSING)

        if "category_id" in data and data["category_id"] is not None:
            exists = db.get(models.Category, int(data["category_id"]))
            if not exists:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Category with id={data['category_id']} does not exist.",
                )

        if "artist_id" in data and data["artist_id"] is not None:
            a_exists = db.get(models.Artist, int(data["artist_id"]))
            if not a_exists:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Artist with id={data['artist_id']} does not exist.",
                )

        if "price" in data and data["price"] is not None:
            data["price"] = Decimal(str(data["price"]))
        if "price_eur" in data and data["price_eur"] is not None:
            data["price_eur"] = Decimal(str(data["price_eur"]))

        old_title = _normalize_specs_text(product.title)
        old_description = _normalize_specs_text(product.description)
        old_specs = _read_product_specs(product.id)

        new_title = old_title
        if "title" in data:
            new_title = _normalize_specs_text(data.get("title"))
        new_description = old_description
        if "description" in data:
            new_description = _normalize_specs_text(data.get("description"))
        new_technique = old_specs["technique"] if technique is _MISSING else _normalize_specs_text(technique)
        new_materials = old_specs["materials"] if materials is _MISSING else _normalize_specs_text(materials)

        needs_translation = (
            new_title != old_title
            or new_description != old_description
            or new_technique != old_specs["technique"]
            or new_materials != old_specs["materials"]
        )

        for k, v in data.items():
            if hasattr(product, k):
                setattr(product, k, v)

        db.commit()
        db.refresh(product)

        if featured_value is not None:
            featured_ids = _load_featured_ids()
            if bool(featured_value):
                featured_ids.add(product.id)
            else:
                featured_ids.discard(product.id)
            _save_featured_ids(featured_ids)
        _write_product_specs(
            product.id,
            year=year,
            technique=technique,
            materials=materials,
            dimensions=dimensions,
        )

        is_featured = product.id in _load_featured_ids()
        specs = _read_product_specs(product.id)

        # Pokud se změnil title/description/technika/materiály, seedni fallback a enqueue překlady.
        if needs_translation:
            seed_product_translations(db, product)
            db.commit()
            try:
                enqueue_translation_jobs(
                    product_id=product.id,
                    title=product.title,
                    description=product.description,
                    technique=specs["technique"],
                    materials=specs["materials"],
                )
            except Exception as exc:
                logger.error("translation.enqueue_failed product=%s error=%s", product.id, exc)

        artist_name = None
        if product.artist_id:
            a = db.get(models.Artist, int(product.artist_id))
            artist_name = a.name if a else None
        return {
            "id": product.id,
            "title": product.title,
            "slug": product.slug,
            "description": product.description,
            "price": product.price,
            "price_eur": getattr(product, "price_eur", None),
            "stock": product.stock,
            "category_id": product.category_id,
            "artist_id": product.artist_id,
            "artist_name": artist_name,
            "is_active": getattr(product, "is_active", True),
            "featured": is_featured,
            "year": specs["year"],
            "technique": specs["technique"],
            "materials": specs["materials"],
            "dimensions": specs["dimensions"],
        }

    except HTTPException:
        db.rollback()
        raise
    except IntegrityError as ie:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Produkt se stejným 'slug' už existuje.",
        ) from ie
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Chyba při úpravě produktu: {e}",
        ) from e

# ===== Pomocné funkce pro bezpečné mazání závislostí =====

def _exec_scalar(db: Session, sql: str) -> Optional[str]:
    try:
        val = db.execute(text(sql)).scalar()
        db.commit()
        return val
    except Exception:
        db.rollback()
        return None

def _table_exists(db: Session, table: str) -> bool:
    return bool(_exec_scalar(db, f"SELECT to_regclass('public.{table}')"))

def _safe_delete_relations(db: Session, table: str, where_sql: str, params: dict):
    if not _table_exists(db, table):
        return
    try:
        db.execute(text(f"DELETE FROM public.{table} WHERE {where_sql}"), params)
        db.commit()
    except Exception:
        db.rollback()

# ---- DELETE ----
@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_admin)])
def admin_delete_product(id: int, db: Session = Depends(get_db)):
    product = db.get(models.Product, id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Produkt nenalezen.")

    related_tables = ("orderitem", "order_item", "reservationitem", "reservation_item")
    for tbl in related_tables:
        _safe_delete_relations(db, tbl, "product_id = :pid", {"pid": id})

    try:
        pdir = _product_dir(id)
        if os.path.isdir(pdir):
            import shutil
            shutil.rmtree(pdir, ignore_errors=True)
    except Exception:
        pass

    try:
        db.execute(sa_delete(models.Product).where(models.Product.id == id))
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Chyba při mazání: {e}")

    featured_ids = _load_featured_ids()
    if id in featured_ids:
        featured_ids.discard(id)
        _save_featured_ids(featured_ids)
    _delete_product_specs(id)
    clear_product_specs_translations(id)

    return

# =========================
# ---- MEDIA (upload/list/delete/reorder) ----
# =========================

def _upload_root() -> str:
    # Respect configured upload dir (same as StaticFiles mount) to avoid 404s.
    candidates = []
    env_dir = os.getenv("UPLOAD_DIR")
    if env_dir:
        candidates.append(env_dir)
    candidates.append("/app/uploads")
    candidates.append("/var/www/kunst/uploads")
    candidates.append(os.path.join(os.getcwd(), "uploads"))
    for path in candidates:
        try:
            os.makedirs(path, exist_ok=True)
            return path
        except Exception:
            continue
    return os.path.join(os.getcwd(), "uploads")


def _product_dir(pid: int) -> str:
    pdir = os.path.join(_upload_root(), "products", str(pid))
    os.makedirs(pdir, exist_ok=True)
    return pdir

def _manifest_path(pid: int) -> str:
    return os.path.join(_product_dir(pid), "manifest.json")

def _load_manifest(pid: int) -> dict:
    path = _manifest_path(pid)
    if not os.path.exists(path):
        return {"order": [], "items": {}}
    with open(path, "r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except Exception:
            return {"order": [], "items": {}}

def _save_manifest(pid: int, data: dict) -> None:
    path = _manifest_path(pid)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def _item_from_file(pid: int, file_id: str, filename: str, mime: str, size: int) -> dict:
    kind = "video" if (mime or "").startswith("video/") else "image" if (mime or "").startswith("image/") else "file"
    return {
        "id": file_id,
        "filename": filename,
        "mime": mime,
        "size": size,
        "kind": kind,
        "url": f"/uploads/products/{pid}/{filename}",
        "created_at": datetime.utcnow().isoformat() + "Z",
    }

@router.get("/{id}/media", dependencies=[Depends(require_admin)])
def admin_list_media(id: int, db: Session = Depends(get_db)):
    p = db.get(models.Product, id)
    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Produkt nenalezen.")
    man = _load_manifest(id)
    items = []
    for fid in man.get("order", []):
        meta = man["items"].get(fid)
        if meta:
            items.append(meta)
    return {"items": items, "total": len(items)}

ALLOWED_EXT: Tuple[str, ...] = (".jpg", ".jpeg", ".png", ".webp", ".avif")
MAX_BYTES = 20 * 1024 * 1024

def _sanitize_filename(name: str, ext: str) -> str:
    base = os.path.splitext(name or "")[0]
    base = re.sub(r"[^A-Za-z0-9._-]+", "_", base).strip("._-") or "file"
    if not ext.startswith("."):
        ext = "." + ext
    return f"{base}{ext.lower()}"

def _dedupe_filename(pdir: str, fname: str) -> str:
    candidate = fname
    counter = 1
    while os.path.exists(os.path.join(pdir, candidate)):
        stem, ext = os.path.splitext(fname)
        candidate = f"{stem}-{counter}{ext}"
        counter += 1
    return candidate

@router.post("/{id}/media", dependencies=[Depends(require_admin)])
async def admin_upload_media(
    id: int,
    files: List[UploadFile] = File(..., description="Jedna nebo více fotek/videí (multipart/form-data, pole 'files')"),
    db: Session = Depends(get_db),
):
    p = db.get(models.Product, id)
    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Produkt nenalezen.")

    man = _load_manifest(id)
    pdir = _product_dir(id)

    new_items = []
    for uf in files:
        original = uf.filename or ""
        ext = os.path.splitext(original)[1].lower()
        if ext not in ALLOWED_EXT:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Nepovolená přípona: {ext}")

        content = await uf.read()
        if not content:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Soubor je prázdný.")
        if len(content) > MAX_BYTES:
            raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Soubor je příliš velký.")

        fid = uuid.uuid4().hex
        fname = _sanitize_filename(original, ext)
        fname = _dedupe_filename(pdir, fname)
        fpath = os.path.join(pdir, fname)

        mime = uf.content_type or mimetypes.guess_type(fname)[0] or "application/octet-stream"

        with open(fpath, "wb") as out:
            out.write(content)

        meta = _item_from_file(id, fid, fname, mime, size=len(content))
        man["items"][fid] = meta
        man["order"].append(fid)
        new_items.append(meta)

    _save_manifest(id, man)
    return {"uploaded": new_items, "total": len(man["order"])}

@router.delete("/{id}/media/{media_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_admin)])
def admin_delete_media(id: int, media_id: str, db: Session = Depends(get_db)):
    p = db.get(models.Product, id)
    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Produkt nenalezen.")

    man = _load_manifest(id)
    meta = man["items"].get(media_id)
    if not meta:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Soubor nenalezen.")

    fpath = os.path.join(_product_dir(id), meta["filename"])
    if os.path.exists(fpath):
        try:
            os.remove(fpath)
        except Exception:
            pass

    man["items"].pop(media_id, None)
    man["order"] = [x for x in man.get("order", []) if x != media_id]
    _save_manifest(id, man)
    return {"ok": True}

@router.patch("/{id}/media/order", dependencies=[Depends(require_admin)])
def admin_reorder_media(id: int, payload: dict, db: Session = Depends(get_db)):
    """
    Payload: { "order": ["media_id_1", "media_id_2", ...] }
    """
    p = db.get(models.Product, id)
    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Produkt nenalezen.")

    new_order = payload.get("order") or []
    if not isinstance(new_order, list):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Pole 'order' je povinné.")

    man = _load_manifest(id)
    exist = set(man["items"].keys())
    filtered = [mid for mid in new_order if mid in exist]
    for mid in man.get("order", []):
        if mid not in filtered:
            filtered.append(mid)

    man["order"] = filtered
    _save_manifest(id, man)
    return {"order": man["order"]}


# =========================
# ---- TRANSLATIONS ----
# =========================

@router.get("/{id}/translations", dependencies=[Depends(require_admin)])
def get_product_translations(id: int, db: Session = Depends(get_db)):
    """Get all translations for a product."""
    p = db.get(models.Product, id)
    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Produkt nenalezen.")

    translations = db.query(models.ProductTranslation).filter(
        models.ProductTranslation.product_id == id
    ).all()

    result = {
        "cs": {
            "title": p.title,
            "description": p.description
        }
    }

    for t in translations:
        result[t.language_code] = {
            "title": t.title,
            "description": t.description
        }

    return result


@router.post("/{id}/translations/{lang_code}", dependencies=[Depends(require_admin)])
async def create_or_update_translation(
    id: int,
    lang_code: str,
    payload: dict,
    db: Session = Depends(get_db)
):
    """Create or update translation for a specific language."""
    p = db.get(models.Product, id)
    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Produkt nenalezen.")

    if lang_code == "cs":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot create translation for source language (cs). Edit the product directly."
        )

    # Check if translation exists
    translation = db.query(models.ProductTranslation).filter(
        models.ProductTranslation.product_id == id,
        models.ProductTranslation.language_code == lang_code
    ).first()

    title = payload.get("title", "")
    description = payload.get("description")

    if not title:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Title is required"
        )

    if translation:
        # Update existing
        translation.title = title
        translation.description = description
    else:
        # Create new
        translation = models.ProductTranslation(
            product_id=id,
            language_code=lang_code,
            title=title,
            description=description
        )
        db.add(translation)

    try:
        db.commit()
        db.refresh(translation)
        return {
            "language_code": translation.language_code,
            "title": translation.title,
            "description": translation.description
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save translation: {str(e)}"
        )


@router.delete("/{id}/translations/{lang_code}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_admin)])
def delete_translation(id: int, lang_code: str, db: Session = Depends(get_db)):
    """Delete translation for a specific language."""
    p = db.get(models.Product, id)
    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Produkt nenalezen.")

    if lang_code == "cs":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete source language"
        )

    translation = db.query(models.ProductTranslation).filter(
        models.ProductTranslation.product_id == id,
        models.ProductTranslation.language_code == lang_code
    ).first()

    if not translation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Translation not found.")

    try:
        db.delete(translation)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete translation: {str(e)}"
        )
