from __future__ import annotations
from decimal import Decimal
from typing import Optional
import io, os

from fastapi import APIRouter, Depends, HTTPException, Path, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_user
from app.db import models

try:
    import segno  # pip install segno
except Exception:  # pragma: no cover
    segno = None

router = APIRouter(tags=["client: payments"])


# ---------- helpers ----------
def _bank_cfg(currency: str = "CZK") -> dict:
    """Vrať bankovní konfiguraci podle měny"""
    currency = (currency or "CZK").upper()
    
    if currency == "EUR":
        iban = os.getenv("BANK_IBAN_EUR") or os.getenv("EUR_IBAN") or "CZ4501000001312792550287"
        bic = os.getenv("BANK_BIC_EUR") or os.getenv("EUR_BIC") or os.getenv("BANK_BIC") or "GIBACZPX"
    else:  # CZK nebo default
        iban = os.getenv("BANK_IBAN") or os.getenv("SHOP_IBAN") or os.getenv("BANK_IBAN_CZK") or "CZ1234567890123456789012"
        bic = os.getenv("BANK_BIC") or os.getenv("SHOP_BIC") or "GIBACZPX"
    
    name = (
        os.getenv("BANK_ACCOUNT_NAME")
        or os.getenv("BANK_NAME")
        or os.getenv("SHOP_ACCOUNT_NAME")
        or "Arte Moderno s.r.o."
    )
    return {"iban": iban.strip(), "bic": bic.strip(), "name": name.strip()}

def _fmt_amount(v: Optional[Decimal | float | int]) -> float:
    try:
        return float(v or 0)
    except Exception:
        return 0.0

def _get_currency(order: models.Order) -> str:
    """Vrať měnu objednávky (CZK/EUR atd.) nebo výchozí CZK"""
    currency = getattr(order, "currency", None)
    if currency and currency.upper() in ("CZK", "EUR", "USD", "GBP"):
        return currency.upper()
    return "CZK"

def _ensure_vs(order: models.Order) -> str:
    # preferuj uložené vs_code (migrace), jinak vytvoř a ulož
    if getattr(order, "vs_code", None):
        return order.vs_code  # type: ignore
    import random, string
    vs = "".join(random.choices(string.digits, k=9))
    order.vs_code = vs
    return vs

def _vs(order: models.Order) -> str:
    return (getattr(order, "vs_code", None) or str(order.id)).strip()


# ---------- klientská API ----------
@router.post("/orders/{order_id}/pay-intent/bank-transfer")
def begin_bank_transfer(
    order_id: int = Path(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Přepne objednávku do 'pending_payment' (pokud byla 'draft'),
    nastaví payment_method='bank_transfer' a vygeneruje/uloží VS.
    """
    o = db.get(models.Order, order_id)
    if not o or (o.user_id and current_user and o.user_id != current_user.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    if o.status not in ("draft", "pending_payment"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Cannot pay in status '{o.status}'.")

    o.payment_method = "bank_transfer"
    _ensure_vs(o)
    
    # Při přechodu na pending_payment odečteme stock (tvrdá rezervace)
    if o.status == "draft":
        # Odečti stock pro všechny položky objednávky
        for item in o.items:
            product = db.get(models.Product, item.product_id)
            if product:
                current_stock = int(product.stock or 0)
                if current_stock < int(item.qty or 0):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Nedostatečná zásoba pro produkt {product.id} (máme {current_stock}, potřebujete {item.qty})"
                    )
                product.stock = current_stock - int(item.qty or 0)
        
        o.status = "pending_payment"

    db.add(o)
    db.commit()
    db.refresh(o)

    currency = _get_currency(o)
    cfg = _bank_cfg(currency)
    return {
        "order_id": o.id,
        "status": o.status,
        "payment_method": o.payment_method,
        "vs_code": o.vs_code,
        "iban": cfg["iban"] or None,
        "amount": _fmt_amount(o.total),
        "currency": currency,
    }


@router.get("/orders/{order_id}/status")
def get_order_status(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    o = db.get(models.Order, order_id)
    if not o or (o.user_id and current_user and o.user_id != current_user.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    currency = _get_currency(o)
    return {
        "order_id": o.id,
        "status": o.status,
        "payment_method": o.payment_method,
        "vs_code": getattr(o, "vs_code", None),
        "currency": currency,
        "updated_at": getattr(o, "updated_at", None).isoformat() if getattr(o, "updated_at", None) else None,  # type: ignore
    }


@router.get("/orders/{order_id}/bank")
def get_order_bank_info(order_id: int, db: Session = Depends(get_db)):
    o = db.get(models.Order, order_id)
    if not o:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    currency = _get_currency(o)
    cfg = _bank_cfg(currency)
    return {
        "account_iban": cfg["iban"] or None,
        "account_bic": cfg["bic"] or None,
        "account_name": cfg["name"],
        "variable_symbol": _vs(o),
        "amount": _fmt_amount(o.total),
        "currency": currency,
        "qr_png_url": f"/api/client/v1/orders/{o.id}/bank/qr.png" if cfg["iban"] else None,
    }


@router.get("/orders/{order_id}/bank/qr.png", response_class=StreamingResponse)
def get_order_bank_qr_png(order_id: int, db: Session = Depends(get_db)):
    """
    Generuje QR kód ve formátu SPD (Structured Payment Description).
    Podporuje CZK i EUR.
    """
    o = db.get(models.Order, order_id)
    if not o:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    currency = _get_currency(o)
    cfg = _bank_cfg(currency)
    if not cfg["iban"]:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bank info not configured")
    if segno is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="segno not installed")
    amount_str = f"{_fmt_amount(o.total):.2f}"
    
    # SPD formát: SPD*1.0*ACC:...+BIC*AM:...*CC:...*X-VS:...*MSG:...
    # Každé pole odděleno *
    spd_parts = [
        "SPD",
        "1.0",
        f"ACC:{cfg['iban']}{'+' + cfg['bic'] if cfg['bic'] else ''}",
        f"AM:{amount_str}",
        f"CC:{currency}",
        f"X-VS:{_vs(o)}",
        f"MSG:Objednavka {o.id} {cfg['name'][:35]}",
    ]
    spd_string = "*".join(spd_parts)

    try:
        q = segno.make(spd_string, micro=False)
        buf = io.BytesIO()
        q.save(buf, kind="png", scale=6, border=2)
        buf.seek(0)
        return StreamingResponse(buf, media_type="image/png")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate QR code: {str(e)}"
        )