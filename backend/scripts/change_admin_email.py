#!/usr/bin/env python
"""
Skript pro změnu emailu admin uživatele.
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

def change_admin_email(old_email: str, new_email: str) -> dict:
    """Změní email admin uživatele."""
    with SessionLocal() as db:
        # Najdi admin uživatele s daným emailem
        user = db.query(models.User).filter(
            models.User.email == old_email,
            models.User.is_admin == True
        ).first()

        if not user:
            return {"ok": False, "message": f"Admin s emailem {old_email} nebyl nalezen."}

        # Zkontroluj, jestli nový email už neexistuje
        existing = db.query(models.User).filter(models.User.email == new_email).first()
        if existing and existing.id != user.id:
            return {"ok": False, "message": f"Uživatel s emailem {new_email} už existuje."}

        # Změň email
        old = user.email
        user.email = new_email
        db.commit()

        return {"ok": True, "message": f"Email změněn z {old} na {new_email} (user_id={user.id})"}

if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser(description="Změň email admin uživatele.")
    p.add_argument("--old-email", required=True, help="Starý email admina")
    p.add_argument("--new-email", required=True, help="Nový email admina")
    args = p.parse_args()

    res = change_admin_email(args.old_email, args.new_email)
    print(("[OK] " if res["ok"] else "[ERROR] ") + res["message"])
