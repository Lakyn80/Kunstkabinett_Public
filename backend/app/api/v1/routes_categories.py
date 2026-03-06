from typing import List, Optional
import asyncio
import logging
from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.db.session import SessionLocal
from app.db import models
from app.api.v1.schemas_categories import CategoryCreate, CategoryOut
from app.services.text_utils import to_plain_text
from app.services.translation_service import translation_service

router = APIRouter(prefix="/categories", tags=["categories"])
logger = logging.getLogger(__name__)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _get_translated_name(category: models.Category, lang: Optional[str], db: Session) -> str:
    """
    Vrátí přeložený název a chybějící překlad uloží, aby se nevolalo API opakovaně.
    """
    base_name = to_plain_text(category.name) if category.name else ""
    base_name = (base_name or "").strip()
    if not lang or lang == "cs" or not base_name:
        return base_name

    tr = (
        db.query(models.CategoryTranslation)
        .filter(
            models.CategoryTranslation.category_id == category.id,
            models.CategoryTranslation.language_code == lang,
        )
        .first()
    )
    if tr and tr.name:
        translated = to_plain_text(tr.name) or base_name
        if translated.strip():
            return translated.strip()

    if not translation_service.api_key:
        return base_name

    try:
        translated = asyncio.run(
            translation_service.translate_text(
                base_name,
                target_lang=lang,
                source_lang="cs",
            )
        )
        translated_clean = (to_plain_text(translated) or base_name).strip()
    except Exception as e:
        logger.error("Category translation failed for %s -> %s: %s", category.id, lang, e)
        return base_name

    if not translated_clean:
        return base_name

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
    except Exception as e:
        db.rollback()
        logger.error("Failed to persist category translation %s -> %s: %s", category.id, lang, e)

    return translated_clean

@router.get("/", response_model=List[CategoryOut])
def list_categories(
    lang: Optional[str] = Query(None, description="Language code (cs, en, de, ...)"),
    request: Request = None,
    db: Session = Depends(get_db),
):
    rows: List[models.Category] = db.query(models.Category).order_by(models.Category.id.desc()).all()

    if not lang and request:
        accept = (request.headers.get("accept-language") or "").split(",")[0].strip().lower()
        lang = accept[:2] if accept else None

    out: List[dict] = []
    for c in rows:
        name = _get_translated_name(c, lang, db)
        out.append({"id": c.id, "name": name, "slug": c.slug})
    return out

@router.get("/{id_or_slug}", response_model=CategoryOut)
def get_category(
    id_or_slug: str = Path(..., description="ID nebo slug kategorie"),
    lang: Optional[str] = Query(None, description="Language code (cs, en, de, ...)"),
    request: Request = None,
    db: Session = Depends(get_db),
):
    # zkusíme číslo (id), jinak slug
    category = None
    if id_or_slug.isdigit():
        category = db.query(models.Category).get(int(id_or_slug))
    if category is None:
        category = db.query(models.Category).filter(models.Category.slug == id_or_slug).first()

    if category is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kategorie nenalezena.")

    if not lang and request:
        accept = (request.headers.get("accept-language") or "").split(",")[0].strip().lower()
        lang = accept[:2] if accept else None

    name = _get_translated_name(category, lang, db)
    return {"id": category.id, "name": name, "slug": category.slug}

@router.post("/", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
def create_category(payload: CategoryCreate, db: Session = Depends(get_db)):
    try:
        cat = models.Category(**payload.model_dump())
        db.add(cat)
        db.commit()
        db.refresh(cat)
        return cat
    except IntegrityError as ie:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Kategorie se stejným 'slug' nebo 'name' už existuje.",
        ) from ie
