from __future__ import annotations
import secrets
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from app.db.models_tokens import EmailVerificationToken, PasswordResetToken

def _gen_token() -> str:
    # URL-safe token (<=128 znaků pro naše DB sloupce)
    return secrets.token_urlsafe(64)

def create_email_verification_token(db: Session, user_id: int, ttl_minutes: int) -> EmailVerificationToken:
    now = datetime.now(timezone.utc)
    row = EmailVerificationToken(
        user_id=user_id,
        token=_gen_token(),
        expires_at=now + timedelta(minutes=int(ttl_minutes)),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row

def create_password_reset_token(db: Session, user_id: int, ttl_minutes: int) -> PasswordResetToken:
    now = datetime.now(timezone.utc)
    row = PasswordResetToken(
        user_id=user_id,
        token=_gen_token(),
        expires_at=now + timedelta(minutes=int(ttl_minutes)),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row
