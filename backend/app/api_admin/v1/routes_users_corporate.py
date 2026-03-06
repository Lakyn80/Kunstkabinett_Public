# app/api/admin/v1/routes_users_corporate.py
from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, status, Path
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.deps import get_db, require_admin
from app.db import models

router = APIRouter(prefix="/api/admin/v1", tags=["admin: users"], dependencies=[Depends(require_admin)])

class CorporateFlagIn(BaseModel):
    is_corporate: bool

class UserOut(BaseModel):
    id: int
    email: str
    role: str | None = None
    is_admin: bool | None = None
    is_corporate: bool | None = None

@router.patch("/users/{user_id}/corporate", response_model=UserOut)
def set_corporate_flag(
    payload: CorporateFlagIn,
    user_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
):
    user = db.get(models.User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # nastav příznak
    user.is_corporate = bool(payload.is_corporate)  # type: ignore[attr-defined]
    db.add(user)
    db.commit()
    db.refresh(user)

    return UserOut(
        id=user.id,
        email=user.email,
        role=getattr(user, "role", None),
        is_admin=bool(getattr(user, "is_admin", False)),
        is_corporate=bool(getattr(user, "is_corporate", False)),
    )
