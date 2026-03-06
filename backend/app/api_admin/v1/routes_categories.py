# app/api_admin/v1/routes_categories.py
from __future__ import annotations
from typing import Optional, List
import asyncio
import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Path, Query, status, Response, Request
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.deps import get_db, require_admin
from app.db import models
from app.db.session import SessionLocal
from app.services.translation_helper import auto_translate_category
from app.services.translation_service import translation_service
from app.services.text_utils import to_plain_text

router = APIRouter(prefix="/categories", tags=["admin: categories"])
logger = logging.getLogger(__name__)


def _get_translated_name(category: models.Category, lang: Optional[str], db: Session) -> str:
    """
    Return translated name for admin listing; translates on-demand and stores result.
    """
    base = to_plain_text(category.name) if category.name else ""
    base = (base or "").strip()
    if not lang or lang == "cs" or not base:
        return base

    tr = (
        db.query(models.CategoryTranslation)
        .filter(
            models.CategoryTranslation.category_id == category.id,
            models.CategoryTranslation.language_code == lang,
        )
        .first()
    )
    if tr and tr.name:
        translated = to_plain_text(tr.name) or base
        if translated.strip():
            return translated.strip()

    if not translation_service.api_key:
        return base

    try:
        translated = asyncio.run(
            translation_service.translate_text(
                base,
                target_lang=lang,
                source_lang="cs",
            )
        )
        translated_clean = (to_plain_text(translated) or base).strip()
    except Exception as e:  # noqa: BLE001
        logger.error("Admin category translation failed for %s -> %s: %s", category.id, lang, e)
        return base

    if not translated_clean:
        return base

    try:
        if tr:
            tr.name = translated_clean
        else:
            db.add(
                models.CategoryTranslation(
                    category_id=category.id,
                    language_code=lang,
                    name=translated_clean,
                )
            )
        db.commit()
    except Exception as e:  # noqa: BLE001
        db.rollback()
        logger.error("Failed to persist admin category translation %s -> %s: %s", category.id, lang, e)

    return translated_clean

# Background task wrapper for translations
async def translate_category_background(category_id: int, name: str):
    """Background task to translate category without blocking the response."""
    db = SessionLocal()
    try:
        await auto_translate_category(db=db, category_id=category_id, name=name)
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"[TRANSLATION] Error translating category {category_id}: {e}")
    finally:
        db.close()

# ---- LIST (s filtrem & stránkováním) ----
@router.get("/", dependencies=[Depends(require_admin)])
def admin_list_categories(
    lang: Optional[str] = Query(None, description="Language code (cs, en, de, ...)"),
    q: Optional[str] = Query(None, description="Fulltext: name/slug"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    request: Request = None,
    db: Session = Depends(get_db),
):
    if not lang and request:
        accept = (request.headers.get("accept-language") or "").split(",")[0].strip().lower()
        lang = accept[:2] if accept else None
    query = db.query(models.Category)
    if q:
        q_like = f"%{q}%"
        query = query.filter(
            (models.Category.name.ilike(q_like)) | (models.Category.slug.ilike(q_like))
        )
    total = query.count()
    rows: List[models.Category] = (
        query.order_by(models.Category.id.desc()).offset(offset).limit(limit).all()
    )
    items = [{"id": c.id, "name": _get_translated_name(c, lang, db), "slug": c.slug} for c in rows]
    return {"total": total, "limit": limit, "offset": offset, "items": items}

# ---- DETAIL ----
@router.get("/{id_or_slug}", dependencies=[Depends(require_admin)])
def admin_get_category(
    id_or_slug: str = Path(..., description="ID nebo slug kategorie"),
    lang: Optional[str] = Query(None, description="Language code (cs, en, de, ...)"),
    request: Request = None,
    db: Session = Depends(get_db),
):
    cat = None
    if id_or_slug.isdigit():
        cat = db.get(models.Category, int(id_or_slug))
    if cat is None:
        cat = db.query(models.Category).filter(models.Category.slug == id_or_slug).first()
    if cat is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kategorie nenalezena.")
    if not lang and request:
        accept = (request.headers.get("accept-language") or "").split(",")[0].strip().lower()
        lang = accept[:2] if accept else None
    return {"id": cat.id, "name": _get_translated_name(cat, lang, db), "slug": cat.slug}

# ---- CREATE ----
@router.post("/", status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_admin)])
async def admin_create_category(
    payload: dict,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Vytvoření kategorie (admin).
    Očekává JSON: { "name": str, "slug": str }
    """
    try:
        name = to_plain_text(payload.get("name") or "").strip()
        slug = (payload.get("slug") or "").strip()
        if not name or not slug:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="name a slug jsou povinné.")

        new_cat = models.Category(name=name, slug=slug)
        db.add(new_cat)
        db.commit()
        db.refresh(new_cat)

        # Auto translate into all languages (synchronously to have translations ready immediately)
        await auto_translate_category(db=db, category_id=new_cat.id, name=new_cat.name)

        return {"id": new_cat.id, "name": new_cat.name, "slug": new_cat.slug}

    except HTTPException:
        db.rollback()
        raise
    except IntegrityError as ie:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Kategorie se stejným 'name' nebo 'slug' už existuje.",
        ) from ie
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Chyba při vytváření kategorie: {e}",
        ) from e

# ---- UPDATE (PATCH-like) ----
@router.patch("/{id}", dependencies=[Depends(require_admin)])
async def admin_update_category(
    id: int,
    payload: dict,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    cat = db.get(models.Category, id)
    if not cat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kategorie nenalezena.")

    try:
        name_updated = False
        if "name" in payload and payload["name"] is not None:
            cat.name = to_plain_text(payload["name"]).strip()
            name_updated = True
        if "slug" in payload and payload["slug"] is not None:
            cat.slug = str(payload["slug"]).strip()

        db.commit()
        db.refresh(cat)

        if name_updated:
            # Přelož hned, aby byly překlady dostupné okamžitě
            await auto_translate_category(db=db, category_id=cat.id, name=cat.name)

        return {"id": cat.id, "name": cat.name, "slug": cat.slug}

    except IntegrityError as ie:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Kategorie se stejným 'name' nebo 'slug' už existuje.",
        ) from ie
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Chyba při úpravě kategorie: {e}",
        ) from e

# ---- DELETE (bezpečné, 204 No Content) ----
@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_admin)])
def admin_delete_category(id: int, db: Session = Depends(get_db)):
    """
    Smaže kategorii bezpečně:
    - nejdřív u produktů v této kategorii nastaví `category_id = NULL` (uvolnění FK),
    - poté smaže kategorii.
    Vrací 204 No Content (žádné tělo).
    """
    cat = db.get(models.Category, id)
    if not cat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kategorie nenalezena.")

    # uvolni FK vazby (pro případ, že není ON DELETE SET NULL)
    db.query(models.Product).filter(models.Product.category_id == id).update(
        {models.Product.category_id: None}
    )

    db.delete(cat)
    db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)
