from __future__ import annotations
import asyncio
from datetime import datetime, timedelta, timezone
from fastapi import FastAPI
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.db import models
from app.services.reservations import cleanup_expired


def _expire_old_orders(db: Session, max_age_minutes: int = 30) -> int:
    """
    Draft/pending_payment starší než N minut označ 'expired',
    ať zmizí z /orders/my a zboží se uvolní.
    """
    now = datetime.now(timezone.utc)
    threshold = now - timedelta(minutes=max_age_minutes)

    q = (
        db.query(models.Order)
        .filter(
            models.Order.status.in_(["draft", "pending_payment"]),
            models.Order.updated_at < threshold,   # máš-li created_at, použij raději ten
        )
    )
    rows = list(q.all())
    for o in rows:
        o.status = "expired"
    if rows:
        db.commit()
    return len(rows)


async def _worker(interval_sec: int = 60, order_ttl_min: int = 30):
    while True:
        try:
            db = SessionLocal()
            try:
                # 1) expirovat ACTIVE rezervace → status 'expired'
                cleanup_expired(db)
                # 2) expirovat staré neuhrazené objednávky
                _expire_old_orders(db, max_age_minutes=order_ttl_min)
            finally:
                db.close()
        except asyncio.CancelledError:
            # korektní ukončení při shutdownu
            break
        except Exception:
            # v produkci zaloguj
            pass
        await asyncio.sleep(interval_sec)


def register_cleanup(app: FastAPI):
    @app.on_event("startup")
    async def _startup():
        # spustí se na pozadí; nic dalšího neměň
        asyncio.create_task(_worker())
