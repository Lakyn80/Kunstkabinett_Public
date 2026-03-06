from __future__ import annotations
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from app.db.session import SessionLocal
from app.db.models import Order, OrderItem, Product
from app.db.models_reservations import StockReservation
from app.services.reservations import consume_reservations

router = APIRouter(prefix="/orders", tags=["orders"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class ConfirmRequest(BaseModel):
    session_id: str = Field(..., min_length=8)
    shipping_method: str | None = None
    payment_method: str | None = None
    user_id: int | None = None

class ConfirmResponse(BaseModel):
    order_id: int
    status: str

@router.post("/confirm", response_model=ConfirmResponse, status_code=status.HTTP_201_CREATED)
def confirm_from_reservation(payload: ConfirmRequest, db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    rows: List[StockReservation] = (
        db.query(StockReservation)
        .filter(
            StockReservation.session_id == payload.session_id,
            StockReservation.status == "active",
            StockReservation.expires_at > now,
        )
        .all()
    )
    if not rows:
        raise HTTPException(status_code=400, detail="Rezervace nenalezena nebo vypršela.")

    # kontrola skladů (race safety)
    total = 0.0
    for r in rows:
        product = db.get(Product, r.product_id)
        if not product:
            raise HTTPException(status_code=400, detail=f"Produkt {r.product_id} neexistuje.")
        if product.stock < r.qty:
            raise HTTPException(status_code=409, detail=f"Nedostatečná zásoba pro produkt {product.id}.")
    # odečet
    for r in rows:
        product = db.get(Product, r.product_id)
        if not product:
            raise HTTPException(status_code=400, detail=f"Produkt {r.product_id} neexistuje.")
        product.stock -= r.qty
        total += float(product.price) * int(r.qty)

    order = Order(
        user_id=payload.user_id,
        status="pending_payment",
        total=total,
        shipping_method=payload.shipping_method,
        payment_method=payload.payment_method,
    )
    db.add(order)
    db.flush()

    for r in rows:
        product = db.get(Product, r.product_id)
        if not product:
            raise HTTPException(status_code=400, detail=f"Produkt {r.product_id} neexistuje.")
        db.add(OrderItem(
            order_id=order.id,
            product_id=product.id,
            qty=r.qty,
            unit_price=product.price,
        ))

    consume_reservations(db, payload.session_id)
    db.commit()
    return ConfirmResponse(order_id=order.id, status=order.status)
