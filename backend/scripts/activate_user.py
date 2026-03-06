#!/usr/bin/env python
from __future__ import annotations
from pathlib import Path
import sys
import argparse

# sys.path na backend
BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

# .env
try:
    from dotenv import load_dotenv
    load_dotenv(dotenv_path=BACKEND_ROOT / ".env", override=True)
except Exception:
    pass

from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.db import models

def activate(email: str, make_admin: bool = False) -> dict:
    with SessionLocal() as db:
        u = db.query(models.User).filter(models.User.email == email).first()
        if not u:
            return {"ok": False, "message": f"Uživatel {email} nenalezen."}

        cols = models.User.__table__.columns.keys()

        if "is_active" in cols:
            setattr(u, "is_active", True)
        if "email_verified" in cols:
            setattr(u, "email_verified", True)
        if make_admin:
            if "role" in cols:
                setattr(u, "role", "admin")
            if "is_admin" in cols:
                setattr(u, "is_admin", True)

        db.add(u)
        db.commit()
        return {"ok": True, "message": f"Aktivován {email}" + (" + admin" if make_admin else "")}

if __name__ == "__main__":
    p = argparse.ArgumentParser(description="Aktivuj uživatele (a volitelně nastav admin).")
    p.add_argument("--email", required=True)
    p.add_argument("--admin", action="store_true", help="Nastavit jako admina (role=is_admin pokud existují)")
    args = p.parse_args()
    res = activate(args.email, make_admin=args.admin)
    print(("[OK] " if res["ok"] else "[WARN] ") + res["message"])
