# app/api_admin/v1/routes_orders.py - KOMPLETNÍ SOUBOR
from __future__ import annotations
from typing import Optional, List
from datetime import datetime
from io import BytesIO
import os
from email.message import EmailMessage

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status as http_status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.core.deps import get_db, require_admin, get_current_user
from app.db import models
from app.core.mailer import _smtp_client
from app.api_admin.v1.routes_invoices import _invoice_pdf_bytes, INVOICE_I18N, _pick_lang
from app.core.stock_service import (
    on_bank_transfer_to_paid,
    on_cod_to_paid,
    on_cod_to_shipped,
    on_order_canceled,
)

router = APIRouter(prefix="/orders", tags=["admin: orders"])

ALLOWED_STATUSES = {"draft", "pending_payment", "paid", "shipped", "canceled", "reklamace"}


# ---------- LIST ----------
@router.get("/", dependencies=[Depends(require_admin)])
def admin_list_orders(
    status_filter: Optional[str] = Query(None, description="draft|pending_payment|paid|shipped|canceled|reklamace"),
    user_id: Optional[int] = Query(None, ge=1),
    created_after: Optional[datetime] = Query(None),
    created_before: Optional[datetime] = Query(None),
    min_total: Optional[float] = Query(None, ge=0),
    max_total: Optional[float] = Query(None, ge=0),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """
    ADMIN: list objednávek s filtry a stránkováním.
    """
    q = db.query(models.Order)
    conds = []

    if status_filter:
        s = status_filter.lower().strip()
        if s not in ALLOWED_STATUSES:
            raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail="Neplatný status.")
        conds.append(models.Order.status == s)

    if user_id is not None:
        conds.append(models.Order.user_id == user_id)

    if min_total is not None:
        conds.append(models.Order.total >= min_total)
    if max_total is not None:
        conds.append(models.Order.total <= max_total)

    if conds:
        q = q.filter(and_(*conds))

    total = q.count()
    rows: List[models.Order] = (
        q.order_by(models.Order.id.desc()).offset(offset).limit(limit).all()
    )

    items = []
    for o in rows:
        items_count = db.query(models.OrderItem).filter(models.OrderItem.order_id == o.id).count()

        user_email = None
        if o.user_id:
            u = db.get(models.User, o.user_id)
            if u:
                user_email = getattr(u, "email", None)

        artist_names: List[str] = []
        order_items: List[models.OrderItem] = db.query(models.OrderItem).filter(
            models.OrderItem.order_id == o.id
        ).all()
        for it in order_items:
            if not it.product_id:
                continue
            p = db.get(models.Product, it.product_id)
            if not p or not p.artist_id:
                continue
            artist = db.get(models.Artist, p.artist_id)
            if artist and artist.name:
                artist_names.append(artist.name)

        distinct_artists = sorted(set(artist_names), key=lambda x: artist_names.index(x))
        artists_str = ", ".join(distinct_artists) if distinct_artists else None

        items.append({
            "id": o.id,
            "user_id": o.user_id,
            "user_email": user_email,
            "status": o.status,
            "total": float(o.total),
            "currency": o.currency,
            "shipping_method": o.shipping_method,
            "payment_method": o.payment_method,
            "items_count": items_count,
            "artists": distinct_artists,
            "artists_str": artists_str,
        })

    return {"total": total, "limit": limit, "offset": offset, "items": items}


