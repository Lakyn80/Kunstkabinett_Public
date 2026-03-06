# app/api/v1/routes_products.py - KOMPLETNÍ S IMAGE UPLOAD
from __future__ import annotations
from typing import Optional, List, Set
from decimal import Decimal
import os
import json

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.core.deps import get_db, require_admin
from app.db import models
from app.core.stock_service import get_available_stock
from app.core.image_service import process_and_compress_image, get_image_base64
from app.services.translation_helper import get_product_specs_translation

router = APIRouter(prefix="/products", tags=["products"])


def _get_product_image_url(pid: int, has_db_image: bool) -> Optional[str]:
    """Vrátí URL pro obrázek produktu z DB nebo z souborů."""
    if has_db_image:
        return f"/api/v1/products/{pid}/image"
    
    # Zkontroluj uploads/products/{pid}/ directory
    upload_dir = os.path.join("uploads", "products", str(pid))
    if not os.path.exists(upload_dir):
        return None
    
    manifest_path = os.path.join(upload_dir, "manifest.json")
    if not os.path.exists(manifest_path):
        return None
    
    try:
        import json
        with open(manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)
            order = manifest.get("order", [])
            if order and len(order) > 0:
                first_file_id = order[0]
                items = manifest.get("items", {})
                filename = items.get(first_file_id, {}).get("filename")
                if filename:
                    return f"/uploads/products/{pid}/{filename}"
    except Exception:
        pass
    
    return None


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
        import json
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, list):
            return set()
        return {int(x) for x in data if str(x).isdigit()}
    except Exception:
        return set()


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


def _read_product_specs_from_store(store: dict, product_id: int) -> dict:
    row = store.get(str(product_id), {})
    if not isinstance(row, dict):
        row = {}
    return {
        "year": _normalize_specs_year(row.get("year")),
        "technique": _normalize_specs_text(row.get("technique")),
        "materials": _normalize_specs_text(row.get("materials")),
        "dimensions": _normalize_specs_text(row.get("dimensions")),
    }


# ========== VEŘEJNÉ ENDPOINTY ==========

@router.get("/")
def list_products(
    q: Optional[str] = Query(None, description="Hledat v názvu/popisu"),
    category_id: Optional[int] = Query(None, ge=1),
    artist_id: Optional[int] = Query(None, ge=1),
    min_price: Optional[float] = Query(None, ge=0),
    max_price: Optional[float] = Query(None, ge=0),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    lang: Optional[str] = Query(None, description="Language code (cs, en, fr, de, etc.)"),
    db: Session = Depends(get_db),
):
    """
    Seznam produktů s filtry.
    Zobrazuje pouze produkty které mají available_stock > 0.
    Podporuje překlady pomocí parametru lang.
    """
    q_set = db.query(models.Product)
    conds = []

    if q:
        like = f"%{q}%"
        conds.append(
            (models.Product.title.ilike(like)) |
            (models.Product.description.ilike(like))
        )

    if category_id:
        conds.append(models.Product.category_id == category_id)

    if artist_id:
        conds.append(models.Product.artist_id == artist_id)

    if min_price is not None:
        conds.append(models.Product.price >= Decimal(str(min_price)))
    if max_price is not None:
        conds.append(models.Product.price <= Decimal(str(max_price)))

    # Filtruj pouze aktivní produkty
    conds.append(models.Product.is_active == True)

    if conds:
        q_set = q_set.filter(and_(*conds))

    rows: List[models.Product] = q_set.order_by(models.Product.id.desc()).all()
    featured_ids = _load_featured_ids()
    specs_store = _load_product_specs_store()

    # Filtruj pouze produkty s dostupným stockem
    items = []
    for p in rows:
        available = get_available_stock(db, p.id)
        if available > 0:
            # Default values (Czech)
            title = p.title
            description = p.description

            # If language is specified and not Czech, try to get translation
            if lang and lang != "cs":
                translation = db.query(models.ProductTranslation).filter(
                    models.ProductTranslation.product_id == p.id,
                    models.ProductTranslation.language_code == lang
                ).first()

                if translation:
                    title = translation.title or p.title
                    description = translation.description or p.description

            artist_name = p.artist.name if getattr(p, "artist", None) else None
            artist_slug = p.artist.slug if getattr(p, "artist", None) else None
            specs = _read_product_specs_from_store(specs_store, p.id)
            if lang and lang != "cs":
                specs_translation = get_product_specs_translation(p.id, lang)
                if specs_translation.get("technique"):
                    specs["technique"] = specs_translation["technique"]
                if specs_translation.get("materials"):
                    specs["materials"] = specs_translation["materials"]

            items.append({
                "id": p.id,
                "title": title,
                "slug": p.slug,
                "description": description,
                "price": float(p.price),
                "price_eur": float(p.price_eur) if getattr(p, "price_eur", None) is not None else None,
                "stock": int(p.stock or 0),
                "available_stock": available,
                "category_id": p.category_id,
                "artist_id": p.artist_id,
                "artist_name": artist_name,
                "artist_slug": artist_slug,
                "image_url": _get_product_image_url(p.id, bool(p.image_data)),
                "featured": p.id in featured_ids,
                "year": specs["year"],
                "technique": specs["technique"],
                "materials": specs["materials"],
                "dimensions": specs["dimensions"],
            })

    total = len(items)
    paginated = items[offset : offset + limit]

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "items": paginated,
    }


