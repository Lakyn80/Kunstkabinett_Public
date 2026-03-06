from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, condecimal
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_user
from app.db import models
from app.services import coupons as coupon_srv

router = APIRouter(prefix="/coupons", tags=["coupons"])


class CouponValidateIn(BaseModel):
    code: str
    order_total: condecimal(max_digits=12, decimal_places=2)
    currency: Optional[str] = "CZK"  # Přidáno: měna pro validaci


class CouponValidateOut(BaseModel):
    valid: bool
    code: str
    type: Optional[str] = None    # "percent" | "fixed"
    discount: condecimal(max_digits=12, decimal_places=2)
    message: Optional[str] = None


@router.post("/validate", response_model=CouponValidateOut)
def validate_coupon(
    payload: CouponValidateIn,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    code = (payload.code or "").strip()
    if not code:
        raise HTTPException(status_code=400, detail="Missing code")

    order_total = Decimal(payload.order_total)
    if order_total <= 0:
        return CouponValidateOut(valid=False, code=code, discount=Decimal("0.00"), message="Order total must be > 0")

    try:
        currency = (payload.currency or "CZK").upper()
        prev = coupon_srv.preview(
            db,
            code=code,
            subtotal=order_total,
            currency=currency,
            user_id=current_user.id if current_user else None,
        )
        c = coupon_srv.get_coupon_by_code(db, code)
        return CouponValidateOut(
            valid=True,
            code=prev["code"],
            type=(c.type if c else None),  # type: ignore[attr-defined]
            discount=Decimal(prev["discount"]),
            message=None,
        )
    except coupon_srv.CouponError as e:
        msg_map = {
            "invalid": "Coupon not found or inactive",
            "not_started": "Coupon not started",
            "expired": "Coupon expired",
            "min_total": "Order total below minimum",
            "usage_limit": "Coupon usage limit reached",
            "currency_mismatch": "Coupon not valid for this currency",
            "corporate_only": "Corporate only",
        }
        return CouponValidateOut(valid=False, code=code, discount=Decimal("0.00"), message=msg_map.get(e.reason, e.reason))
