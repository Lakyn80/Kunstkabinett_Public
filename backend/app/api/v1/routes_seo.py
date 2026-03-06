# app/api/v1/routes_seo.py
from fastapi import APIRouter, Depends
from fastapi.responses import Response, PlainTextResponse
from sqlalchemy.orm import Session
from datetime import datetime
from app.core.deps import get_db
from app.db import models

router = APIRouter(prefix="/seo", tags=["seo"])

BASE_URL = "https://kunstkabinett.cz"
SUPPORTED_LANGUAGES = ["cs", "en", "de", "fr", "ru", "zh", "ja", "it", "pl"]


@router.get("/sitemap.xml")
def sitemap_xml(db: Session = Depends(get_db)):
    """Generuje sitemap.xml pro všechny stránky a produkty"""
    urls = []
    
    # Hlavní stránky
    main_pages = [
        "",
        "/products",
        "/artists",
        "/blog",
        "/contact",
    ]
    
    for page in main_pages:
        # Přidej všechny jazykové verze
        for lang in SUPPORTED_LANGUAGES:
            urls.append({
                "loc": f"{BASE_URL}{page}?lang={lang}" if lang != "cs" else f"{BASE_URL}{page}",
                "changefreq": "daily" if page == "" else "weekly",
                "priority": "1.0" if page == "" else "0.8",
                "lastmod": datetime.utcnow().strftime("%Y-%m-%d"),
            })
    
    # Produkty (pouze aktivní)
    products = db.query(models.Product).filter(
        models.Product.is_active == True
    ).all()
    
    for product in products:
        for lang in SUPPORTED_LANGUAGES:
            urls.append({
                "loc": f"{BASE_URL}/product/{product.id}?lang={lang}" if lang != "cs" else f"{BASE_URL}/product/{product.id}",
                "changefreq": "weekly",
                "priority": "0.7",
                "lastmod": (product.updated_at or product.created_at).strftime("%Y-%m-%d") if hasattr(product, 'updated_at') else datetime.utcnow().strftime("%Y-%m-%d"),
            })
    
    # Umělci
    artists = db.query(models.Artist).all()
    for artist in artists:
        slug = artist.slug or f"id/{artist.id}"
        for lang in SUPPORTED_LANGUAGES:
            urls.append({
                "loc": f"{BASE_URL}/artist/{slug}?lang={lang}" if lang != "cs" else f"{BASE_URL}/artist/{slug}",
                "changefreq": "monthly",
                "priority": "0.6",
                "lastmod": datetime.utcnow().strftime("%Y-%m-%d"),
            })
    
    # Blog příspěvky (pouze publikované)
    blog_posts = db.query(models.BlogPost).filter(
        models.BlogPost.status == "published"
    ).all()
    for post in blog_posts:
        slug = post.slug or f"id/{post.id}"
        for lang in SUPPORTED_LANGUAGES:
            urls.append({
                "loc": f"{BASE_URL}/blog/{slug}?lang={lang}" if lang != "cs" else f"{BASE_URL}/blog/{slug}",
                "changefreq": "monthly",
                "priority": "0.5",
                "lastmod": (post.published_at or datetime.utcnow()).strftime("%Y-%m-%d") if post.published_at else datetime.utcnow().strftime("%Y-%m-%d"),
            })
    
    # Generuj XML
    xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    
    for url_data in urls:
        xml += '  <url>\n'
        xml += f'    <loc>{url_data["loc"]}</loc>\n'
        xml += f'    <changefreq>{url_data["changefreq"]}</changefreq>\n'
        xml += f'    <priority>{url_data["priority"]}</priority>\n'
        xml += f'    <lastmod>{url_data["lastmod"]}</lastmod>\n'
        xml += '  </url>\n'
    
    xml += '</urlset>'
    
    return Response(content=xml, media_type="application/xml")


@router.get("/robots.txt")
def robots_txt():
    """Generuje robots.txt"""
    content = f"""User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/
Disallow: /account/
Disallow: /checkout/
Disallow: /cart
Disallow: /login
Disallow: /register
Disallow: /reset-password

Sitemap: {BASE_URL}/api/v1/seo/sitemap.xml
"""
    return PlainTextResponse(content=content)

