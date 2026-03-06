from __future__ import annotations
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
import uuid

from app.db.session import SessionLocal
from app.services.reservations import reserve_items, calc_available_stock, cancel_session

router = APIRouter(prefix="/reservations", tags=["reservations"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class ReserveItem(BaseModel):
    product_id: int = Field(..., gt=0)
    qty: int = Field(1, gt=0)

class ReserveRequest(BaseModel):
    items: List[ReserveItem]
    session_id: Optional[str] = None
    ttl_minutes: Optional[int] = None

class ReserveResponse(BaseModel):
    session_id: str
    expires_at: datetime
    items: List[ReserveItem]

@router.post("", response_model=ReserveResponse, status_code=status.HTTP_201_CREATED)
def create_reservation(payload: ReserveRequest, db: Session = Depends(get_db)):
    session_id = payload.session_id or str(uuid.uuid4())
    created = reserve_items(
        db=db,
        items=[i.model_dump() for i in payload.items],
        session_id=session_id,
        user_id=None,
        ttl_minutes=payload.ttl_minutes,
    )
    expires_at = max(r.expires_at for r in created)
    return ReserveResponse(session_id=session_id, expires_at=expires_at, items=payload.items)

@router.get("/available/{product_id}")
def available_stock(product_id: int, db: Session = Depends(get_db)):
    return {"product_id": product_id, "available": calc_available_stock(db, product_id)}

class CancelRequest(BaseModel):
    session_id: str

@router.post("/cancel")
def cancel_reservation(payload: CancelRequest, db: Session = Depends(get_db)):
    changed = cancel_session(db, payload.session_id)
    if changed == 0:
        raise HTTPException(status_code=404, detail="Rezervace nenalezena nebo už není aktivní.")
    return {"canceled": changed}
