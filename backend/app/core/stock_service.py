# app/core/stock_service.py
"""
Centrální logika pro správu zásob a rezervací.
Všechny 3 payment flows zde.
"""
from sqlalchemy.orm import Session
from app.db import models


def get_available_stock(db: Session, product_id: int) -> int:
    """
    Dostupný stock pro frontend = fyzický stock.
    Stock se odečítá při přechodu na pending_payment, takže fyzický stock
    už obsahuje jen dostupné množství.
    """
    product = db.get(models.Product, product_id)
    if not product:
        return 0
    
    # Vracíme přímo fyzický stock, protože při pending_payment se už odečetl
    physical_stock = int(product.stock or 0)
    return max(0, physical_stock)


def reserve_for_card_payment(db: Session, order: models.Order) -> tuple[bool, str]:
    """
    Platba kartou: tvrdá rezervace IHNED, stock se odečítá.
    Vrací (True, "") pokud OK, jinak (False, "error message")
    """
    for item in order.items:
        available = get_available_stock(db, item.product_id)
        if available < item.qty:
            product = db.get(models.Product, item.product_id)
            return False, f"Produkt '{product.title}': není dost skladem (máme {available}, potřebujete {item.qty})"
    
    # Tvrdá rezervace - odečteme ihned
    for item in order.items:
        product = db.get(models.Product, item.product_id)
        if product:
            product.stock = int(product.stock or 0) - int(item.qty or 0)
    
    order.status = "paid"
    db.commit()
    return True, ""


def reserve_for_bank_transfer(db: Session, order: models.Order) -> tuple[bool, str]:
    """
    Bankovní převod: měkká rezervace (zmizí z eshopu, skladu až na paid).
    Vrací (True, "") pokud OK, jinak (False, "error message")
    """
    for item in order.items:
        available = get_available_stock(db, item.product_id)
        if available < item.qty:
            product = db.get(models.Product, item.product_id)
            return False, f"Produkt '{product.title}': není dost skladem (máme {available}, potřebujete {item.qty})"
    
    order.payment_method = "bank_transfer"
    order.status = "draft"
    db.commit()
    return True, ""


def on_bank_transfer_to_pending(db: Session, order: models.Order) -> None:
    """Klient klikne zaplatit převodem: draft → pending_payment"""
    order.status = "pending_payment"
    db.commit()


def on_bank_transfer_to_paid(db: Session, order: models.Order) -> None:
    """Admin potvrdí platbu: pending_payment → paid. Stock už byl odečten při pending_payment, takže jen změníme status."""
    # Stock už byl odečten při přechodu na pending_payment, takže jen změníme status
    order.status = "paid"
    db.commit()


def on_bank_transfer_expired(db: Session, order: models.Order) -> None:
    """Pending > 30 minut bez potvrzení. Vrátí na draft, zruší payment_method."""
    order.status = "draft"
    order.payment_method = None
    db.commit()


def reserve_for_cod(db: Session, order: models.Order) -> tuple[bool, str]:
    """
    Osobní odběr (COD): měkká rezervace (zmizí z eshopu, skladu až na shipped).
    Vrací (True, "") pokud OK, jinak (False, "error message")
    """
    for item in order.items:
        available = get_available_stock(db, item.product_id)
        if available < item.qty:
            product = db.get(models.Product, item.product_id)
            return False, f"Produkt '{product.title}': není dost skladem (máme {available}, potřebujete {item.qty})"
    
    order.payment_method = "cod"
    order.status = "draft"
    db.commit()
    return True, ""


def on_cod_to_paid(db: Session, order: models.Order) -> None:
    """Admin změní COD na paid: stock se odečítá."""
    for item in order.items:
        product = db.get(models.Product, item.product_id)
        if product:
            product.stock = int(product.stock or 0) - int(item.qty or 0)
    
    order.status = "paid"
    db.commit()


def on_cod_to_shipped(db: Session, order: models.Order) -> None:
    """Klient si to vyzvedl: paid → shipped. Nic nového, stock už byl odečten."""
    order.status = "shipped"
    db.commit()


def on_cod_expired(db: Session, order: models.Order) -> None:
    """COD vypršela (30 minut bez potvrzení). Vrátí na draft."""
    order.status = "draft"
    order.payment_method = None
    db.commit()


def on_order_canceled(db: Session, order: models.Order) -> None:
    """
    Objednávka zrušena z libovolného statusu.
    Vrátí stock zpět pro všechny statusy kromě draft (draft ještě nemá odečtený stock).
    """
    # Vrať stock zpět pro pending_payment, paid, shipped (tyto statusy mají odečtený stock)
    if order.status in ("pending_payment", "paid", "shipped"):
        for item in order.items:
            product = db.get(models.Product, item.product_id)
            if product:
                product.stock = int(product.stock or 0) + int(item.qty or 0)
    
    order.status = "canceled"
    db.commit()