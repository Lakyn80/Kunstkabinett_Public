#!/usr/bin/env python
"""
Skript pro přeložení všech existujících umělců do všech podporovaných jazyků.
Používá DeepSeek API pro automatické překlady.
"""
from __future__ import annotations
import sys
import asyncio
from pathlib import Path

# Přidej backend root do path
BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

try:
    from dotenv import load_dotenv
    ENV_PATH = BACKEND_ROOT / ".env"
    load_dotenv(dotenv_path=ENV_PATH, override=False)
except Exception:
    pass

from app.db.session import SessionLocal
from app.db import models
from app.services.translation_helper import auto_translate_artist

async def translate_all_artists():
    """Přeloží všechny existující umělce do všech podporovaných jazyků."""
    db = SessionLocal()
    try:
        # Načti všechny umělce
        artists = db.query(models.Artist).all()
        total = len(artists)
        
        print(f"Našel jsem {total} umělců k přeložení.\n")
        
        for idx, artist in enumerate(artists, 1):
            print(f"[{idx}/{total}] Překládám umělce #{artist.id}: {artist.name}")
            
            try:
                await auto_translate_artist(
                    db=db,
                    artist_id=artist.id,
                    name=artist.name,
                    bio=artist.bio
                )
                print(f"  ✅ Úspěšně přeloženo\n")
            except Exception as e:
                print(f"  ❌ Chyba při překládání: {e}\n")
        
        print(f"\n✅ Hotovo! Přeloženo {total} umělců.")
        
    except Exception as e:
        print(f"❌ Kritická chyba: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(translate_all_artists())


