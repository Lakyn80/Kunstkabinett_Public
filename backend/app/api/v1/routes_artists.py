from __future__ import annotations

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request, status
from sqlalchemy.orm import Session

from app.core.deps import get_db
from app.db import models
from app.services.artist_filters import apply_lastname_filters, last_name_expression
from app.services.text_utils import to_plain_text

router = APIRouter(prefix="/artists", tags=["artists"])


def _serialize_artist(a: models.Artist, with_counts: bool = False) -> Dict[str, Any]:
    item = {
        "id": a.id,
        "name": a.name,
        "slug": a.slug,
        "bio": a.bio,
        "portrait_url": a.portrait_url,
        "website": a.website,
        "instagram": a.instagram,
        "facebook": a.facebook,
    }
    if with_counts:
        item["products_count"] = len(a.products or [])
    return item


def _apply_translation(
    artist: models.Artist,
    translation: Optional[models.ArtistTranslation],
) -> models.Artist:
    if not translation:
        return artist

    class _Tmp:
        pass

    clone = _Tmp()
    clone.__dict__.update(artist.__dict__)
    # Zachovej navázané produkty, aby _serialize_artist mohl spočítat products_count
    clone.products = getattr(artist, "products", []) or []
    clone.name = to_plain_text(translation.name) or artist.name
    clone.bio = to_plain_text(translation.bio) if translation.bio else artist.bio
    return clone


@router.get("/", response_model=List[dict])
def list_artists(
    q: Optional[str] = Query(None, description="Fulltext: name/slug"),
    limit: int = Query(15, ge=1, le=100),
    offset: int = Query(0, ge=0),
    filter_lastname: Optional[str] = Query(None),
    filter_letter: Optional[str] = Query(None),
    lang: Optional[str] = Query(None, description="Language code (cs, en, de, ...)"),
    request: Request = None,
    db: Session = Depends(get_db),
):
    last_name_expr = last_name_expression()
    query = db.query(models.Artist)
    if q:
        like = f"%{q}%"
        query = query.filter((models.Artist.name.ilike(like)) | (models.Artist.slug.ilike(like)))
    query = apply_lastname_filters(query, last_name_expr, filter_lastname, filter_letter)
    rows = (
        query.order_by(last_name_expr.asc(), models.Artist.name.asc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    if not lang and request:
        accept = (request.headers.get("accept-language") or "").split(",")[0].strip().lower()
        lang = accept[:2] if accept else None

    translations_by_artist: Dict[int, models.ArtistTranslation] = {}
    if lang and lang != "cs" and rows:
        trans_rows = (
            db.query(models.ArtistTranslation)
            .filter(
                models.ArtistTranslation.artist_id.in_([a.id for a in rows]),
                models.ArtistTranslation.language_code == lang,
            )
            .all()
        )
        translations_by_artist = {t.artist_id: t for t in trans_rows}

    return [
        _serialize_artist(_apply_translation(a, translations_by_artist.get(a.id)), with_counts=True)
        for a in rows
    ]


@router.get("/{id_or_slug}", response_model=dict)
def get_artist(
    id_or_slug: str = Path(..., description="ID nebo slug"),
    lang: Optional[str] = Query(None, description="Language code (cs, en, de, ...)"),
    request: Request = None,
    db: Session = Depends(get_db),
):
    a = None
    if id_or_slug.isdigit():
        a = db.get(models.Artist, int(id_or_slug))
    if a is None:
        a = db.query(models.Artist).filter(models.Artist.slug == id_or_slug).first()
    if a is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Umelec nenalezen.")

    if not lang and request:
        accept = (request.headers.get("accept-language") or "").split(",")[0].strip().lower()
        lang = accept[:2] if accept else None

    translation = None
    if lang and lang != "cs":
        translation = (
            db.query(models.ArtistTranslation)
            .filter(
                models.ArtistTranslation.artist_id == a.id,
                models.ArtistTranslation.language_code == lang,
            )
            .first()
        )

    return _serialize_artist(_apply_translation(a, translation), with_counts=True)


@router.get("/{id_or_slug}/products", response_model=List[dict])
def list_artist_products(
    id_or_slug: str,
    db: Session = Depends(get_db),
):
    a = None
    if id_or_slug.isdigit():
        a = db.get(models.Artist, int(id_or_slug))
    if a is None:
        a = db.query(models.Artist).filter(models.Artist.slug == id_or_slug).first()
    if a is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Umelec nenalezen.")

    # Filter only active products
    prods = db.query(models.Product).filter(
        models.Product.artist_id == a.id,
        models.Product.is_active == True,
    ).order_by(models.Product.id.desc()).all()

    from app.api.v1.routes_products import _get_product_image_url

    out = []
    for p in prods:
        out.append({
            "id": p.id,
            "title": p.title,
            "slug": p.slug,
            "description": p.description,
            "price": float(p.price),
            "price_eur": float(p.price_eur) if getattr(p, "price_eur", None) is not None else None,
            "stock": int(p.stock or 0),
            "category_id": p.category_id,
            "artist_id": p.artist_id,
            "image_url": _get_product_image_url(p.id, bool(p.image_data)),
        })
    return out
