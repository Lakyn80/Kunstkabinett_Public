#!/usr/bin/env python
from __future__ import annotations
from pathlib import Path
import sys

# sys.path → backend
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

def main():
    cols = list(models.User.__table__.columns.keys())
    print("== User columns ==")
    for c in cols:
        print("-", c)
    print()

    with SessionLocal() as db:
        rows = db.query(models.User).order_by(models.User.id.asc()).all()
        if not rows:
            print("Žádní uživatelé.")
            return
        print("== Values ==")
        for u in rows:
            data = {c: getattr(u, c, None) for c in cols}
            print(f"id={u.id} email={u.email} -> {data}")

if __name__ == "__main__":
    main()
