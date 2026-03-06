from __future__ import annotations
import os
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.core.deps import get_db
from app.db import models
from app.db.models_tokens import PasswordResetToken
from app.services.tokens import create_password_reset_token
from app.services.url_builder import frontend_url
from app.services.mailer import send_email
from app.services.email_templates import render_reset_password

# hash hesla – preferuj projektovou funkci, jinak fallback
def _get_hasher():
    try:
        from app.core.security import get_password_hash  # type: ignore
        return get_password_hash
    except Exception:
        from passlib.context import CryptContext
        _ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
        return lambda p: _ctx.hash(p)

router = APIRouter(tags=["auth"])  # prefix je v main.py → POST /auth/request-reset, POST /auth/reset

# ---------- schemas ----------
class RequestResetIn(BaseModel):
    email: EmailStr

class RequestResetOut(BaseModel):
    ok: bool  # vždy True (aby se nedala enumerovat existence účtů)

class ResetIn(BaseModel):
    token: str = Field(min_length=16)
    new_password: str = Field(min_length=8, max_length=128)

class ResetOut(BaseModel):
    ok: bool

# ---------- endpoints ----------
@router.post("/request-reset", response_model=RequestResetOut)
def request_reset(payload: RequestResetIn, db: Session = Depends(get_db)):
    # najdi usera; ale odpověď bude vždy ok=True
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if user:
        ttl = int(os.getenv("RESET_TOKEN_TTL_MINUTES", "30"))
        row = create_password_reset_token(db, user_id=user.id, ttl_minutes=ttl)
        reset_url = frontend_url("/reset-password", token=row.token)

        txt, html = render_reset_password(ttl_minutes=ttl, reset_url=reset_url)
        try:
            send_email(
                to=payload.email,
                subject="Arte Moderno — Obnova hesla",
                body_text=txt,
                body_html=html,
            )
        except Exception as e:
            # Log chybu pro debugging, ale nevyhazuj výjimku (bezpečnost)
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Failed to send password reset email to {payload.email}: {e}")
            # pro lokální vývoj s aiosmtpd klidně ignoruj chybu
            pass
    return RequestResetOut(ok=True)

@router.post("/reset", response_model=ResetOut)
def reset_password(payload: ResetIn, db: Session = Depends(get_db)):
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

    hasher = _get_hasher()
    new_hash = hasher(payload.new_password)
    if hasattr(user, "hashed_password"):
        setattr(user, "hashed_password", new_hash)  # type: ignore[attr-defined]
    elif hasattr(user, "password_hash"):
        setattr(user, "password_hash", new_hash)    # type: ignore[attr-defined]
    else:
        raise HTTPException(status_code=500, detail="Password field missing on User model.")

    t.used = True
    db.add_all([user, t])
    db.commit()
    return ResetOut(ok=True)
