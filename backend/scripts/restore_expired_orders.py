# backend/app/scripts/restore_expired_orders.py
from __future__ import annotations

import argparse
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import select, and_
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.db import models


def restore_and_delete_expired_orders(
    db: Session,
    status: str = "expired",
    older_than_minutes: int = 0,
    dry_run: bool = False,
) -> dict:
    """
    Vrátí sklad z položek objednávek se zadaným statusem (default 'expired')
    a tyto objednávky odstraní z DB.

    older_than_minutes > 0 = filtruj jen ty, které jsou starší než prah.
    dry_run=True = jen vypíše, nic nemění.
    """
    now = datetime.utcnow()
    threshold: Optional[datetime] = None
    if older_than_minutes and older_than_minutes > 0:
        threshold = now - timedelta(minutes=int(older_than_minutes))

    # preferuj created_at, fallback na updated_at
    time_col = models.Order.created_at if hasattr(models.Order, "created_at") else models.Order.updated_at

    conds = [models.Order.status == status]
    if threshold is not None:
        conds.append(time_col <= threshold)

    orders = list(db.scalars(select(models.Order).where(and_(*conds))).all())

    restored_items = 0
    products_touched = set()

    for o in orders:
        # vrátit kusy na sklad
        for it in o.items:
            p = it.product
            if p:
                p.stock = int(p.stock or 0) + int(it.qty or 0)
                products_touched.add(int(p.id))
                restored_items += int(it.qty or 0)

        # smažeme objednávku (položky se smažou díky cascade)
        if not dry_run:
            db.delete(o)

    if not dry_run and orders:
        db.commit()

    return {
        "orders_found": len(orders),
        "products_touched": len(products_touched),
        "qty_restored": restored_items,
        "dry_run": dry_run,
        "status": status,
        "older_than_minutes": older_than_minutes,
    }


def main():
    ap = argparse.ArgumentParser(description="Restore stock from expired orders and delete those orders.")
    ap.add_argument("--status", default="expired", help="Jaký status čistit (default: expired)")
    ap.add_argument(
        "--older-than",
        type=int,
        default=0,
        help="Jen objednávky starší než N minut (0 = bez limitu).",
    )
    ap.add_argument("--dry-run", action="store_true", help="Pouze vypsat, nic neměnit.")
    args = ap.parse_args()

    db = SessionLocal()
    try:
        res = restore_and_delete_expired_orders(
            db,
            status=args.status,
            older_than_minutes=args.older_than,
            dry_run=args.dry_run,
        )
        print(
            f"[restore_expired_orders] status={res['status']} older_than={res['older_than_minutes']}min "
            f"orders_found={res['orders_found']} products_touched={res['products_touched']} "
            f"qty_restored={res['qty_restored']} dry_run={res['dry_run']}"
        )
    finally:
        db.close()


if __name__ == "__main__":
    main()
