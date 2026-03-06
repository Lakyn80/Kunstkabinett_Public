from __future__ import annotations
from datetime import datetime, timezone
from typing import Optional, List
import re
import unicodedata

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.core.deps import get_db, require_admin
from app.db import models  # BlogPost
from app.db.session import SessionLocal
from app.services.translation_helper import auto_translate_blog_post

router = APIRouter(prefix="/blog", tags=["admin: blog"])

ALLOWED_STATUSES = {"draft", "published"}


# Background task wrapper for translations
async def translate_blog_post_background(blog_post_id: int, title: str, content: str = None):
    """Background task to translate blog post without blocking the response."""
    db = SessionLocal()
    try:
        await auto_translate_blog_post(
            db=db,
            blog_post_id=blog_post_id,
            title=title,
            content=content
        )
    except Exception as e:
        print(f"Error in background translation: {e}")
    finally:
        db.close()


# ---------- SLUG GENERATOR ----------
def _generate_slug(title: str) -> str:
    """Generuj slug z titulu: 'Můj Článek' -> 'muj-clanek'"""
    if not title:
        return ""
    
    # Normalizuj unicode (háčky, čárky)
    slug = unicodedata.normalize('NFKD', title)
    slug = slug.encode('ascii', 'ignore').decode('ascii')
    
    # Převeď na lowercase a nahraď mezery a special chars pomlčkami
    slug = re.sub(r'[^\w\s-]', '', slug).strip()
    slug = re.sub(r'[-\s]+', '-', slug)
    slug = slug.lower()
    
    return slug


# -------- LIST --------
@router.get("/", dependencies=[Depends(require_admin)])
def admin_list_posts(
    q: Optional[str] = Query(None, description="Fulltext: title/content"),
    status_filter: Optional[str] = Query(None, description="draft|published"),
    published_after: Optional[datetime] = Query(None),
    published_before: Optional[datetime] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    qset = db.query(models.BlogPost)
    conds = []

    if q:
        like = f"%{q}%"
        conds.append(
            (models.BlogPost.title.ilike(like)) |
            (models.BlogPost.content.ilike(like))
        )

    if status_filter:
        sf = status_filter.lower()
        if sf not in ALLOWED_STATUSES:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Neplatný status (draft|published).")
        conds.append(models.BlogPost.status == sf)

    if published_after:
        conds.append(models.BlogPost.published_at != None)  # noqa: E711
        conds.append(models.BlogPost.published_at >= published_after)
    if published_before:
        conds.append(models.BlogPost.published_at != None)  # noqa: E711
        conds.append(models.BlogPost.published_at <= published_before)

    if conds:
        qset = qset.filter(and_(*conds))

    total = qset.count()
    rows: List[models.BlogPost] = (
        qset.order_by(models.BlogPost.published_at.desc().nullslast(), models.BlogPost.id.desc())
            .offset(offset).limit(limit).all()
    )
    items = [
        {
            "id": r.id,
            "title": r.title,
            "slug": r.slug,
            "content": r.content,
            "cover_url": r.cover_url,
            "status": r.status,
            "published_at": r.published_at,
        } for r in rows
    ]
    return {"total": total, "limit": limit, "offset": offset, "items": items}

# -------- DETAIL pouze ID --------
@router.get("/{id}", dependencies=[Depends(require_admin)])
def admin_get_post(
    id: int = Path(..., description="ID článku"),
    db: Session = Depends(get_db),
):
    post = db.get(models.BlogPost, id)
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Článek nenalezen.")
    return {
        "id": post.id,
        "title": post.title,
        "slug": post.slug,
        "content": post.content,
        "cover_url": post.cover_url,
        "status": post.status,
        "published_at": post.published_at,
    }

# -------- CREATE --------
@router.post("/", status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_admin)])
async def admin_create_post(payload: dict, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """
    Vytvoření článku.
    Očekává JSON: { title, content, cover_url, status(draft|published), published_at?, slug? }
    - Slug se auto-generuje z title pokud není zadán
    - Pokud status='published' a není published_at, nastaví se na nyní (UTC).
    - Automaticky přeloží title a content do všech jazyků.
    """
    title = (payload.get("title") or "").strip()
    content = payload.get("content")
    cover_url = payload.get("cover_url")
    status_val = (payload.get("status") or "draft").lower()
    slug = (payload.get("slug") or "").strip()

    if not title:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="title je povinné.")
    if status_val not in ALLOWED_STATUSES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="status musí být draft|published.")

    # Generuj slug pokud není zadán
    if not slug:
        slug = _generate_slug(title)

    # Zkontroluj aby slug nebyl duplicitní
    existing = db.query(models.BlogPost).filter(models.BlogPost.slug == slug).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Slug '{slug}' je již použitý.")

    published_at = payload.get("published_at")
    if status_val == "published" and not published_at:
        published_at = datetime.now(timezone.utc)

    post = models.BlogPost(
        title=title,
        slug=slug,
        content=content,
        cover_url=cover_url,
        status=status_val,
        published_at=published_at,
    )
    db.add(post)
    db.commit()
    db.refresh(post)

    # Automaticky přelož title a content do všech jazyků (na pozadí)
    background_tasks.add_task(
        translate_blog_post_background,
        post.id,
        post.title,
        post.content
    )

    return {
        "id": post.id,
        "title": post.title,
        "slug": post.slug,
        "content": post.content,
        "cover_url": post.cover_url,
        "status": post.status,
        "published_at": post.published_at,
    }