# ---------- DETAIL ----------
@router.get("/{order_id}", dependencies=[Depends(require_admin)])
def admin_get_order(
    order_id: int = Path(..., ge=1),
    db: Session = Depends(get_db),
):
    """
    Detail objednávky.
    """
    o = db.get(models.Order, order_id)
    if not o:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Objednávka nenalezena.")

    user_email = None
    if o.user_id:
        u = db.get(models.User, o.user_id)
        if u:
            user_email = getattr(u, "email", None)

    items_q: List[models.OrderItem] = (
        db.query(models.OrderItem).filter(models.OrderItem.order_id == o.id).all()
    )
    items = []
    for it in items_q:
        p = db.get(models.Product, it.product_id) if it.product_id else None
        artist_name = None
        if p and p.artist_id:
            a = db.get(models.Artist, p.artist_id)
            if a and a.name:
                artist_name = a.name
        unit_price = float(it.unit_price) if it.unit_price is not None else None
        line_total = float(it.unit_price) * int(it.qty) if it.unit_price is not None else None

        items.append({
            "id": it.id,
            "product_id": it.product_id,
            "product_title": p.title if p else None,
            "artist_name": artist_name,
            "qty": it.qty,
            "unit_price": unit_price,
            "line_total": line_total,
        })

    audits: List[models.OrderStatusAudit] = (
        db.query(models.OrderStatusAudit)
        .filter(models.OrderStatusAudit.order_id == o.id)
        .order_by(models.OrderStatusAudit.created_at.asc())
        .all()
    )
    status_history = []
    for r in audits:
        changed_by_email = None
        if r.changed_by_user_id:
            cu = db.get(models.User, r.changed_by_user_id)
            if cu and getattr(cu, "email", None):
                changed_by_email = cu.email
        status_history.append({
            "id": r.id,
            "from_status": r.from_status,
            "to_status": r.to_status,
            "reason": r.reason,
            "created_at": r.created_at.isoformat() if getattr(r, "created_at", None) else None,
            "changed_by_user_id": r.changed_by_user_id,
            "changed_by_user_email": changed_by_email,
        })

    return {
        "id": o.id,
        "user_id": o.user_id,
        "user_email": user_email,
        "email": user_email,
        "status": o.status,
        "total": float(o.total),
        "currency": o.currency,
        "shipping_method": o.shipping_method,
        "payment_method": o.payment_method,
        "created_at": getattr(o, "created_at", None),
        "items": items,
        "status_history": status_history,
    }


# ---------- STATUS AUDIT ----------
@router.get("/{order_id}/status-audit", dependencies=[Depends(require_admin)])
def admin_get_order_status_audit(
    order_id: int = Path(..., ge=1),
    db: Session = Depends(get_db),
):
    """
    Audit změn stavů pro objednávku.
    """
    o = db.get(models.Order, order_id)
    if not o:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Objednávka nenalezena.")

    audits: List[models.OrderStatusAudit] = (
        db.query(models.OrderStatusAudit)
        .filter(models.OrderStatusAudit.order_id == order_id)
        .order_by(models.OrderStatusAudit.created_at.asc())
        .all()
    )
    out = []
    for r in audits:
        changed_by_email = None
        if r.changed_by_user_id:
            cu = db.get(models.User, r.changed_by_user_id)
            if cu and getattr(cu, "email", None):
                changed_by_email = cu.email
        out.append({
            "id": r.id,
            "from_status": r.from_status,
            "to_status": r.to_status,
            "reason": r.reason,
            "created_at": r.created_at.isoformat() if getattr(r, "created_at", None) else None,
            "changed_by_user_id": r.changed_by_user_id,
            "changed_by_user_email": changed_by_email,
        })
    return {"order_id": order_id, "items": out}


# ---------- UPDATE STATUS - S STOCK LOGIKOU ----------
class StatusPayload(BaseModel):
    status: str = Field(..., description="Nový status: draft|pending_payment|paid|shipped|canceled|reklamace")
    reason: Optional[str] = Field(None, description="Důvod změny (audit)")


