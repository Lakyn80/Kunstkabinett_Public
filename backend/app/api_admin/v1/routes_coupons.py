# backend/app/api_admin/v1/routes_coupons.py
from __future__ import annotations
from typing import Literal, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, condecimal
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.db.models_coupons import Coupon


def get_db():
  db = SessionLocal()
  try:
    yield db
  finally:
    db.close()


router = APIRouter(prefix="/coupons", tags=["admin:coupons"])


class CouponIn(BaseModel):
  code: str
  type: Literal["percent", "fixed"]
  value: condecimal(max_digits=12, decimal_places=2)
  currency: Optional[Literal["CZK", "EUR"]] = None
  max_uses: int | None = None
  per_user_limit: int | None = None
  min_order_total: condecimal(max_digits=12, decimal_places=2) | None = None
  starts_at: str | None = None
  ends_at: str | None = None
  active: bool = True


class CouponPatch(BaseModel):
  code: Optional[str] = None
  type: Optional[Literal["percent", "fixed"]] = None
  value: Optional[condecimal(max_digits=12, decimal_places=2)] = None
  currency: Optional[Literal["CZK", "EUR"]] = None
  max_uses: Optional[int] = None
  per_user_limit: Optional[int] = None
  min_order_total: Optional[condecimal(max_digits=12, decimal_places=2)] = None
  starts_at: Optional[str] = None
  ends_at: Optional[str] = None
  active: Optional[bool] = None


def _serialize(c: Coupon) -> dict:
  return {
    "id": c.id,
    "code": c.code,
    "type": str(c.type),
    "value": str(c.value) if c.value is not None else None,
    "currency": c.currency,
    "max_uses": c.max_uses,
    "per_user_limit": c.per_user_limit,
    "min_order_total": str(c.min_order_total) if c.min_order_total is not None else None,
    "starts_at": c.starts_at,
    "ends_at": c.ends_at,
    "active": c.active,
    "uses": c.uses,
  }


@router.get("/")
def list_coupons(
  q: str | None = None,
  limit: int = Query(50, ge=1, le=200),
  offset: int = Query(0, ge=0),
  db: Session = Depends(get_db),
):
  qs = db.query(Coupon)
  if q:
    qs = qs.filter(Coupon.code.ilike(f"%{q.strip()}%"))
  items = qs.order_by(Coupon.id.desc()).limit(limit).offset(offset).all()
  return {"items": [_serialize(c) for c in items]}


@router.post("/", status_code=201)
def create_coupon(payload: CouponIn, db: Session = Depends(get_db)):
  code = payload.code.strip().upper()
  exists = db.query(Coupon).filter(Coupon.code == code).first()
  if exists:
    raise HTTPException(status_code=400, detail="code_exists")

  c = Coupon(
    code=code,
    type=payload.type,
    value=payload.value,
    currency=payload.currency,
    max_uses=payload.max_uses,
    per_user_limit=payload.per_user_limit,
    min_order_total=payload.min_order_total,
    starts_at=payload.starts_at,
    ends_at=payload.ends_at,
    active=payload.active,
  )
  db.add(c)
  db.commit()
  db.refresh(c)
  return {"id": c.id, "code": c.code}


@router.get("/{coupon_id}")
def get_coupon(coupon_id: int, db: Session = Depends(get_db)):
  c = db.get(Coupon, coupon_id)
  if not c:
    raise HTTPException(status_code=404, detail="Not Found")
  return _serialize(c)


@router.patch("/{coupon_id}")
def patch_coupon(coupon_id: int, payload: CouponPatch, db: Session = Depends(get_db)):
  c = db.get(Coupon, coupon_id)
  if not c:
    raise HTTPException(status_code=404, detail="Not Found")

  data = payload.dict(exclude_unset=True)
  if "code" in data and data["code"] is not None:
    data["code"] = data["code"].strip().upper()
    dupe = db.query(Coupon).filter(Coupon.code == data["code"], Coupon.id != coupon_id).first()
    if dupe:
      raise HTTPException(status_code=400, detail="code_exists")

  for k, v in data.items():
    setattr(c, k, v)

  db.add(c)
  db.commit()
  db.refresh(c)
  return _serialize(c)