# -------- UPDATE (PATCH + PUT) --------
@router.api_route("/{id}", methods=["PATCH", "PUT"], dependencies=[Depends(require_admin)])
async def admin_update_post(
    id: int,
    payload: dict,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    post = db.get(models.BlogPost, id)
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Článek nenalezen.")
    try:
        needs_translation = False

        # Aktualizuj title (a možná i slug)
        if "title" in payload and payload["title"] is not None:
            new_title = payload["title"].strip()
            post.title = new_title
            needs_translation = True

            # Pokud se změnil title a slug nebyl explicitně zadán, regeneruj slug
            if "slug" not in payload:
                new_slug = _generate_slug(new_title)
                existing = db.query(models.BlogPost).filter(
                    models.BlogPost.slug == new_slug,
                    models.BlogPost.id != id
                ).first()
                if not existing:
                    post.slug = new_slug

        # Aktualizuj ostatní povolená pole
        for k in ["content", "cover_url"]:
            if k in payload and payload[k] is not None:
                setattr(post, k, payload[k])
                if k == "content":
                    needs_translation = True

        # Explicitně zadaný slug
        if "slug" in payload and payload["slug"] is not None:
            new_slug = payload["slug"].strip()
            existing = db.query(models.BlogPost).filter(
                models.BlogPost.slug == new_slug,
                models.BlogPost.id != id
            ).first()
            if existing:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Slug '{new_slug}' je již použitý.")
            post.slug = new_slug

        # status/published_at logika
        if "status" in payload and payload["status"] is not None:
            s = str(payload["status"]).lower()
            if s not in ALLOWED_STATUSES:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="status musí být draft|published.")
            if post.status != "published" and s == "published":
                post.published_at = post.published_at or datetime.now(timezone.utc)
            if post.status == "published" and s == "draft":
                post.published_at = None
            post.status = s

        if "published_at" in payload:
            post.published_at = payload["published_at"]

        db.commit()
        db.refresh(post)

        # Pokud se změnil title nebo content, přelož do všech jazyků (na pozadí)
        if needs_translation:
            background_tasks.add_task(
                translate_blog_post_background,
                post.id,
                post.title,
                post.content
            )

        return {
            "id": post.id,
            "title": post.title,
            "slug": post.slug,
            "content": post.content,
            "cover_url": post.cover_url,
            "status": post.status,
            "published_at": post.published_at,
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Chyba při úpravě článku: {e}") from e

# -------- PUBLISH / UNPUBLISH --------
@router.post("/{id}/publish", dependencies=[Depends(require_admin)])
def admin_publish_post(id: int, db: Session = Depends(get_db)):
    post = db.get(models.BlogPost, id)
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Článek nenalezen.")
    if post.status != "published":
        post.status = "published"
        post.published_at = post.published_at or datetime.now(timezone.utc)
        db.commit()
        db.refresh(post)
    return {"id": post.id, "status": post.status, "published_at": post.published_at, "slug": post.slug}

@router.post("/{id}/unpublish", dependencies=[Depends(require_admin)])
def admin_unpublish_post(id: int, db: Session = Depends(get_db)):
    post = db.get(models.BlogPost, id)
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Článek nenalezen.")
    if post.status != "draft":
        post.status = "draft"
        post.published_at = None
        db.commit()
        db.refresh(post)
    return {"id": post.id, "status": post.status, "published_at": post.published_at, "slug": post.slug}

# -------- DELETE --------
@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_admin)])
def admin_delete_post(id: int, db: Session = Depends(get_db)):
    post = db.get(models.BlogPost, id)
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Článek nenalezen.")
    db.delete(post)
    db.commit()
    return {"ok": True}

