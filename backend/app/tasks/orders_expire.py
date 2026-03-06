"""Background task: expire pending orders."""
import asyncio
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from app.db import models
from app.db.models import Order
from app.core.stock_service import on_order_canceled
from fastapi import FastAPI

logger = logging.getLogger(__name__)


def _expire_pending_orders(db: Session) -> dict[str, Any]:
    """
    Expire pending orders that have been in draft/pending_payment state too long.
    Vrátí produkty do skladu (stejně jako při canceled).
    
    Returns dict with 'expired_count' and 'error' (if any).
    """
    try:
        ttl_minutes = int(os.getenv("ORDER_EXPIRE_MINUTES", "30"))
        cutoff_time = datetime.now(timezone.utc) - timedelta(minutes=ttl_minutes)

        # Query for orders to expire
        stmt = select(Order).where(
            and_(
                Order.status.in_(["draft", "pending_payment"]),
                Order.payment_method.in_(["bank_transfer", "cod", None]),
                Order.created_at < cutoff_time,
            )
        )
        orders = list(db.execute(stmt).scalars().all())

        expired_count = 0
        for order in orders:
            try:
                # Pokud byla objednávka ve stavu pending_payment, vrať stock zpět
                # (draft objednávky ještě nemají odečtený stock)
                if order.status == "pending_payment":
                    for item in order.items:
                        product = db.get(models.Product, item.product_id)
                        if product:
                            product.stock = int(product.stock or 0) + int(item.qty or 0)
                
                # Změň status na expired a zruš payment_method
                order.status = "expired"
                order.payment_method = None
                db.add(order)
                expired_count += 1
            except Exception as e:
                logger.error(f"Error expiring order {order.id}: {e}")
                db.rollback()
                continue

        if expired_count > 0:
            db.commit()
            logger.info(f"Expired {expired_count} pending orders and restored stock")

        return {"expired_count": expired_count, "error": None}

    except Exception as e:
        logger.error(f"Error in _expire_pending_orders: {e}", exc_info=True)
        return {"expired_count": 0, "error": str(e)}


async def _worker(interval_sec: int = 60) -> None:
    """Periodically check and expire old pending orders."""
    from app.db.session import SessionLocal

    ttl_minutes = int(os.getenv("ORDER_EXPIRE_MINUTES", "30"))
    logger.info(f"Starting orders_expire worker (interval={interval_sec}s, ttl={ttl_minutes}min)")

    while True:
        try:
            db = SessionLocal()
            try:
                result = _expire_pending_orders(db)
                if result["error"]:
                    logger.warning(f"Worker run had error: {result['error']}")
                elif result["expired_count"] > 0:
                    logger.info(f"Worker run: expired {result['expired_count']} orders")
            finally:
                db.close()

        except Exception as e:
            logger.error(f"orders_expire worker error: {e}", exc_info=True)

        await asyncio.sleep(interval_sec)


def register_orders_expire(app: FastAPI) -> None:
    """Register the orders_expire background task (called from main.py lifespan)."""
    logger.info("Registering orders_expire background task...")
    
    @app.on_event("startup")
    async def _startup():
        # Spusť worker v pozadí (neblokuje start aplikace)
        asyncio.create_task(_worker())
        logger.info("orders_expire background task started")