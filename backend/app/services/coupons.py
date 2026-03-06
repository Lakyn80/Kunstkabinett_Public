from __future__ import annotations
from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.db.models_coupons import Coupon
from app.db.models import User  # kvůli kontrole is_corporate


class CouponError(Exception):
    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


def _norm(code: str) -> str:
    return (code or "").strip().upper()


def get_coupon_by_code(db: Session, code: str) -> Coupon | None:
    return (
        db.query(Coupon)
        .filter(func.upper(Coupon.code) == _norm(code))
        .first()
    )


def _user_is_corporate(db: Session, user_id: int | None) -> bool:
    if not user_id:
        return False
    u = db.get(User, int(user_id))
    if not u:
        return False
    return bool(getattr(u, "is_corporate", False))


def preview(
    db: Session,
    *,
    code: str,
    subtotal: Decimal,
    currency: str,
    user_id: int | None = None,
) -> dict:
    """
    Vrátí {'code','discount'} nebo vyhodí CouponError s důvodem:
    'invalid' | 'not_started' | 'expired' | 'min_total' | 'usage_limit' | 'currency_mismatch' | 'corporate_only'
    """
    c = get_coupon_by_code(db, code)
    if not c or not c.active:  # type: ignore
        raise CouponError("invalid")

    # corporate guard
    if bool(getattr(c, "corporate_only", False)) and not _user_is_corporate(db, user_id):
        raise CouponError("corporate_only")

    now = datetime.now(timezone.utc)

    if c.starts_at and now < c.starts_at:
        raise CouponError("not_started")
    if c.ends_at and now > c.ends_at:
        raise CouponError("expired")
    if c.min_order_total is not None and Decimal(subtotal) < Decimal(c.min_order_total):
        raise CouponError("min_total")
    if c.max_uses is not None and c.uses is not None and c.uses >= c.max_uses:
        raise CouponError("usage_limit")

    if str(c.type) == "fixed":
        if c.currency and c.currency != currency:
            raise CouponError("currency_mismatch")
        discount = min(Decimal(c.value), Decimal(subtotal))
    else:
        discount = (Decimal(subtotal) * Decimal(c.value) / Decimal("100")).quantize(Decimal("0.01"))
        if discount > Decimal(subtotal):
            discount = Decimal(subtotal)

    return {"code": c.code, "discount": str(discount)}
