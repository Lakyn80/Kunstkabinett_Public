# app/api/v1/routes_blog.py - veřejné blog endpointy

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.deps import get_db
from app.db import models
import re

router = APIRouter(prefix="/blog", tags=["blog"])

def _generate_excerpt(content: str | None, max_length: int = 200) -> str:
    """Vygeneruje excerpt z contentu"""
    if not content:
        return ""
    # Odstraň HTML tagy
    text = re.sub(r'<[^>]+>', '', content)
    # Odstraň přebytečné mezery
    text = ' '.join(text.split())
    # Ořízni na max_length
    if len(text) > max_length:
        text = text[:max_length].rsplit(' ', 1)[0] + '...'
    return text

def _serialize_post(post: models.BlogPost, lang: Optional[str] = None, db: Optional[Session] = None) -> dict:
    """Serializuje blog post pro API s podporou překladů"""
    # Default values (Czech)
    title = post.title
    content = post.content
    
    # If language is specified and not Czech, try to get translation
    if lang and lang != "cs" and db:
        translation = db.query(models.BlogPostTranslation).filter(
            models.BlogPostTranslation.blog_post_id == post.id,
            models.BlogPostTranslation.language_code == lang
        ).first()
        if translation:
            title = translation.title or post.title
            content = translation.content or post.content
    
    return {
        "id": post.id,
        "title": title,
        "slug": post.slug,
        "content": content,
        "content_html": content,  # Pro kompatibilitu s frontendem
        "cover_url": post.cover_url,
        "status": post.status,
        "published_at": post.published_at.isoformat() if post.published_at else None,
        "excerpt": _generate_excerpt(content),
    }

@router.get("/")
def list_published_posts(
    lang: Optional[str] = Query(None, description="Language code (cs, en, fr, de, etc.)"),
    db: Session = Depends(get_db)
):
    """
    Seznam publikovaných blog příspěvků.
    Podporuje překlady pomocí parametru lang.
    """
    q = select(models.BlogPost).where(
        models.BlogPost.status == "published"
    ).order_by(
        models.BlogPost.published_at.desc().nullslast(),
        models.BlogPost.id.desc()
    )
    posts = db.scalars(q).all()
    return {"items": [_serialize_post(post, lang=lang, db=db) for post in posts]}

@router.get("/{slug}")
def get_post_by_slug(
    slug: str,
    lang: Optional[str] = Query(None, description="Language code (cs, en, fr, de, etc.)"),
    db: Session = Depends(get_db)
):
    """
    Získat blog příspěvek podle slug.
    Podporuje query parametr lang pro překlady (např. ?lang=en).
    """
    q = select(models.BlogPost).where(
        models.BlogPost.slug == slug,
        models.BlogPost.status == "published"
    )
    post = db.scalar(q)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return _serialize_post(post, lang=lang, db=db)

@router.get("/id/{post_id}")
def get_post_by_id(
    post_id: int,
    lang: Optional[str] = Query(None, description="Language code (cs, en, fr, de, etc.)"),
    db: Session = Depends(get_db)
):
    """
    Získat blog příspěvek podle ID.
    Podporuje query parametr lang pro překlady (např. ?lang=en).
    """
    q = select(models.BlogPost).where(
        models.BlogPost.id == post_id,
        models.BlogPost.status == "published"
    )
    post = db.scalar(q)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return _serialize_post(post, lang=lang, db=db)