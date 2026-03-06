from __future__ import annotations

from typing import Optional, List, Generator, Any, Dict

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from fastapi import status as http_status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.core.deps import require_admin, get_current_user
from app.db import models
from app.db.models_profile import Profile as ProfileModel
from app.db.session import SessionLocal

router = APIRouter(prefix="/users", tags=["admin: users"])

# Lokální dependency
def _get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

ALLOWED_ROLES = {"customer", "editor", "admin"}

# -------- ME (current user) --------
@router.get("/me", dependencies=[Depends(require_admin)])
def admin_get_me(
    current_user: models.User = Depends(get_current_user),
):
    """
    Vrátí aktuálního přihlášeného admin uživatele.
    """
    return {
        "id": current_user.id,
        # PII (email) neschováváme do response, aby nebyla v network logu
        "email": None,
        "role": getattr(current_user, "role", None),
        "is_admin": getattr(current_user, "is_admin", False),
        "is_corporate": getattr(current_user, "is_corporate", False),
    }

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
    items = [
        {
            "id": u.id,
            "email": u.email,
            "role": u.role,
            "is_admin": u.is_admin,
            "is_corporate": u.is_corporate,
        }
        for u in rows
    ]
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
    return {
        "id": u.id,
        "email": u.email,
        "role": u.role,
        "is_admin": u.is_admin,
        "is_corporate": u.is_corporate,
    }

# -------- DETAIL S PROFILEM A OBJEDNÁVKAMI --------
@router.get("/{user_id}/full", dependencies=[Depends(require_admin)])
def admin_get_user_full(
    user_id: int = Path(..., ge=1),
    db: Session = Depends(_get_db),
):
    u = db.get(models.User, user_id)
    if not u:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Uživatel nenalezen.")
    
    # --- PROFILE podle user_id ---
    prof_row = (
        db.query(ProfileModel)
        .filter(ProfileModel.user_id == user_id)
        .first()
    )
    
    profile: Optional[Dict[str, Any]] = None
    if prof_row is not None:
        profile = {
            "id": prof_row.id,
            "user_id": prof_row.user_id,
            "first_name": prof_row.first_name,
            "last_name": prof_row.last_name,
            "phone": prof_row.phone,
            "billing_street": prof_row.billing_street,
            "billing_city": prof_row.billing_city,
            "billing_postal_code": prof_row.billing_postal_code,
            "billing_country": prof_row.billing_country,
            "shipping_street": prof_row.shipping_street,
            "shipping_city": prof_row.shipping_city,
            "shipping_postal_code": prof_row.shipping_postal_code,
            "shipping_country": prof_row.shipping_country,
            "same_as_billing": prof_row.same_as_billing,
            "created_at": prof_row.created_at,
            "updated_at": prof_row.updated_at,
        }
    
    # --- Adresy (billing + shipping) ---
    def make_address(street: Optional[str], city: Optional[str], postal_code: Optional[str], country: Optional[str], name: Optional[str] = None, phone: Optional[str] = None) -> Optional[Dict[str, Any]]:
        if not any([street, city, postal_code, country]):
            return None
        return {
            "first_name": name or (prof_row.first_name if prof_row else None),
            "last_name": prof_row.last_name if prof_row else None,
            "phone": phone or (prof_row.phone if prof_row else None),
            "street": street,
            "city": city,
            "postal_code": postal_code,
            "country": country,
        }
    
    billing = make_address(
        prof_row.billing_street if prof_row else None,
        prof_row.billing_city if prof_row else None,
        prof_row.billing_postal_code if prof_row else None,
        prof_row.billing_country if prof_row else None,
    ) if prof_row else None
    
    shipping = None
    if prof_row and not prof_row.same_as_billing:
        shipping = make_address(
            prof_row.shipping_street,
            prof_row.shipping_city,
            prof_row.shipping_postal_code,
            prof_row.shipping_country,
        )
    elif prof_row and prof_row.same_as_billing:
        shipping = billing
    
    # --- OBJEDNÁVKY ---
    orders_list = db.query(models.Order).filter(models.Order.user_id == user_id).order_by(models.Order.created_at.desc()).all()
    orders = [
        {
            "id": o.id,
            "status": o.status,
            "total": str(o.total),
            "payment_method": o.payment_method,
            "shipping_method": o.shipping_method,
            "created_at": o.created_at.isoformat() if o.created_at else None,
            "updated_at": o.updated_at.isoformat() if o.updated_at else None,
        }
        for o in orders_list
    ]
    
    return {
        "user": {
            "id": u.id,
            "email": u.email,
            "role": u.role,
            "is_admin": u.is_admin,
            "is_corporate": u.is_corporate,
        },
        "profile": profile,
        "addresses": {
            "billing": billing,
            "shipping": shipping,
        },
        "orders": orders,
    }

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

    u.role = new_role
    db.commit()
    db.refresh(u)
    return {"id": u.id, "email": u.email, "role": u.role}

# -------- CORPORATE FLAG --------
class CorporatePayload(BaseModel):
    is_corporate: bool

@router.patch("/{user_id}/corporate", dependencies=[Depends(require_admin)])
def admin_set_corporate(
    user_id: int,
    payload: CorporatePayload,
    db: Session = Depends(_get_db),
):
    u = db.get(models.User, user_id)
    if not u:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Uživatel nenalezen.")

    u.is_corporate = payload.is_corporate
    db.commit()
    db.refresh(u)
    return {"id": u.id, "email": u.email, "is_corporate": u.is_corporate}
