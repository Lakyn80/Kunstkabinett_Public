from __future__ import annotations
from datetime import datetime
from typing import Optional, Dict

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, and_
from sqlalchemy.orm import Session

from app.core.deps import get_db, require_admin
from app.db import models
from app.db.models_reservations import StockReservation

router = APIRouter(prefix="/dashboard", tags=["admin: dashboard"])

@router.get("/summary", dependencies=[Depends(require_admin)])
def admin_dashboard_summary(
    since: Optional[datetime] = Query(None, description="Od kdy (ISO datetime) — filtr pro metriky založené na čase"),
    until: Optional[datetime] = Query(None, description="Do kdy (ISO datetime) — filtr pro metriky založené na čase"),
    db: Session = Depends(get_db),
) -> Dict:
    """
    Základní souhrn pro admin dashboard.
    - počty: users, products, categories, orders (podle statusů)
    - rezervace: active/consumed/expired/canceled
    - revenue (součet total) pro zaplacené objednávky v období (pokud since/until)
    Pozn.: pokud nemáš timestampy u objednávek, revenue se vezme napříč vším PAID.
    """

    # --- základní počty ---
    users_count = db.query(func.count(models.User.id)).scalar() or 0
    products_count = db.query(func.count(models.Product.id)).scalar() or 0
    categories_count = db.query(func.count(models.Category.id)).scalar() or 0

    # --- objednávky podle statusu ---
    order_statuses = ["draft", "pending_payment", "paid", "shipped", "canceled"]
    orders_by_status = {}
    for st in order_statuses:
        cnt = db.query(func.count(models.Order.id)).filter(models.Order.status == st).scalar() or 0
        orders_by_status[st] = cnt

    # --- rezervace podle statusu ---
    res_statuses = ["active", "consumed", "expired", "canceled"]
    reservations_by_status = {}
    for st in res_statuses:
        cnt = db.query(func.count(StockReservation.id)).filter(StockReservation.status == st).scalar() or 0
        reservations_by_status[st] = cnt

    # --- revenue (paid) v období ---
    # Pokud máš na Order sloupec created_at, můžeš přidat filtr created_at mezi since/until.
    paid_q = db.query(func.coalesce(func.sum(models.Order.total), 0)).filter(models.Order.status == "paid")
    # Příklad, kdybys měl models.Order.created_at:
    # if since:
    #     paid_q = paid_q.filter(models.Order.created_at >= since)
    # if until:
    #     paid_q = paid_q.filter(models.Order.created_at <= until)
    revenue_paid = float(paid_q.scalar() or 0.0)

    return {
        "users_count": users_count,
        "products_count": products_count,
        "categories_count": categories_count,
        "orders_by_status": orders_by_status,
        "reservations_by_status": reservations_by_status,
        "revenue_paid": revenue_paid,
        # echo parametry (užitečné pro FE)
        "since": since,
        "until": until,
    }