# -------- TRANSLATIONS --------
@router.get("/{id}/translations", dependencies=[Depends(require_admin)])
def admin_get_blog_translations(id: int, db: Session = Depends(get_db)):
    """Get all translations for a blog post"""
    post = db.get(models.BlogPost, id)
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Článek nenalezen.")
    
    translations = db.query(models.BlogPostTranslation).filter(
        models.BlogPostTranslation.blog_post_id == id
    ).all()
    
    result = {}
    for trans in translations:
        result[trans.language_code] = {
            "title": trans.title,
            "content": trans.content
        }
    
    return result

@router.post("/{id}/translations/{lang_code}", dependencies=[Depends(require_admin)])
def admin_save_blog_translation(
    id: int,
    lang_code: str,
    payload: dict,
    db: Session = Depends(get_db)
):
    """Save or update a translation for a blog post"""
    post = db.get(models.BlogPost, id)
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Článek nenalezen.")
    
    # Validate language code
    valid_languages = ["en", "fr", "de", "ru", "zh", "ja", "it", "pl"]
    if lang_code not in valid_languages:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid language code. Must be one of: {', '.join(valid_languages)}"
        )
    
    title = payload.get("title", "").strip()
    content = payload.get("content")
    
    if not title:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Title is required.")
    
    # Check if translation exists
    translation = db.query(models.BlogPostTranslation).filter(
        models.BlogPostTranslation.blog_post_id == id,
        models.BlogPostTranslation.language_code == lang_code
    ).first()
    
    if translation:
        # Update existing translation
        translation.title = title
        translation.content = content
    else:
        # Create new translation
        translation = models.BlogPostTranslation(
            blog_post_id=id,
            language_code=lang_code,
            title=title,
            content=content
        )
        db.add(translation)
    
    try:
        db.commit()
        db.refresh(translation)
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save translation: {str(e)}"
        )
    
    return {
        "blog_post_id": id,
        "language_code": lang_code,
        "title": translation.title,
        "content": translation.content
    }

@router.delete("/{id}/translations/{lang_code}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_admin)])
def admin_delete_blog_translation(id: int, lang_code: str, db: Session = Depends(get_db)):
    """Delete a translation for a blog post"""
    post = db.get(models.BlogPost, id)
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Článek nenalezen.")
    
    translation = db.query(models.BlogPostTranslation).filter(
        models.BlogPostTranslation.blog_post_id == id,
        models.BlogPostTranslation.language_code == lang_code
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