@router.post("/{order_id}/status", dependencies=[Depends(require_admin)])
def admin_set_order_status(
    order_id: int,
    payload: StatusPayload,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    """
    Změnit status objednávky s respektováním stock logiky.
    
    Stock změny:
    - bank_transfer: pending_payment → paid = tvrdá rezervace (stock -)
    - cod: draft → paid = tvrdá rezervace (stock -)
    - cod: paid → shipped = bez změny (stock byl už -)
    - libovolný → canceled = vrácení do skladu (stock +)
    """
    o = db.get(models.Order, order_id)
    if not o:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Objednávka nenalezena.")

    new_status = payload.status.lower().strip()
    if new_status not in ALLOWED_STATUSES:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail="Neplatný status.")

    prev = o.status or "draft"

    # ========== STOCK LOGIKA PER PAYMENT METHOD ==========
    
    # Bank transfer: pending_payment → paid
    if prev == "pending_payment" and new_status == "paid" and o.payment_method == "bank_transfer":
        on_bank_transfer_to_paid(db, o)
    
    # COD: draft → paid
    elif prev == "draft" and new_status == "paid" and o.payment_method == "cod":
        on_cod_to_paid(db, o)
    
    # COD: paid → shipped
    elif prev == "paid" and new_status == "shipped" and o.payment_method == "cod":
        on_cod_to_shipped(db, o)
    
    # Libovolný → canceled
    elif new_status == "canceled":
        on_order_canceled(db, o)
    
    # Všechny ostatní přechody - standardně bez stock změn
    else:
        o.status = new_status
        db.commit()

    # ========== AUDIT LOG ==========
    audit = models.OrderStatusAudit(
        order_id=o.id,
        from_status=prev,
        to_status=new_status,
        changed_by_user_id=getattr(current, "id", None),
        reason=(payload.reason or None),
    )
    db.add(audit)
    db.commit()
    db.refresh(o)

    return {"id": o.id, "status": o.status}


# ---------- SEND INVOICE BY EMAIL ----------
class SendInvoicePayload(BaseModel):
    to: Optional[str] = Field(None, description="E-mail adresát")
    language: Optional[str] = Field(None, description="Jazyk faktury (cs,en,de,...)")


@router.post("/{order_id}/send-invoice", dependencies=[Depends(require_admin)])
def admin_send_invoice_email(
    order_id: int,
    payload: SendInvoicePayload,
    db: Session = Depends(get_db),
):
    """
    Vygeneruje PDF fakturu a odešle ji e-mailem.
    """
    o = db.get(models.Order, order_id)
    if not o:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Objednávka nenalezena.")

    lang = _pick_lang(o, payload.language)
    t = INVOICE_I18N.get(lang, INVOICE_I18N["cs"])

    to_email = (payload.to or "").strip() if payload.to else None
    if not to_email and o.user_id:
        u = db.get(models.User, o.user_id)
        if u and getattr(u, "email", None):
            to_email = u.email

    if not to_email:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="E-mail příjemce nebyl nalezen."
        )

    items: List[models.OrderItem] = db.query(models.OrderItem).filter(models.OrderItem.order_id == o.id).all()

    # Načti produkty pro fakturu
    product_ids = [int(i.product_id) for i in items if i.product_id is not None]
    products_by_id: dict[int, models.Product] = {}
    if product_ids:
        q = db.query(models.Product).filter(models.Product.id.in_(product_ids))
        for p in q.all():
            try:
                products_by_id[int(p.id)] = p
            except Exception:
                pass

    pdf_bytes = _invoice_pdf_bytes(o, db, lang=lang)

    sender = os.getenv("SMTP_FROM") or os.getenv("SMTP_USER") or "info@kunstkabinett.cz"
    subject = f"{t['subject']} #{o.id}"
    amount_label = _moneyc(getattr(o, 'total', 0), getattr(o, 'currency', 'CZK'))
    body_text = f"""{t['greeting']},

{t['body_intro']} #{o.id}.
{t['to_pay']}: {amount_label}
Status: {o.status}

{t['thanks']}
Arte Moderno
"""
    body_html = f"""<p>{t['greeting']},</p>
<p>{t['body_intro']} <b>#{o.id}</b>.<br>
{t['to_pay']}: <b>{amount_label}</b><br>
Status: <b>{o.status}</b></p>
<p>{t['thanks']}<br>Arte Moderno</p>
"""

    msg = EmailMessage()
    msg["From"] = sender
    msg["Reply-To"] = sender
    msg["To"] = to_email
    msg["Bcc"] = "info@kunstkabinett.cz"  # Skrytá kopie na info@kunstkabinett.cz
    msg["Subject"] = subject
    msg.set_content(body_text or "")
    msg.add_alternative(body_html, subtype="html")
    filename = f"invoice_{o.id}.pdf"
    msg.add_attachment(pdf_bytes, maintype="application", subtype="pdf", filename=filename)

    try:
        with _smtp_client() as c:
            c.send_message(msg)
    except Exception as e:
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send invoice email: {e}"
        )

    return {"ok": True, "sent_to": to_email, "order_id": o.id}
