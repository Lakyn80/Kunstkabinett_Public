from __future__ import annotations

from decimal import Decimal
from sqlalchemy import (
    Integer, String, Numeric, Boolean, DateTime, Enum, ForeignKey, text
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

# Enum typ vzniká v migraci – tady jen používáme:
CouponType = Enum(
    "percent", "fixed",
    name="coupon_type",
    native_enum=True,
    create_type=False,
)

class Coupon(Base):
    __tablename__ = "coupon"  # type: ignore

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    type: Mapped[str] = mapped_column(CouponType, nullable=False)
    value: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str | None] = mapped_column(String(3), nullable=True)  # u fixed; percent může mít NULL
    max_uses: Mapped[int | None] = mapped_column(Integer, nullable=True)
    uses: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    per_user_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)
    min_order_total: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    starts_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ends_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=text("now()"))
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=text("now()"))

    # přidáno: jen pro korporát (default True)
    corporate_only: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))

    redemptions: Mapped[list["CouponRedemption"]] = relationship(
        back_populates="coupon",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class CouponRedemption(Base):
    __tablename__ = "coupon_redemption"  # type: ignore

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    coupon_id: Mapped[int] = mapped_column(
        ForeignKey("coupon.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    user_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    order_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)  # (FK není v migraci – ponecháno)
    amount_discounted: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=text("now()"))

    coupon: Mapped["Coupon"] = relationship(back_populates="redemptions")
