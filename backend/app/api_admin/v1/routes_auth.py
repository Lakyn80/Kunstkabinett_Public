from __future__ import annotations

import os
from datetime import timedelta, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from jose import jwt, JWTError

from app.core.deps import get_db
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
REFRESH_COOKIE_NAME = "am_admin_refresh"
REFRESH_COOKIE_PATH = "/api/admin/v1/auth"

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"

router = APIRouter(prefix="/auth", tags=["admin-auth"])


def _is_admin_user(user: models.User) -> bool:
    return bool(getattr(user, "is_admin", False) or str(getattr(user, "role", "")).lower() == "admin")

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
    if _is_admin_user(user):
        claims["is_admin"] = True
    return _encode(claims, timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))

def _create_refresh_token(user: models.User) -> str:
    claims = {"sub": str(user.id), "scope": "refresh"}
    return _encode(claims, timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS))

def _get_user_password_hash(u: models.User) -> Optional[str]:
    return getattr(u, "hashed_password", None) or getattr(u, "password_hash", None)

def _is_user_active(u: models.User) -> bool:
    # V této aplikaci nemáme is_active a email_verified sloupce
    # Takže všechny uživatele považujeme za aktivní
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

@router.post("/login", response_model=TokenOut, openapi_extra={"security": []})
def admin_login(payload: LoginIn, response: Response, db: Session = Depends(get_db)):
    """
    Admin login endpoint - STRICTLY pro administrátory.
    Povolí přihlášení POUZE pokud má uživatel is_admin=True.
    """
    invalid = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    
    # Načti uživatele podle e-mailu a admin oprávnění ověř potom.
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    
    if not user:
        # Pokud uživatel neexistuje NEBO není admin, vrať chybu
        # Neříkej, jestli je problém s heslem nebo s admin právem (bezpečnost)
        raise invalid
    
    pwd_hash = _get_user_password_hash(user)
    if not pwd_hash or not verify_password(payload.password, pwd_hash):
        raise invalid
    
    if not _is_admin_user(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required. Only administrators can access the admin panel."
        )
    
    access = _create_access_token(user)
    refresh = _create_refresh_token(user)
    _set_refresh_cookie(response, refresh)
    return TokenOut(access_token=access)

@router.post("/refresh", response_model=TokenOut, openapi_extra={"security": []})
def admin_refresh(request: Request, response: Response, db: Session = Depends(get_db)):
    """
    Admin refresh endpoint - STRICTLY pro administrátory.
    Povolí refresh POUZE pokud má uživatel is_admin=True.
    """
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
    
    if not _is_admin_user(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required. Only administrators can refresh admin tokens."
        )
    
    new_refresh = _create_refresh_token(user)
    _set_refresh_cookie(response, new_refresh)
    new_access = _create_access_token(user)
    return TokenOut(access_token=new_access)

@router.post("/logout", openapi_extra={"security": []})
def admin_logout(response: Response):
    """
    Admin logout endpoint - vymaže refresh cookie.
    """
    _clear_refresh_cookie(response)
    return {"ok": True}

def _clear_refresh_cookie(resp: Response):
    resp.delete_cookie(key=REFRESH_COOKIE_NAME, path=REFRESH_COOKIE_PATH)


# ---------- PASSWORD RESET FOR ADMIN ----------
from pydantic import Field
from app.db.models_tokens import PasswordResetToken
from app.services.tokens import create_password_reset_token
from app.services.url_builder import admin_frontend_url
from app.services.mailer import send_email
from app.services.email_templates import render_reset_password

try:
    from app.core.security import get_password_hash
    _hasher = get_password_hash
except Exception:
    from passlib.context import CryptContext
    _ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
    _hasher = lambda p: _ctx.hash(p)


class AdminRequestResetIn(BaseModel):
    email: EmailStr


class AdminRequestResetOut(BaseModel):
    ok: bool


class AdminResetIn(BaseModel):
    token: str = Field(min_length=16)
    new_password: str = Field(min_length=8, max_length=128)


class AdminResetOut(BaseModel):
    ok: bool


@router.post("/request-reset", response_model=AdminRequestResetOut, openapi_extra={"security": []})
def admin_request_reset(payload: AdminRequestResetIn, db: Session = Depends(get_db)):
    """
    Admin password reset request - POUZE pro administrátory.
    """
    user = db.query(models.User).filter(models.User.email == payload.email).first()

    if user and _is_admin_user(user):
        ttl = int(os.getenv("RESET_TOKEN_TTL_MINUTES", "30"))
        row = create_password_reset_token(db, user_id=user.id, ttl_minutes=ttl)
        # Admin reset URL vede na /admin/reset-password (admin FE)
        reset_url = admin_frontend_url("/admin/reset-password", token=row.token)

        txt, html = render_reset_password(ttl_minutes=ttl, reset_url=reset_url)
        try:
            send_email(
                to=payload.email,
                subject="Arte Moderno Admin — Obnova hesla",
                body_text=txt,
                body_html=html,
            )
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Failed to send admin password reset email to {payload.email}: {e}")
            pass

    # Vždy vracíme ok=True (bezpečnost - nenafukuj info o existenci účtů)
    return AdminRequestResetOut(ok=True)


@router.post("/reset", response_model=AdminResetOut, openapi_extra={"security": []})
def admin_reset_password(payload: AdminResetIn, db: Session = Depends(get_db)):
    """
    Admin password reset - nastaví nové heslo podle tokenu.
    """
    now = datetime.now(timezone.utc)
    t: PasswordResetToken | None = (
        db.query(PasswordResetToken)
        .filter(PasswordResetToken.token == payload.token)
        .first()
    )
    if not t or t.used or t.expires_at <= now:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired token.")

    user = db.get(models.User, t.user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid token.")

    if not _is_admin_user(user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required.")

    new_hash = _hasher(payload.new_password)
    if hasattr(user, "hashed_password"):
        setattr(user, "hashed_password", new_hash)
    elif hasattr(user, "password_hash"):
        setattr(user, "password_hash", new_hash)
    else:
        raise HTTPException(status_code=500, detail="Password field missing on User model.")

    t.used = True
    db.add_all([user, t])
    db.commit()
    return AdminResetOut(ok=True)
