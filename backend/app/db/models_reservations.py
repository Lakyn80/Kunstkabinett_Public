from __future__ import annotations
from datetime import datetime, timedelta, timezone
from typing import Optional
from sqlalchemy import String, Integer, DateTime, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

class StockReservation(Base):
    """
    Měkká rezervace kusů před dokončením objednávky (checkout).
    - status: active | consumed | expired | canceled
    - session_id: identifikátor checkout session (UUID/str)
    """
    __tablename__: str = "stock_reservation"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("product.id"), nullable=False, index=True)
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("user.id"), nullable=True, index=True)
    qty: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    session_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="active")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    # volitelné navázání (bez backrefů do existujících modelů, aby se neměnilo models.py)
    product = relationship("Product", viewonly=True)
    user = relationship("User", viewonly=True)

    __table_args__ = (
        Index("ix_reservation_active", "product_id", "status", "expires_at"),
        Index("ix_reservation_session", "session_id", "status"),
    )

    @staticmethod
    def make_expires_at(ttl_minutes: int) -> datetime:
        return datetime.now(timezone.utc) + timedelta(minutes=ttl_minutes)
