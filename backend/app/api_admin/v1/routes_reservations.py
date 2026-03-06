from __future__ import annotations
from datetime import datetime, timedelta, timezone
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi import status as http_status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.core.deps import get_db, require_admin
from app.db.models_reservations import StockReservation
from app.db import models  # Product, User

router = APIRouter(prefix="/reservations", tags=["admin: reservations"])

ALLOWED_STATUSES = {"active", "consumed", "expired", "canceled"}


# ---------- LIST ----------
@router.get("/", dependencies=[Depends(require_admin)], response_model=None)
def list_reservations(
    status_filter: Optional[str] = Query(None, description="Filtrovat: active|consumed|expired|canceled"),
    product_id: Optional[int] = Query(None, ge=1),
    user_id: Optional[int] = Query(None, ge=1),
    session_id: Optional[str] = Query(None, min_length=4, max_length=64),
    expires_before: Optional[datetime] = Query(None, description="ISO datetime – expiruje před"),
    created_after: Optional[datetime] = Query(None, description="ISO datetime – vytvořeno po"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """
    ADMIN: list rezervací s filtry a stránkováním.
    Vrací dict s položkami rozšířenými o název produktu a email uživatele.
    """
    q = db.query(StockReservation)
    conds = []

    if status_filter:
        s = status_filter.lower()
        if s not in ALLOWED_STATUSES:
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail=f"Neplatný status '{status_filter}'. Povolené: {', '.join(sorted(ALLOWED_STATUSES))}",
            )
        conds.append(StockReservation.status == s)

    if product_id is not None:
        conds.append(StockReservation.product_id == product_id)

    if user_id is not None:
        conds.append(StockReservation.user_id == user_id)

    if session_id:
        conds.append(StockReservation.session_id == session_id)

    if expires_before:
        conds.append(StockReservation.expires_at <= expires_before)

    if created_after:
        conds.append(StockReservation.created_at >= created_after)

    if conds:
        q = q.filter(and_(*conds))

    total = q.count()
    rows: List[StockReservation] = (
        q.order_by(StockReservation.created_at.desc())
         .offset(offset)
         .limit(limit)
         .all()
    )

    out = []
    for r in rows:
        product_title = None
        user_email = None

        p = db.get(models.Product, r.product_id)
        if p:
            product_title = p.title

        if r.user_id:
            u = db.get(models.User, r.user_id)
            if u:
                user_email = getattr(u, "email", None)

        out.append({
            "id": r.id,
            "product_id": r.product_id,
            "product_title": product_title,
            "user_id": r.user_id,
            "user_email": user_email,
            "qty": r.qty,
            "session_id": r.session_id,
            "status": r.status,
            "created_at": r.created_at,
            "expires_at": r.expires_at,
        })

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "items": out,
    }


# ---------- BULK CANCEL ----------
class CancelPayload(BaseModel):
    session_id: Optional[str] = Field(None, min_length=4, max_length=64, description="Zruší všechny ACTIVE rezervace v dané session")
    ids: Optional[List[int]] = Field(None, description="Konkrétní ID rezervací ke zrušení")
    only_active: bool = Field(True, description="Pokud True, ruší jen ACTIVE (doporučeno)")

@router.post("/cancel", dependencies=[Depends(require_admin)])
def admin_cancel_reservations(payload: CancelPayload, db: Session = Depends(get_db)):
    """
    ADMIN: hromadné zrušení rezervací.
    - Pokud je zadán `session_id`, zruší všechny odpovídající rezervace.
    - Pokud jsou zadána `ids`, zruší konkrétní rezervace.
    - Výchozí je rušit jen ACTIVE (bezpečné).
    """
    if not payload.session_id and not payload.ids:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail="Zadej alespoň session_id nebo ids.")

    q = db.query(StockReservation)

    conds = []
    if payload.session_id:
        conds.append(StockReservation.session_id == payload.session_id)
    if payload.ids:
        conds.append(StockReservation.id.in_(payload.ids))
    if payload.only_active:
        conds.append(StockReservation.status == "active")

    if conds:
        q = q.filter(and_(*conds))

    count = q.count()
    if count == 0:
        return {"canceled": 0}

    q.update({"status": "canceled"})
    db.commit()
    return {"canceled": count}


# ---------- EXTEND TTL ----------
class ExtendPayload(BaseModel):
    session_id: Optional[str] = Field(None, min_length=4, max_length=64, description="Prodlouží ACTIVE rezervace v dané session")
    ids: Optional[List[int]] = Field(None, description="Konkrétní ID rezervací k prodloužení")
    minutes: int = Field(..., ge=1, le=120, description="O kolik minut prodloužit (1–120)")

@router.post("/extend", dependencies=[Depends(require_admin)])
def admin_extend_reservations(payload: ExtendPayload, db: Session = Depends(get_db)):
    """
    ADMIN: prodloužení expirace ACTIVE rezervací o N minut.
    Prodlouží jen ty, které ještě neexpirovaly (expires_at > now).
    """
    if not payload.session_id and not payload.ids:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail="Zadej alespoň session_id nebo ids.")

    now = datetime.now(timezone.utc)

    q = db.query(StockReservation).filter(
        StockReservation.status == "active",
        StockReservation.expires_at > now,
    )

    if payload.session_id:
        q = q.filter(StockReservation.session_id == payload.session_id)
    if payload.ids:
        q = q.filter(StockReservation.id.in_(payload.ids))

    rows = q.all()
    if not rows:
        return {"extended": 0}

    for r in rows:
        r.expires_at = r.expires_at + timedelta(minutes=payload.minutes)

    db.commit()
    return {"extended": len(rows), "minutes_added": payload.minutes}
