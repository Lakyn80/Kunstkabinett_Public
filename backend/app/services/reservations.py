from __future__ import annotations
from typing import List, Optional
from decimal import Decimal
from datetime import datetime, timezone
import os

from sqlalchemy import func
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from app.db.models_reservations import StockReservation
from app.db.models import Product  # pouze pro čtení

# >>> 30 minut default
DEFAULT_TTL_MIN = int(os.getenv("RESERVATION_TTL_MINUTES", "30"))
# <<<

def get_active_reserved_qty(db: Session, product_id: int) -> int:
    q = (
        db.query(func.coalesce(func.sum(StockReservation.qty), 0))
        .filter(
            StockReservation.product_id == product_id,
            StockReservation.status == "active",
            StockReservation.expires_at > datetime.now(timezone.utc),
        )
    )
    try:
        return int(q.scalar() or 0)
    except SQLAlchemyError:
        return 0

def calc_available_stock(db: Session, product_id: int) -> int:
    product: Optional[Product] = db.get(Product, product_id)
    if not product:
        return 0
    reserved = get_active_reserved_qty(db, product_id)
    return max(0, int(product.stock) - reserved)

def reserve_items(
    db: Session,
    items: List[dict],
    session_id: str,
    user_id: Optional[int] = None,
    ttl_minutes: Optional[int] = None,
):
    ttl = int(ttl_minutes or DEFAULT_TTL_MIN)
    now = datetime.now(timezone.utc)

    # validace dostupnosti
    for it in items:
        pid = int(it["product_id"])
        qty = int(it.get("qty", 1))
        if qty <= 0:
            raise ValueError("qty must be > 0")
        available = calc_available_stock(db, pid)
        if available < qty:
            raise ValueError(f"Nedostatečný sklad pro product_id={pid}: dostupné {available}, požadováno {qty}")

    # vytvoř rezervace
    created: List[StockReservation] = []
    for it in items:
        pid = int(it["product_id"])
        qty = int(it.get("qty", 1))
        res = StockReservation(
            product_id=pid,
            user_id=user_id,
            qty=qty,
            session_id=session_id,
            status="active",
            created_at=now,
            expires_at=StockReservation.make_expires_at(ttl),
        )
        db.add(res)
        created.append(res)

    db.commit()
    for r in created:
        db.refresh(r)
    return created

def consume_reservations(db: Session, session_id: str) -> list[StockReservation]:
    now = datetime.now(timezone.utc)
    rows = (
        db.query(StockReservation)
        .filter(
            StockReservation.session_id == session_id,
            StockReservation.status == "active",
            StockReservation.expires_at > now,
        )
        .with_for_update()
        .all()
    )
    for r in rows:
        r.status = "consumed"
    db.commit()
    return rows

def cancel_session(db: Session, session_id: str) -> int:
    q = db.query(StockReservation).filter(
        StockReservation.session_id == session_id,
        StockReservation.status == "active",
    )
    count = q.count()
    q.update({"status": "canceled"})
    db.commit()
    return count

def cleanup_expired(db: Session) -> int:
    now = datetime.now(timezone.utc)
    q = db.query(StockReservation).filter(
        StockReservation.status == "active",
        StockReservation.expires_at <= now,
    )
    count = q.count()
    q.update({"status": "expired"})
    db.commit()
    return count
