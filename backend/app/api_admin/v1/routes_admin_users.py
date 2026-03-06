from __future__ import annotations
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from fastapi import status as http_status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from app.core.deps import get_db, require_admin
from app.db import models  # User

router = APIRouter(
    prefix="/users",                      # relativní prefix
    tags=["admin: users"],
    dependencies=[Depends(require_admin)] # admin guard na celý router
)

ALLOWED_ROLES = {"customer", "editor", "admin"}

# -------- LIST --------
@router.get("/")
def admin_list_users(
    q: Optional[str] = Query(None, description="Hledat v e-mailu"),
    role: Optional[str] = Query(None, description="Filtrovat podle role (customer|editor|admin)"),
    limit: int = Query(20, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
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
    items = [
        {
            "id": u.id,
            "email": u.email,
            "role": u.role,
        }
        for u in rows
    ]
    return {"total": total, "limit": limit, "offset": offset, "items": items}

# -------- DETAIL --------
@router.get("/{user_id}")
def admin_get_user(
    user_id: int = Path(..., ge=1),
    db: Session = Depends(get_db),
):
    u = db.get(models.User, user_id)
    if not u:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Uživatel nenalezen.")
    return {"id": u.id, "email": u.email, "role": u.role}

# -------- CHANGE ROLE --------
class RolePayload(BaseModel):
    role: str = Field(..., description="Nová role: customer|editor|admin")

@router.post("/{user_id}/role")
def admin_set_user_role(
    user_id: int,
    payload: RolePayload,
    db: Session = Depends(get_db),
):
    u = db.get(models.User, user_id)
    if not u:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Uživatel nenalezen.")

    new_role = (payload.role or "").lower().strip()
    if new_role not in ALLOWED_ROLES:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail="Neplatná role.")

    # Primární admin (nejnižší ID s rolí admin) nesmí být změněn na jinou roli
    first_admin = (
        db.query(models.User)
        .filter(models.User.role == "admin")
        .order_by(models.User.id.asc())
        .first()
    )
    if first_admin and u.id == first_admin.id and new_role != "admin":
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="Primární administrátor nelze změnit na jinou roli.",
        )

    u.role = new_role
    db.commit()
    db.refresh(u)
    return {"id": u.id, "email": u.email, "role": u.role}
