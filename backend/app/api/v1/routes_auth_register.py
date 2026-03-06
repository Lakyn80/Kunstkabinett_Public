from __future__ import annotations
from datetime import datetime, timedelta
from typing import Optional, Generator

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session
from sqlalchemy import select, func

# --- tvoje DB věci ---
from app.db import models  # očekává models.User
from app.db.models_profile import Profile  # import Profile model
from app.core.deps import get_db  # použij standardní get_db pro Docker kompatibilitu

# --- zkus použít projektové security helpery; jinak fallback ---
try:
    from app.core.security import get_password_hash as _proj_get_password_hash  # type: ignore
    from app.core.security import create_access_token as _proj_create_access_token  # type: ignore
    HAVE_PROJECT_SECURITY = True
except Exception:
    HAVE_PROJECT_SECURITY = False
    from passlib.context import CryptContext
    from jose import jwt
    import os

    _pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
    JWT_SECRET = os.getenv("JWT_SECRET", "CHANGE_ME_IN_PROD")
    JWT_ALGO = os.getenv("JWT_ALGO", "HS256")
    JWT_EXPIRE_MIN = int(os.getenv("JWT_EXPIRE_MIN", "60"))

    def _fallback_get_password_hash(pw: str) -> str:
        return _pwd.hash(pw)

    def _fallback_create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
        to_encode = data.copy()
        expire = datetime.utcnow() + (expires_delta or timedelta(minutes=JWT_EXPIRE_MIN))
        to_encode.update({"exp": expire})
        return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGO)

router = APIRouter(tags=["auth"])  # prefix je v main.py → POST /auth/register (veřejné)

# --------- Schemas ---------
class RegisterIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=255)

class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"

# --------- Helpers ---------
def _hash_password(raw: str) -> str:
    if HAVE_PROJECT_SECURITY:
        return _proj_get_password_hash(raw)  # type: ignore[name-defined]
    return _fallback_get_password_hash(raw)  # type: ignore[name-defined]

def _issue_access_token(payload: dict) -> str:
    if HAVE_PROJECT_SECURITY:
        return _proj_create_access_token(payload)  # type: ignore[name-defined]
    return _fallback_create_access_token(payload)  # type: ignore[name-defined]

def _set_user_password_hash(u: models.User, raw_password: str):
    hashed = _hash_password(raw_password)
    # pokryj různé názvy sloupců:
    if hasattr(u, "password_hash"):
        setattr(u, "password_hash", hashed)
    elif hasattr(u, "hashed_password"):
        setattr(u, "hashed_password", hashed)
    elif hasattr(u, "password"):
        setattr(u, "password", hashed)
    else:
        raise HTTPException(status_code=500, detail="User model postrádá sloupec pro hash hesla.")

# --------- Route ---------
@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterIn, db: Session = Depends(get_db)):
    # 1) unikátní e-mail (case-insensitive)
    existing = db.execute(
        select(models.User).where(func.lower(models.User.email) == func.lower(payload.email))
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="E-mail je již zaregistrován.")

    # 2) vytvoř uživatele (mapuj name/role/flagy pouze pokud existují)
    user = models.User(
        email=payload.email,
        **({"name": payload.name} if hasattr(models.User, "name") else {}),
        **({"role": "customer"} if hasattr(models.User, "role") else {}),
        **({"is_active": True} if hasattr(models.User, "is_active") else {}),
        **({"is_admin": False} if hasattr(models.User, "is_admin") else {}),
        **({"created_at": datetime.utcnow()} if hasattr(models.User, "created_at") else {}),
        **({"updated_at": datetime.utcnow()} if hasattr(models.User, "updated_at") else {}),
    )
    _set_user_password_hash(user, payload.password)

    db.add(user)
    db.commit()
    db.refresh(user)

    # 2.5) vytvoř profil s first_name a last_name z name (pokud se podaří)
    try:
        # Rozděl name na first_name a last_name
        name_parts = payload.name.strip().split(None, 1)  # rozdělí na max 2 části
        first_name = name_parts[0] if name_parts else None
        last_name = name_parts[1] if len(name_parts) > 1 else None

        profile = Profile(
            user_id=user.id,
            first_name=first_name,
            last_name=last_name,
        )
        db.add(profile)
        db.commit()
    except Exception as e:
        # Pokud vytvoření profilu selže, pokračuj dál (profil se vytvoří později)
        db.rollback()
        pass

    # 3) vystav JWT
    token = _issue_access_token({"sub": str(user.id), "email": user.email})
    return {"access_token": token, "token_type": "bearer"}
