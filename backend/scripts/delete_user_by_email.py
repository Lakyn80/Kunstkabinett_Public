#!/usr/bin/env python
from __future__ import annotations
from pathlib import Path
import sys
import argparse

# === přidej do sys.path kořen backendu, aby šlo importovat "app.*" ===
BACKEND_ROOT = Path(__file__).resolve().parents[1]  # .../backend
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

# Načti .env (kvůli DATABASE_URL)
try:
    from dotenv import load_dotenv
    ENV_PATH = BACKEND_ROOT / ".env"
    load_dotenv(dotenv_path=ENV_PATH, override=True)
except Exception:
    pass

from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.db import models

def delete_user_by_email(email: str) -> dict:
    with SessionLocal() as db:
        u = db.query(models.User).filter(models.User.email == email).first()
        if not u:
            return {"ok": False, "message": f"Uživatel s emailem {email} nenalezen."}
        uid = u.id
        db.delete(u)
        db.commit()
        return {"ok": True, "message": f"Smazán uživatel id={uid} email={email}"}

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Delete user by email.")
    parser.add_argument("--email", required=True, help="Email uživatele ke smazání")
    args = parser.parse_args()
    res = delete_user_by_email(args.email)
    print(("[OK] " if res["ok"] else "[WARN] ") + res["message"])
