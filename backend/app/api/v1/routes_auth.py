from __future__ import annotations

import os
from datetime import timedelta, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from jose import jwt, JWTError

from app.core.deps import get_db, get_current_user
from app.db import models

try:
    from app.core.security import (
        ALGORITHM as ALG,
        get_jwt_secret,
        verify_password as _verify_password,
    )
    def verify_password(plain: str, hashed: str) -> bool:
        return _verify_password(plain, hashed)
except Exception:
    from passlib.context import CryptContext
    _pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
    ALG = os.getenv("ALGORITHM", "HS256")
    def verify_password(plain: str, hashed: str) -> bool:
        try:
            return _pwd_ctx.verify(plain, hashed)
        except Exception:
            return False

def _secret() -> str:
    try:
        return get_jwt_secret()
    except Exception:
        return os.getenv("JWT_SECRET", os.getenv("SECRET_KEY", "change_me_to_long_random"))

ENV = os.getenv("ENV", "dev").lower()
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "10080" if ENV == "dev" else "30"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "60" if ENV == "dev" else "14"))
REFRESH_COOKIE_NAME = "am_client_refresh"
REFRESH_COOKIE_PATH = "/api/v1/auth"

try:
    from app.api.v1.schemas_auth import LoginIn, UserOut as MeOut  # type: ignore
except Exception:
    class LoginIn(BaseModel):
        email: EmailStr
        password: str

# Minimal /auth/me payload without PII.
class MeSafe(BaseModel):
    id: int
    role: Optional[str] = None
    is_active: bool = True

class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"

router = APIRouter(prefix="/auth", tags=["auth"])

def _now() -> datetime:
    return datetime.now(timezone.utc)

def _encode(payload: dict, expires_delta: timedelta) -> str:
    data = payload.copy()
    data["iat"] = int(_now().timestamp())
    data["exp"] = _now() + expires_delta
    return jwt.encode(data, _secret(), algorithm=ALG)

def _create_access_token(user: models.User) -> str:
    claims = {"sub": str(user.id)}
    role = getattr(user, "role", None)
    if role:
        claims["role"] = role
    return _encode(claims, timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))

def _create_refresh_token(user: models.User) -> str:
    claims = {"sub": str(user.id), "scope": "refresh"}
    return _encode(claims, timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS))

def _get_user_password_hash(u: models.User) -> Optional[str]:
    return getattr(u, "hashed_password", None) or getattr(u, "password_hash", None)

def _is_user_active(u: models.User) -> bool:
    # V této aplikaci nemáme is_active a email_verified sloupce
    # Takže všechny uživatele považujeme za aktivní
    # Pokud bychom v budoucnu přidali tyto sloupce, můžeme je zkontrolovat
    return True

def _set_refresh_cookie(resp: Response, token: str):
    resp.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=False if ENV == "dev" else True,
        samesite="lax",
        path=REFRESH_COOKIE_PATH,
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600,
    )

def _clear_refresh_cookie(resp: Response):
    resp.delete_cookie(key=REFRESH_COOKIE_NAME, path=REFRESH_COOKIE_PATH)

@router.post("/login", response_model=TokenOut, openapi_extra={"security": []})
def login(payload: LoginIn, response: Response, db: Session = Depends(get_db)):
    """
    Client login endpoint - pro běžné uživatele.
    Administrátoři MUSÍ používat /api/admin/v1/auth/login.
    """
    invalid = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if not user:
        raise invalid
    pwd_hash = _get_user_password_hash(user)
    if not pwd_hash or not verify_password(payload.password, pwd_hash):
        raise invalid
    # Kontrola aktivního účtu (pokud máme is_active a email_verified sloupce)
    if not _is_user_active(user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is not active or email not verified.")
    
    # POZNÁMKA: Admini MOHOU používat client login, pokud chtějí nakupovat jako zákazníci
    # Admin panel (/api/admin/v1/auth/login) je pro správu systému
    # Client login (/api/v1/auth/login) je pro nákupy a může ho použít kdokoliv včetně adminů
    
    access = _create_access_token(user)
    refresh = _create_refresh_token(user)
    _set_refresh_cookie(response, refresh)
    return TokenOut(access_token=access)

@router.post("/refresh", response_model=TokenOut, openapi_extra={"security": []})
def refresh_token(request: Request, response: Response, db: Session = Depends(get_db)):
    cookie = request.cookies.get(REFRESH_COOKIE_NAME)
    if not cookie:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Chybí refresh")
    try:
        payload = jwt.decode(cookie, _secret(), algorithms=[ALG])
        if payload.get("scope") != "refresh":
            raise JWTError("bad scope")
        sub = payload.get("sub")
        if not sub:
            raise JWTError("missing sub")
        user_id = int(sub)
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Neplatný refresh")
    user = db.get(models.User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Neplatný refresh")
    new_refresh = _create_refresh_token(user)
    _set_refresh_cookie(response, new_refresh)
    new_access = _create_access_token(user)
    return TokenOut(access_token=new_access)

@router.post("/logout", openapi_extra={"security": []})
def logout(response: Response):
    _clear_refresh_cookie(response)
    return {"ok": True}

def _to_bool(value, default: bool) -> bool:
    if value is None:
        return default
    return bool(value)

@router.get("/me", response_model=MeSafe)
def me(user: models.User = Depends(get_current_user)):
    # Return minimal identity info without PII.
    return MeSafe(
        id=user.id,
        role=getattr(user, "role", None),
        is_active=_to_bool(getattr(user, "is_active", None), True),
    )
