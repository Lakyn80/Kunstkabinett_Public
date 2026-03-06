#!/usr/bin/env python
from __future__ import annotations
from pathlib import Path
import sys
import argparse

# přidej backend do sys.path
BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

# .env (DATABASE_URL apod.)
try:
    from dotenv import load_dotenv
    ENV_PATH = BACKEND_ROOT / ".env"
    load_dotenv(dotenv_path=ENV_PATH, override=True)
except Exception:
    pass

from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.db import models

# hash hesla – použij projektový helper, jinak fallback na passlib
def _get_hasher():
    try:
        from app.core.security import get_password_hash  # type: ignore
        return get_password_hash
    except Exception:
        from passlib.context import CryptContext
        _ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
        return lambda p: _ctx.hash(p)

def create_user(email: str, password: str, role: str = "user",
                is_active: bool = True, email_verified: bool = True) -> dict:
    hasher = _get_hasher()
    with SessionLocal() as db:
        # už existuje?
        u = db.query(models.User).filter(models.User.email == email).first()
        if u:
            return {"ok": False, "message": f"Uživatel {email} už existuje (id={u.id})."}

        fields = {"email": email}

        # různé názvy sloupců pro hash hesla (hashed_password/password_hash)
        pwd_hash = hasher(password)
        if "hashed_password" in models.User.__table__.columns:
            fields["hashed_password"] = pwd_hash
        elif "password_hash" in models.User.__table__.columns:
            fields["password_hash"] = pwd_hash
        else:
            return {"ok": False, "message": "User model nemá sloupec pro hash hesla."}

        # role, aktivace, verifikace – nastav, pokud sloupce existují
        if "role" in models.User.__table__.columns:
            fields["role"] = role
        if "is_active" in models.User.__table__.columns:
            fields["is_active"] = is_active  # boolean, ne string!
        if "email_verified" in models.User.__table__.columns:
            fields["email_verified"] = email_verified  # boolean, ne string!
        if "is_admin" in models.User.__table__.columns and role == "admin":
            fields["is_admin"] = True  # boolean, ne string!

        user = models.User(**fields)
        db.add(user)
        db.commit()
        db.refresh(user)
        return {"ok": True, "message": f"Vytvořen uživatel id={user.id} email={email} role={role}"}

if __name__ == "__main__":
    p = argparse.ArgumentParser(description="Vytvoř uživatele v DB.")
    p.add_argument("--email", required=True, help="Email")
    p.add_argument("--password", required=True, help="Heslo")
    p.add_argument("--role", choices=["admin", "editor", "customer", "user"], default="user")
    p.add_argument("--inactive", action="store_true", help="Vytvořit jako neaktivního (is_active=False)")
    p.add_argument("--unverified", action="store_true", help="Vytvořit jako neverifikovaného (email_verified=False)")
    args = p.parse_args()

    res = create_user(
        email=args.email,
        password=args.password,
        role=args.role,
        is_active=not args.inactive,
        email_verified=not args.unverified,
    )
    print(("[OK] " if res["ok"] else "[WARN] ") + res["message"])