from __future__ import annotations

import os
from typing import Literal

from sqlalchemy.exc import SQLAlchemyError

from app.core.security import hash_password
from app.db.models import User
from app.db.session import SessionLocal


def ensure_dev_admin():
    env = os.getenv("ENV", "dev").lower()
    if env != "dev":
        return

    email = os.getenv("DEV_ADMIN_EMAIL", "").strip()
    password = os.getenv("DEV_ADMIN_PASSWORD", "").strip()
    if not email or not password:
        print("Dev admin email/password not configured; skipping dev seeding.")
        return

    _seed_admin(email, password)


def _seed_admin(email: str, password: str):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        hashed = hash_password(password)
        if user:
            user.password_hash = hashed
            user.role = user.role or "admin"
            user.is_admin = True
        else:
            user = User(
                email=email,
                password_hash=hashed,
                role="admin",
                is_admin=True,
            )
            db.add(user)
        db.commit()
        print(f"[dev-seed] Ensured dev admin user '{email}' (ENV=dev).")
    except SQLAlchemyError as exc:
        db.rollback()
        print(f"[dev-seed] Failed to ensure dev admin: {exc}")
    finally:
        db.close()
