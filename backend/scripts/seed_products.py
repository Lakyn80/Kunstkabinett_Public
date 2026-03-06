#!/usr/bin/env python
from __future__ import annotations
from pathlib import Path
import sys
import os
from decimal import Decimal

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

try:
    from dotenv import load_dotenv
    ENV_PATH = BACKEND_ROOT / ".env"
    load_dotenv(dotenv_path=ENV_PATH, override=True)
except Exception:
    pass

from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.db import models

CATEGORIES = [
    {"name": "Malba", "slug": "malba"},
    {"name": "Grafika", "slug": "grafika"},
    {"name": "Skulptura", "slug": "skulptura"},
    {"name": "Fotografie", "slug": "fotografie"},
    {"name": "Keramika", "slug": "keramika"},
]

ARTISTS = [
    {"name": "Jan Novák", "slug": "jan-novak"},
    {"name": "Marie Svobodová", "slug": "marie-svobodova"},
    {"name": "Petr Kučera", "slug": "petr-kucera"},
    {"name": "Anna Šimková", "slug": "anna-simkova"},
    {"name": "David Horák", "slug": "david-horak"},
]

PRODUCT_TEMPLATES = [
    {"title": "Abstraktní kompozice I", "description": "Moderní abstraktní olejomalba s živými barvami"},
    {"title": "Portrét v tónech", "description": "Psychologický portrét v grafitě a tužce"},
    {"title": "Geometrické tvary", "description": "Minimalistická skulptura z bronzu"},
    {"title": "Krajina s domem", "description": "Fotografie starého venkovského domu"},
    {"title": "Keramická váza I", "description": "Ručně vyráběná keramická váza"},
    {"title": "Barvy podzimu", "description": "Olejomalba s podzimní krajinou"},
    {"title": "Rozjímání", "description": "Grafika zachycující moment meditace"},
    {"title": "Abstraktní tvar II", "description": "Experimentální skulptura ze železa"},
    {"title": "Město v noci", "description": "Noční fotografie metropolitního prostoru"},
    {"title": "Keramické desky", "description": "Sada dekorativních keramických desek"},
]

def get_image_files(seed_dir: Path) -> list[Path]:
    """Načti všechny .webp soubory"""
    if not seed_dir.exists():
        print(f"⚠️  Adresář {seed_dir} neexistuje - vytvárim bez obrázků")
        return []
    
    images = list(seed_dir.glob("**/*.webp"))  # i vnořené soubory
    print(f"✓ Nalezeno {len(images)} WebP obrázků")
    return sorted(images)

def load_image_data(image_path: Path) -> bytes:
    """Načti binární data obrázku"""
    try:
        with open(image_path, "rb") as f:
            data = f.read()
        print(f"  ✓ Načten obrázek: {image_path.name} ({len(data)} bajtů)")
        return data
    except Exception as e:
        print(f"  ✗ Chyba při čtení {image_path}: {e}")
        return None

def seed_data(db: Session, image_files: list[Path]):
    """Vytvořit všechna data"""
    
    # 1. Kategorie
    print("\n=== KATEGORIE ===")
    cats = {}
    for cat_data in CATEGORIES:
        existing = db.query(models.Category).filter(
            models.Category.slug == cat_data["slug"]
        ).first()
        
        if existing:
            print(f"⚠️  '{cat_data['name']}' už existuje")
            cats[cat_data["slug"]] = existing
        else:
            cat = models.Category(name=cat_data["name"], slug=cat_data["slug"])
            db.add(cat)
            db.flush()
            cats[cat_data["slug"]] = cat
            print(f"✅ Kategorie: {cat_data['name']}")
    db.commit()
    
    # 2. Umělci
    print("\n=== UMĚLCI ===")
    artists = {}
    for artist_data in ARTISTS:
        existing = db.query(models.Artist).filter(
            models.Artist.slug == artist_data["slug"]
        ).first()
        
        if existing:
            print(f"⚠️  '{artist_data['name']}' už existuje")
            artists[artist_data["slug"]] = existing
        else:
            artist = models.Artist(
                name=artist_data["name"],
                slug=artist_data["slug"],
                bio=f"Tvůrce s pasí pro umění"
            )
            db.add(artist)
            db.flush()
            artists[artist_data["slug"]] = artist
            print(f"✅ Umělec: {artist_data['name']}")
    db.commit()
    
    # 3. Produkty
    print("\n=== PRODUKTY ===")
    cat_list = list(cats.values())
    artist_list = list(artists.values())
    
    for i in range(30):
        template = PRODUCT_TEMPLATES[i % len(PRODUCT_TEMPLATES)]
        category = cat_list[i % len(cat_list)]
        artist = artist_list[i % len(artist_list)]
        
        slug = f"{template['title'].lower().replace(' ', '-')}-{i+1}"
        title = f"{template['title']} #{i+1}"
        
        # Zkontroluj, jestli existuje
        existing = db.query(models.Product).filter(
            models.Product.slug == slug
        ).first()
        
        if existing:
            print(f"⚠️  Produkt '{title}' už existuje")
            continue
        
        # Obrázek
        image_data = None
        image_filename = None
        
        if image_files:
            img_path = image_files[i % len(image_files)]
            image_data = load_image_data(img_path)
            image_filename = img_path.name
        
        price = Decimal("1000.00") + Decimal(str((i % 10) * 100))
        
        product = models.Product(
            title=title,
            slug=slug,
            description=template["description"],
            price=price,
            stock=10 + (i % 5),
            category_id=category.id,
            artist_id=artist.id,
            image_data=image_data,
            image_filename=image_filename,
            image_mime_type="image/webp" if image_data else None,
        )
        db.add(product)
        print(f"✅ Produkt #{i+1}: {title} - {price} CZK")
    
    db.commit()
    print(f"\n✅ Všechny produkty uloženy!")

def main():
    db = SessionLocal()
    
    try:
        print("🌱 SEED: Kategorie, Umělci, Produkty s obrázky\n")
        
        # Načti obrázky
        seed_dir = BACKEND_ROOT / "seed_images"
        image_files = get_image_files(seed_dir)
        
        # Vytvoř data
        seed_data(db, image_files)
        
        print("\n" + "="*50)
        print("✅ SEED HOTOV!")
        print("="*50)
        
    except Exception as e:
        db.rollback()
        print(f"\n❌ CHYBA: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    main()