from __future__ import annotations
from typing import Optional, List, Generator

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from fastapi import status as http_status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.core.deps import require_admin, get_current_user
from app.db import models  # User
from app.db.session import SessionLocal  # lokální session dependency

router = APIRouter(prefix="/users", tags=["admin: users"])

# Lokální dependency -> vyhneme se importu get_db z jiných modulů
def _get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

ALLOWED_ROLES = {"customer", "editor", "admin"}

# -------- LIST --------
@router.get("/", dependencies=[Depends(require_admin)])
def admin_list_users(
    q: Optional[str] = Query(None, description="Hledat v e-mailu"),
    role: Optional[str] = Query(None, description="Filtrovat podle role (customer|editor|admin)"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(_get_db),
):
    qry = db.query(models.User)
    if q:
        like = f"%{q}%"
        qry = qry.filter(models.User.email.ilike(like))
    if role:
        r = role.lower().strip()
        if r not in ALLOWED_ROLES:
            raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail="Neplatná role.")
        qry = qry.filter(models.User.role == r)

    total = qry.count()
    rows: List[models.User] = (
        qry.order_by(models.User.id.desc()).offset(offset).limit(limit).all()
    )
    items = [{"id": u.id, "email": u.email, "role": u.role} for u in rows]
    return {"total": total, "limit": limit, "offset": offset, "items": items}

# -------- DETAIL --------
@router.get("/{user_id}", dependencies=[Depends(require_admin)])
def admin_get_user(
    user_id: int = Path(..., ge=1),
    db: Session = Depends(_get_db),
):
    u = db.get(models.User, user_id)
    if not u:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Uživatel nenalezen.")
    return {"id": u.id, "email": u.email, "role": u.role}

# -------- CHANGE ROLE (s ochranou posledního admina) --------
class RolePayload(BaseModel):
    role: str = Field(..., description="Nová role: customer|editor|admin")

@router.post("/{user_id}/role", dependencies=[Depends(require_admin)])
def admin_set_user_role(
    user_id: int,
    payload: RolePayload,
    db: Session = Depends(_get_db),
    current: models.User = Depends(get_current_user),
):
    u = db.get(models.User, user_id)
    if not u:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Uživatel nenalezen.")

    new_role = payload.role.lower().strip()
    if new_role not in ALLOWED_ROLES:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail="Neplatná role.")

    # ❗ Prevence: nelze si sám odebrat admina, pokud jsi poslední admin
    if u.id == current.id and new_role != "admin":
        other_admin = db.execute(
            select(models.User).where(models.User.role == "admin", models.User.id != current.id).limit(1)
        ).scalar_one_or_none()
        if other_admin is None:
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail="Nemůžeš si odebrat admin roli, když jsi poslední admin.",
            )

    u.role = new_role
    db.commit()
    db.refresh(u)
    return {"id": u.id, "email": u.email, "role": u.role}