@router.get("/{product_id}")
def get_product(
    product_id: int,
    lang: Optional[str] = Query(None, description="Language code (cs, en, fr, de, etc.)"),
    db: Session = Depends(get_db),
):
    """
    Detail produktu.
    Podporuje query parametr lang pro překlady (např. ?lang=en).
    """
    p = db.get(models.Product, product_id)
    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Produkt nenalezen.")
    
    # Zkontroluj, zda je produkt aktivní
    if not getattr(p, "is_active", True):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Produkt nenalezen.")

    available = get_available_stock(db, p.id)
    featured_ids = _load_featured_ids()
    specs_store = _load_product_specs_store()
    specs = _read_product_specs_from_store(specs_store, p.id)
    if lang and lang != "cs":
        specs_translation = get_product_specs_translation(p.id, lang)
        if specs_translation.get("technique"):
            specs["technique"] = specs_translation["technique"]
        if specs_translation.get("materials"):
            specs["materials"] = specs_translation["materials"]

    # Default values (Czech)
    title = p.title
    description = p.description

    # If language is specified and not Czech, try to get translation
    if lang and lang != "cs":
        translation = db.query(models.ProductTranslation).filter(
            models.ProductTranslation.product_id == product_id,
            models.ProductTranslation.language_code == lang
        ).first()

        if translation:
            title = translation.title or p.title
            description = translation.description or p.description

    artist_name = p.artist.name if getattr(p, "artist", None) else None
    artist_slug = p.artist.slug if getattr(p, "artist", None) else None

    return {
        "id": p.id,
        "title": title,
        "slug": p.slug,
        "description": description,
        "price": float(p.price),
        "price_eur": float(p.price_eur) if getattr(p, "price_eur", None) is not None else None,
        "stock": int(p.stock or 0),
        "available_stock": available,
        "category_id": p.category_id,
        "artist_id": p.artist_id,
        "artist_name": artist_name,
        "artist_slug": artist_slug,
        "image_url": _get_product_image_url(p.id, bool(p.image_data)),
        "featured": p.id in featured_ids,
        "year": specs["year"],
        "technique": specs["technique"],
        "materials": specs["materials"],
        "dimensions": specs["dimensions"],
    }


@router.get("/{product_id}/available-stock")
def get_product_available_stock(
    product_id: int,
    db: Session = Depends(get_db),
):
    """
    Dostupný stock - bez měkkých rezervací.
    """
    product = db.get(models.Product, product_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Produkt nenalezen.")

    available = get_available_stock(db, product_id)

    return {
        "product_id": product_id,
        "available_stock": available,
    }


@router.get("/{product_id}/image")
def get_product_image(
    product_id: int,
    db: Session = Depends(get_db),
):
    """
    Vrátí obrázek produktu jako inline base64.
    URL: GET /api/v1/products/{product_id}/image
    """
    p = db.get(models.Product, product_id)
    if not p or not p.image_data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Obrázek nenalezen.")

    from fastapi.responses import Response
    return Response(
        content=p.image_data,
        media_type=p.image_mime_type or "image/jpeg",
    )


# ========== ADMIN ENDPOINTY ==========

@router.post("/{product_id}/image", dependencies=[Depends(require_admin)])
async def upload_product_image(
    product_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """
    Nahrát obrázek produktu (ADMIN).
    - Automaticky se zpracuje (resize, center, compress)
    - Uloží se v PostgreSQL jako BYTEA
    
    URL: POST /api/v1/products/{product_id}/image
    Body: multipart/form-data { "file": <image> }
    """
    p = db.get(models.Product, product_id)
    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Produkt nenalezen.")

    # Přečti file
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Soubor je prázdný.")

    # Zpracuj
    try:
        processed_bytes, mime_type = process_and_compress_image(file_bytes)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Chyba zpracování obrázku: {str(e)}"
        )

    # Ulož v DB
    p.image_data = processed_bytes
    p.image_filename = file.filename
    p.image_mime_type = mime_type

    db.commit()
    db.refresh(p)

    return {
        "product_id": p.id,
        "filename": p.image_filename,
        "size": len(processed_bytes),
        "mime_type": mime_type,
        "image_url": f"/api/v1/products/{p.id}/image",
    }


@router.delete("/{product_id}/image", dependencies=[Depends(require_admin)])
def delete_product_image(
    product_id: int,
    db: Session = Depends(get_db),
):
    """
    Smazat obrázek produktu (ADMIN).
    """
    p = db.get(models.Product, product_id)
    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Produkt nenalezen.")

    p.image_data = None
    p.image_filename = None
    p.image_mime_type = None

    db.commit()

    return {"ok": True, "product_id": p.id}
