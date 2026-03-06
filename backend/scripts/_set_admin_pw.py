from __future__ import annotations
import argparse
from app.db.session import SessionLocal
from app.db import models
from app.core.security import hash_password

def set_password(email: str, new_password: str):
    with SessionLocal() as db:
        u = db.query(models.User).filter(models.User.email == email).first()
        if not u:
            print(f"[FAIL] User {email} not found")
            return
        # sloupec je v tvém modelu "password_hash"
        u.password_hash = hash_password(new_password)
        db.add(u)
        db.commit()
        print(f"[OK] Password updated for {email} (id={u.id})")

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--email", required=True)
    p.add_argument("--password", required=True)
    args = p.parse_args()
    set_password(args.email, args.password)
