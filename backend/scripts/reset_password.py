# scripts/reset_password.py
from __future__ import annotations
import sys
from passlib.context import CryptContext
from app.db.session import SessionLocal
from app.db.models import User

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

def main() -> None:
    if len(sys.argv) != 3:
        print("Usage: python scripts/reset_password.py <email> <new_password>")
        sys.exit(1)

    email, new_password = sys.argv[1], sys.argv[2]
    db = SessionLocal()
    try:
        u = db.query(User).filter(User.email == email).first()
        if not u:
            print("ERROR: user not found")
            sys.exit(2)

        u.password_hash = pwd_ctx.hash(new_password)
        db.add(u)
        db.commit()
        print("OK: password updated for", email)
    finally:
        db.close()

if __name__ == "__main__":
    main()
