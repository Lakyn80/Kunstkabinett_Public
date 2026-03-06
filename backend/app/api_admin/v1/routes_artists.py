from __future__ import annotations
from typing import Optional, List, Dict, Any
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Path, Query, status, BackgroundTasks
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.core.deps import get_db, require_admin
from app.db import models
from app.db.session import SessionLocal
from app.services.artist_filters import apply_lastname_filters, last_name_expression
from app.services.translation_helper import auto_translate_artist
from app.services.text_utils import to_plain_text

router = APIRouter(prefix="/artists", tags=["admin: artists"])


# Background task wrapper for translations
async def translate_artist_background(artist_id: int, name: str, bio: str = None):
    """Background task to translate artist without blocking the response."""
    db = SessionLocal()
    try:
        print(f"[TRANSLATION] Starting translation for artist {artist_id}: name='{name}', bio='{bio}'")
        await auto_translate_artist(
            db=db,
            artist_id=artist_id,
            name=name,
            bio=bio
        )
        print(f"[TRANSLATION] Successfully translated artist {artist_id}")
    except Exception as e:
        print(f"[TRANSLATION] Error in background translation for artist {artist_id}: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

def _serialize(a: models.Artist) -> Dict[str, Any]:
    return {
        "id": a.id,
        "name": a.name,
        "slug": a.slug,
        "bio": a.bio,
        "portrait_url": a.portrait_url,
        "website": a.website,
        "instagram": a.instagram,
        "facebook": a.facebook,
        "products_count": len(a.products or []),
    }

@router.get("/", dependencies=[Depends(require_admin)])
def admin_list_artists(
    q: Optional[str] = Query(None),
    filter_lastname: Optional[str] = Query(None),
    filter_letter: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    last_name_expr = last_name_expression()
    query = db.query(models.Artist)
    if q:
        like = f"%{q}%"
        query = query.filter((models.Artist.name.ilike(like)) | (models.Artist.slug.ilike(like)))
    query = apply_lastname_filters(query, last_name_expr, filter_lastname, filter_letter)
    total = query.count()
    rows = (
        query.order_by(last_name_expr.asc(), models.Artist.name.asc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return {"total": total, "limit": limit, "offset": offset, "items": [_serialize(a) for a in rows]}

# ---- TRANSLATIONS (MUST be before /{id_or_slug} to avoid route conflicts) ----
@router.get("/{id}/translations", dependencies=[Depends(require_admin)])
def get_artist_translations(id: int, db: Session = Depends(get_db)):
    """Get all translations for an artist."""
    artist = db.get(models.Artist, id)
    if not artist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artist not found.")
    
    translations = db.query(models.ArtistTranslation).filter(
        models.ArtistTranslation.artist_id == id
    ).all()
    
    result = {}
    for t in translations:
        result[t.language_code] = {
            "language_code": t.language_code,
            "name": t.name,
            "bio": t.bio
        }
    
    return result


@router.post("/{id}/translations/{lang_code}", dependencies=[Depends(require_admin)])
async def create_or_update_translation(
    id: int,
    lang_code: str,
    payload: dict,
    db: Session = Depends(get_db),
):
    """Create or update translation for a specific language."""
    artist = db.get(models.Artist, id)
    if not artist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artist not found.")
    
    if lang_code == "cs":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot create translation for source language (cs). Edit the artist directly."
        )
    
    data = dict(payload)
    name = to_plain_text(data.get("name") or "").strip()
    bio = to_plain_text(data.get("bio"))
    
    if not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Name is required.")
    
    # Check if translation exists
    translation = db.query(models.ArtistTranslation).filter(
        models.ArtistTranslation.artist_id == id,
        models.ArtistTranslation.language_code == lang_code
    ).first()
    
    if translation:
        translation.name = name
        translation.bio = bio
    else:
        translation = models.ArtistTranslation(
            artist_id=id,
            language_code=lang_code,
            name=name,
            bio=bio
        )
        db.add(translation)
    
    try:
        db.commit()
        db.refresh(translation)
        return {
            "language_code": translation.language_code,
            "name": translation.name,
            "bio": translation.bio
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
    artist = db.get(models.Artist, id)
    if not artist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artist not found.")
    
    translation = db.query(models.ArtistTranslation).filter(
        models.ArtistTranslation.artist_id == id,
        models.ArtistTranslation.language_code == lang_code
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

@router.get("/{id_or_slug}", dependencies=[Depends(require_admin)])
def admin_get_artist(
    id_or_slug: str,
    db: Session = Depends(get_db),
):
    a = None
    if id_or_slug.isdigit():
        a = db.get(models.Artist, int(id_or_slug))
    if a is None:
        a = db.query(models.Artist).filter(models.Artist.slug == id_or_slug).first()
    if a is None:
        raise HTTPException(404, "Umělec nenalezen.")
    return _serialize(a)

@router.post("/", status_code=201, dependencies=[Depends(require_admin)])
async def admin_create_artist(
    payload: dict,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    try:
        data = dict(payload)
        name = to_plain_text(data.get("name") or "").strip()
        slug = (data.get("slug") or "").strip()
        if not name or not slug:
            raise HTTPException(400, "Pole 'name' a 'slug' jsou povinná.")

        a = models.Artist(
            name=name,
            slug=slug,
            bio=to_plain_text(data.get("bio")),
            portrait_url=data.get("portrait_url"),
            website=data.get("website"),
            instagram=data.get("instagram"),
            facebook=data.get("facebook"),
        )
        db.add(a)
        db.commit()
        db.refresh(a)

        # Automaticky přelož name a bio do všech jazyků (na pozadí)
        print(f"[ARTIST CREATE] Adding translation task for artist {a.id}: name='{a.name}', bio='{a.bio}'")
        background_tasks.add_task(
            translate_artist_background,
            a.id,
            a.name,
            a.bio
        )
        print(f"[ARTIST CREATE] Translation task added for artist {a.id}")

        return _serialize(a)
    except IntegrityError as ie:
        db.rollback()
        raise HTTPException(409, "Umělec se stejným 'slug' již existuje.") from ie

@router.patch("/{id}", dependencies=[Depends(require_admin)])
async def admin_update_artist(
    id: int,
    payload: dict,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    a = db.get(models.Artist, id)
    if not a:
        raise HTTPException(404, "Umělec nenalezen.")
    data = dict(payload)
    
    # Track if name or bio changed
    needs_translation = False
    if "name" in data or "bio" in data:
        needs_translation = True
    
    for k in ("name", "slug", "bio", "portrait_url", "website", "instagram", "facebook"):
        if k in data:
            if k == "bio":
                setattr(a, k, to_plain_text(data[k]))
            elif k == "name":
                setattr(a, k, to_plain_text(data[k]))
            else:
                setattr(a, k, data[k])
    try:
        db.commit()
        db.refresh(a)

        # Pokud se změnil name nebo bio, přelož do všech jazyků (na pozadí)
        if needs_translation:
            print(f"[ARTIST UPDATE] Adding translation task for artist {a.id}: name='{a.name}', bio='{a.bio}'")
            background_tasks.add_task(
                translate_artist_background,
                a.id,
                a.name,
                a.bio
            )
            print(f"[ARTIST UPDATE] Translation task added for artist {a.id}")

        return _serialize(a)
    except IntegrityError as ie:
        db.rollback()
        raise HTTPException(409, "Umělec se stejným 'slug' již existuje.") from ie

@router.delete("/{id}", status_code=204, dependencies=[Depends(require_admin)])
def admin_delete_artist(
    id: int,
    db: Session = Depends(get_db),
):
    a = db.get(models.Artist, id)
    if not a:
        raise HTTPException(404, "Umělec nenalezen.")
    # nebudeme mazat produkty; FK je SET NULL
    db.delete(a)
    db.commit()
    return
