from __future__ import annotations
import csv
import io
from typing import Optional, List

from fastapi import APIRouter, Depends, Query
from fastapi import status as http_status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.core.deps import get_db, require_admin
from app.db import models  # Order, OrderItem, Product, User

# DŮLEŽITÉ: jiný prefix, aby se to nestřetlo s /orders/{id}
router = APIRouter(prefix="/exports", tags=["admin: orders export"])

ALLOWED_STATUSES = {"draft", "pending_payment", "paid", "shipped", "canceled"}


@router.get("/orders", dependencies=[Depends(require_admin)])
def admin_export_orders_csv(
    status_filter: Optional[str] = Query(
        None, description="draft|pending_payment|paid|shipped|canceled"
    ),
    user_id: Optional[int] = Query(None, ge=1),
    min_total: Optional[float] = Query(None, ge=0),
    max_total: Optional[float] = Query(None, ge=0),
    db: Session = Depends(get_db),
):
    """
    CSV export objednávek.
    URL: /api/admin/v1/exports/orders
    Sloupce: order_id, user_id, user_email, status, total, items_count, shipping_method, payment_method
    """
    q = db.query(models.Order)
    conds = []

    if status_filter:
        s = status_filter.lower().strip()
        if s not in ALLOWED_STATUSES:
            from fastapi import HTTPException
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail="Neplatný status.",
            )
        conds.append(models.Order.status == s)

    if user_id is not None:
        conds.append(models.Order.user_id == user_id)
    if min_total is not None:
        conds.append(models.Order.total >= min_total)
    if max_total is not None:
        conds.append(models.Order.total <= max_total)

    if conds:
        q = q.filter(and_(*conds))

    rows: List[models.Order] = q.order_by(models.Order.id.desc()).all()

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(
        [
            "order_id",
            "user_id",
            "user_email",
            "status",
            "total",
            "items_count",
            "shipping_method",
            "payment_method",
        ]
    )

    for o in rows:
        user_email = None
        if o.user_id:
            u = db.get(models.User, o.user_id)
            if u:
                user_email = getattr(u, "email", None)

        items_count = (
            db.query(models.OrderItem).filter(models.OrderItem.order_id == o.id).count()
        )

        writer.writerow(
            [
                o.id,
                o.user_id or "",
                user_email or "",
                o.status or "",
                float(o.total),
                items_count,
                o.shipping_method or "",
                o.payment_method or "",
            ]
        )

    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="orders_export.csv"'},
    )
