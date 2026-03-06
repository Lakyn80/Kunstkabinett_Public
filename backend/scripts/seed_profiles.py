#!/usr/bin/env python
from __future__ import annotations
from pathlib import Path
import sys

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

try:
    from dotenv import load_dotenv
    ENV_PATH = BACKEND_ROOT / ".env"
    load_dotenv(dotenv_path=ENV_PATH, override=True)
except Exception:
    pass

from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.db import models
from app.db.models_profile import Profile

def _get_hasher():
    try:
        from app.core.security import get_password_hash
        return get_password_hash
    except Exception:
        from passlib.context import CryptContext
        _ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
        return lambda p: _ctx.hash(p)

TEST_USERS = [
    {
        "email": "user1@test.dev",
        "password": "user123",
        "role": "customer",
        "profile": {
            "first_name": "Jan",
            "last_name": "Novotný",
            "phone": "+420 775 222 222",
            "billing_street": "Václavské náměstí 50",
            "billing_city": "Praha",
            "billing_postal_code": "11000",
            "billing_country": "Česká republika",
            "shipping_street": "Václavské náměstí 50",
            "shipping_city": "Praha",
            "shipping_postal_code": "11000",
            "shipping_country": "Česká republika",
        }
    },
    {
        "email": "user2@test.dev",
        "password": "user123",
        "role": "customer",
        "profile": {
            "first_name": "Marie",
            "last_name": "Svobodová",
            "phone": "+420 775 333 333",
            "billing_street": "Nerudova 20",
            "billing_city": "Praha",
            "billing_postal_code": "11800",
            "billing_country": "Česká republika",
            "shipping_street": "Nerudova 20",
            "shipping_city": "Praha",
            "shipping_postal_code": "11800",
            "shipping_country": "Česká republika",
        }
    },
    {
        "email": "user3@test.dev",
        "password": "user123",
        "role": "customer",
        "profile": {
            "first_name": "Petr",
            "last_name": "Kučera",
            "phone": "+420 775 444 444",
            "billing_street": "Vinohradská 125",
            "billing_city": "Praha",
            "billing_postal_code": "13000",
            "billing_country": "Česká republika",
            "shipping_street": "Vinohradská 125",
            "shipping_city": "Praha",
            "shipping_postal_code": "13000",
            "shipping_country": "Česká republika",
        }
    },
    {
        "email": "editor@test.dev",
        "password": "editor123",
        "role": "editor",
        "profile": {
            "first_name": "David",
            "last_name": "Horák",
            "phone": "+420 775 555 555",
            "billing_street": "Opletalova 40",
            "billing_city": "Praha",
            "billing_postal_code": "11000",
            "billing_country": "Česká republika",
            "shipping_street": "Opletalova 40",
            "shipping_city": "Praha",
            "shipping_postal_code": "11000",
            "shipping_country": "Česká republika",
        }
    },
]

def seed_users_and_profiles():
    hasher = _get_hasher()
    db = SessionLocal()
    
    try:
        for user_data in TEST_USERS:
            existing = db.query(models.User).filter(
                models.User.email == user_data["email"]
            ).first()
            
            if existing:
                print(f"⚠️  {user_data['email']} už existuje")
                continue
            
            user = models.User(
                email=user_data["email"],
                password_hash=hasher(user_data["password"]),
                role=user_data["role"],
                is_admin=(user_data["role"] == "admin"),
                is_corporate=False
            )
            db.add(user)
            db.flush()
            
            profile = Profile(
                user_id=user.id,
                first_name=user_data["profile"]["first_name"],
                last_name=user_data["profile"]["last_name"],
                phone=user_data["profile"]["phone"],
                billing_street=user_data["profile"]["billing_street"],
                billing_city=user_data["profile"]["billing_city"],
                billing_postal_code=user_data["profile"]["billing_postal_code"],
                billing_country=user_data["profile"]["billing_country"],
                shipping_street=user_data["profile"]["shipping_street"],
                shipping_city=user_data["profile"]["shipping_city"],
                shipping_postal_code=user_data["profile"]["shipping_postal_code"],
                shipping_country=user_data["profile"]["shipping_country"],
                same_as_billing=True
            )
            db.add(profile)
            
            print(f"✅ Vytvořen: {user_data['email']} ({user_data['role']})")
        
        db.commit()
        print("\n✅ Všichni uživatelé a profily úspěšně vytvořeni!")
        
    except Exception as e:
        db.rollback()
        print(f"❌ Chyba: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_users_and_profiles()