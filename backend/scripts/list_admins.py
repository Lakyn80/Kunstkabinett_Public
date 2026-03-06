#!/usr/bin/env python
"""
Skript pro výpis všech admin uživatelů.
"""
from __future__ import annotations
from pathlib import Path
import sys

# přidej backend do sys.path
BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

# načti .env
try:
    from dotenv import load_dotenv
    ENV_PATH = BACKEND_ROOT / ".env"
    # override=False zajišťuje, že Docker environment má přednost
    load_dotenv(dotenv_path=ENV_PATH, override=False)
except Exception:
    pass

from app.db.session import SessionLocal
from app.db import models

def list_admins():
    """Vypíše všechny admin uživatele."""
    with SessionLocal() as db:
        admins = db.query(models.User).filter(models.User.is_admin == True).all()

        if not admins:
            print("Žádní admin uživatelé nebyli nalezeni.")
            return

        print(f"Nalezeno {len(admins)} admin uživatelů:")
        print("-" * 60)
        for user in admins:
            print(f"ID: {user.id:3d} | Email: {user.email}")
        print("-" * 60)

if __name__ == "__main__":
    list_admins()
