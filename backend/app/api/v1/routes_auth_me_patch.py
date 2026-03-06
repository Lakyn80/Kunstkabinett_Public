from __future__ import annotations
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_user
from app.api.v1.schemas_auth import UserOut

router = APIRouter(prefix="/auth", tags=["auth"])

@router.get("/me", response_model=UserOut)
def me(db: Session = Depends(get_db), user = Depends(get_current_user)):
    # bezpečné fallbacky, pokud sloupce ještě nejsou v DB
    return UserOut(
        id=user.id,
        email=user.email,
        role=getattr(user, "role", "user"),
        is_active=bool(getattr(user, "is_active", False)),
        email_verified=bool(getattr(user, "email_verified", False)),
    )
