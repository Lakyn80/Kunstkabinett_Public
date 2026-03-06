#!/usr/bin/env python
from __future__ import annotations
from pathlib import Path
import sys

# === přidej do sys.path kořen backendu, aby šlo importovat "app.*" ===
BACKEND_ROOT = Path(__file__).resolve().parents[1]  # .../backend
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

# Načti .env kvůli DATABASE_URL
try:
    from dotenv import load_dotenv
    ENV_PATH = BACKEND_ROOT / ".env"
    load_dotenv(dotenv_path=ENV_PATH, override=True)
except Exception:
    pass

from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.db import models

def main():
    with SessionLocal() as db:
        rows = db.query(models.User).order_by(models.User.id.asc()).all()
        if not rows:
            print("Žádní uživatelé v DB.")
            return
        print(f"{'ID':>4}  {'E-MAIL':<40}  {'ROLE':<10}  {'is_admin':<8}  {'is_active':<9}  {'email_verified'}")
        print("-" * 90)
        for u in rows:
            role = getattr(u, "role", None)
            is_admin = getattr(u, "is_admin", None)
            is_active = getattr(u, "is_active", None)
            email_verified = getattr(u, "email_verified", None)
            print(f"{u.id:>4}  {u.email:<40}  {str(role or ''):<10}  {str(bool(is_admin)):<8}  {str(bool(is_active)):<9}  {str(bool(email_verified))}")

if __name__ == "__main__":
    main()
