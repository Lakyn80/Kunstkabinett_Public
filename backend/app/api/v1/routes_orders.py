# app/api/v1/routes_orders.py  ← CLIENT
from __future__ import annotations
from typing import List, Optional, Dict
from decimal import Decimal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Path, Query, status, Request
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.db import models
from app.api.v1.schemas_orders import OrderCreate, OrderOut, OrderItemIn
from app.core.deps import get_current_user, require_admin
from app.services import coupons as coupon_srv
from app.services.mailer import send_email

CURRENCY = "CZK"

# DVA ROUTERY: /orders a /api/client/v1/orders
router_root = APIRouter(prefix="/orders", tags=["orders"])
router_v1 = APIRouter(prefix="/api/client/v1/orders", tags=["orders"])

# Stavy, které NESMÍ jít mazat/zrušit
NON_CANCELABLE = {"paid", "refunded", "refund", "chargeback", "disputed", "complaint", "reklamace"}
NON_DELETABLE  = {"paid", "refunded", "refund", "chargeback", "disputed", "complaint", "reklamace"}

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def _register_handlers(router: APIRouter):

    @router.get("/", response_model=List[OrderOut], dependencies=[Depends(require_admin)])
    def list_orders(
        db: Session = Depends(get_db),
        limit: int = Query(50, ge=1, le=200),
        offset: int = Query(0, ge=0),
    ):
        rows = db.scalars(
            select(models.Order)
            .order_by(models.Order.id.desc())
            .offset(offset)
            .limit(limit)
        ).all()
        return list(rows)

    @router.get("/my", response_model=List[OrderOut])
    def list_my_orders(
        db: Session = Depends(get_db),
        current_user: models.User = Depends(get_current_user),
        limit: int = Query(50, ge=1, le=200),
        offset: int = Query(0, ge=0),
    ):
        rows = db.scalars(
            select(models.Order)
            .where(
                models.Order.user_id == current_user.id,
                models.Order.status != "expired",
            )
            .order_by(models.Order.id.desc())
            .offset(offset)
            .limit(limit)
        ).all()
        return list(rows)

    @router.get("/{order_id}", response_model=OrderOut)
    def get_order(
        order_id: int = Path(..., gt=0),
        db: Session = Depends(get_db),
        current_user: models.User = Depends(get_current_user),
    ):
        order: Optional[models.Order] = db.get(models.Order, int(order_id))
        if order is None:
            raise HTTPException(status_code=404, detail="Objednávka nenalezena.")
        is_admin = bool(getattr(current_user, "is_admin", False)) or getattr(current_user, "role", "") in {"admin", "editor"}
        if (not is_admin) and (order.user_id != current_user.id):
            raise HTTPException(status_code=404, detail="Objednávka nenalezena.")
        return order

    @router.post("/", response_model=OrderOut, status_code=status.HTTP_201_CREATED)
    def create_order(
        payload: OrderCreate,
        background_tasks: BackgroundTasks,
        db: Session = Depends(get_db),
        current_user: models.User = Depends(get_current_user),
        request: Request = None,
    ):
        """Vytvoří objednávku – sklad se neodečítá zde."""
        try:
            data = payload.model_dump()

            # --- robustní načtení položek: podpora qty i quantity, items i cart_items ---
            raw_items = (data.get("items") or data.get("cart_items") or []) or []
            norm_raw: List[dict] = []
            for ri in raw_items:
                if not isinstance(ri, dict):
                    continue
                # sjednoť qty
                if "qty" not in ri and "quantity" in ri:
                    ri = {**ri, "qty": ri.get("quantity")}
                norm_raw.append(ri)

            items: List[OrderItemIn] = [OrderItemIn(**ri) for ri in norm_raw if "product_id" in ri and "qty" in ri]
            if not items:
                raise HTTPException(status_code=400, detail="Objednávka musí obsahovat alespoň jednu položku.")

            product_ids = list({int(it.product_id) for it in items})
            products_list: List[models.Product] = list(
                db.scalars(select(models.Product).where(models.Product.id.in_(product_ids))).all()
            )
            products: Dict[int, models.Product] = {int(p.id): p for p in products_list}

            subtotal = Decimal("0.00")
            order_items_data: List[dict] = []
            for it in items:
                pid = int(it.product_id)
                product = products.get(pid)
                if product is None:
                    raise HTTPException(status_code=400, detail=f"Produkt id={pid} neexistuje.")
                # Použij get_available_stock pro kontrolu dostupného množství
                from app.core.stock_service import get_available_stock
                available_stock = get_available_stock(db, pid)
                if available_stock < int(it.qty):
                    raise HTTPException(
                        status_code=400, 
                        detail=f"Nedostatečná zásoba pro produkt '{product.title}' (dostupné: {available_stock}, požadováno: {it.qty})."
                    )
                # Použij správnou cenu podle měny objednávky
                order_currency = (payload.currency or "CZK").upper()
                if order_currency == "EUR" and getattr(product, "price_eur", None) is not None:
                    unit_price = Decimal(str(product.price_eur))
                else:
                    unit_price = Decimal(str(product.price))
                subtotal += unit_price * int(it.qty)
                order_items_data.append({"product_id": pid, "qty": int(it.qty), "unit_price": unit_price})

            coupon_code = (data.get("coupon_code") or "").strip() if isinstance(data.get("coupon_code"), str) else ""
            discount = Decimal("0.00")
            order_currency = (payload.currency or "CZK").upper()
            # Zjisti jazyk – z payload nebo z Accept-Language
            allowed_langs = {"cs","en","de","fr","ru","zh","ja","it","pl"}
            order_lang = (payload.language or "").strip().lower() if payload.language else None
            if not order_lang and request:
                accept = (request.headers.get("accept-language") or "").split(",")[0].strip().lower()
                order_lang = accept[:2] if accept else None
            if order_lang not in allowed_langs:
                order_lang = "cs"
            if coupon_code:
                prev = coupon_srv.preview(
                    db,
                    code=coupon_code,
                    subtotal=subtotal,
                    currency=order_currency,
                    user_id=current_user.id,
                )
                discount = Decimal(str(prev["discount"]))

            total = subtotal - discount
            if total < 0:
                total = Decimal("0.00")
            order = models.Order(
                user_id=current_user.id,
                status="draft",
                total=total,
                shipping_method=data.get("shipping_method"),
                payment_method=data.get("payment_method"),
                coupon_code=coupon_code or None,
                discount_total=discount,
                currency=order_currency,
                language=order_lang,
            )
            db.add(order)
            db.flush()

            for item in order_items_data:
                db.add(models.OrderItem(order_id=order.id, **item))

            db.commit()
            db.refresh(order)

            # Best-effort: send order confirmation email (do not break checkout if SMTP fails)
            try:
                to_email = getattr(current_user, "email", None)
                if to_email:
                    currency_label = (order_currency or "CZK").upper()
                    lines = []
                    for it in order_items_data:
                        pid = int(it["product_id"])
                        qty = int(it["qty"])
                        unit_price = it["unit_price"]
                        p = products.get(pid)
                        title = getattr(p, "title", None) if p else None
                        line = f"- {title or f'Produkt #{pid}'} × {qty} @ {unit_price} {currency_label}"
                        lines.append(line)

                    subject = f"Potvrzení objednávky #{order.id}"
                    body_text = (
                        "Dobrý den,\n\n"
                        f"potvrzujeme přijetí objednávky #{order.id}.\n"
                        f"Celkem: {order.total} {currency_label}\n"
                        f"Platba: {order.payment_method or '-'}\n"
                        f"Doprava: {order.shipping_method or '-'}\n\n"
                        "Položky:\n"
                        + ("\n".join(lines) if lines else "-\n")
                        + "\n\n"
                        "Děkujeme za nákup.\n"
                        "Kunstkabinett / Arte Moderno\n"
                    )
                    body_html = (
                        "<p>Dobrý den,</p>"
                        f"<p>potvrzujeme přijetí objednávky <b>#{order.id}</b>.</p>"
                        f"<p><b>Celkem:</b> {order.total} {currency_label}<br>"
                        f"<b>Platba:</b> {order.payment_method or '-'}<br>"
                        f"<b>Doprava:</b> {order.shipping_method or '-'}</p>"
                        "<p><b>Položky:</b><br>"
                        + "<br>".join([l.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;") for l in lines])
                        + "</p>"
                        "<p>Děkujeme za nákup.<br>Kunstkabinett / Arte Moderno</p>"
                    )

                    # Send asynchronously; never block checkout on SMTP
                    background_tasks.add_task(
                        send_email,
                        to=to_email,
                        subject=subject,
                        body_text=body_text,
                        body_html=body_html,
                    )
            except Exception:
                # Never fail order creation because of email problems.
                import logging
                logging.getLogger(__name__).exception("Failed to send order confirmation email")

            return order

        except HTTPException:
            db.rollback()
            raise
        except IntegrityError as ie:
            db.rollback()
            raise HTTPException(status_code=400, detail=f"DB chyba: {ie}") from ie
        except Exception as e:
            db.rollback()
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"Neočekávaná chyba: {str(e)}") from e

    @router.post("/{order_id}/cancel")
    def cancel_order(
        order_id: int = Path(..., gt=0),
        db: Session = Depends(get_db),
        current_user: models.User = Depends(get_current_user),
    ):
        from app.core.stock_service import on_order_canceled
        
        o: Optional[models.Order] = db.get(models.Order, order_id)
        if not o:
            raise HTTPException(status_code=404, detail="Objednávka nenalezena")

        is_admin = bool(getattr(current_user, "is_admin", False)) or getattr(current_user, "role", "") in {"admin", "editor"}
        if (not is_admin) and (o.user_id != current_user.id):
            raise HTTPException(status_code=403, detail="Zakázáno")

        if o.status in NON_CANCELABLE:
            raise HTTPException(status_code=409, detail="Zaplacené nebo reklamované objednávky nelze zrušit")

        # Použij stock_service pro správné vrácení stocku
        on_order_canceled(db, o)
        db.refresh(o)
        return {"id": o.id, "status": o.status}

    @router.delete("/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
    def delete_order(
        order_id: int = Path(..., gt=0),
        db: Session = Depends(get_db),
        current_user: models.User = Depends(get_current_user),
    ):
        from app.core.stock_service import on_order_canceled
        
        o: Optional[models.Order] = db.get(models.Order, order_id)
        if not o:
            raise HTTPException(status_code=404, detail="Objednávka nenalezena")

        is_admin = bool(getattr(current_user, "is_admin", False)) or getattr(current_user, "role", "") in {"admin", "editor"}
        if (not is_admin) and (o.user_id != current_user.id):
            raise HTTPException(status_code=403, detail="Zakázáno")

        if o.status in NON_DELETABLE:
            raise HTTPException(status_code=409, detail="Zaplacené nebo reklamované objednávky nelze smazat")

        if o.status not in ("draft", "pending_payment", "canceled", "expired"):
            raise HTTPException(status_code=409, detail="Tuto objednávku nelze smazat")

        # Vrať stock zpět před smazáním (pokud má objednávka odečtený stock)
        if o.status in ("pending_payment", "paid", "shipped"):
            on_order_canceled(db, o)
            # Objednávka už má status "canceled", takže ji můžeme smazat
        elif o.status == "draft":
            # Draft ještě nemá odečtený stock, takže jen smaž
            pass

        db.delete(o)
        db.commit()
        return  # 204

# zaregistruj stejné handlery na oba prefixy
_register_handlers(router_root)
_register_handlers(router_v1)
