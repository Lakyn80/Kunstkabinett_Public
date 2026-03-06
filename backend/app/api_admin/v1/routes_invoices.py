from __future__ import annotations

from datetime import datetime, timedelta
from decimal import Decimal
from io import BytesIO
from typing import Any, Dict, List, Optional, Tuple
import html
import os

from fastapi import APIRouter, Body, Depends, HTTPException, Path as FPath
from fastapi import status as http_status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.core.deps import get_db, require_admin
from app.db import models
from app.db.models_profile import Profile
from app.services.mailer import send_email

router = APIRouter(prefix="/invoices", tags=["admin: invoices"])

INVOICE_I18N = {
    "cs": {
        "invoice": "Faktura",
        "tax_note": "Daňový doklad",
        "vat_payer": "plátce DPH:",
        "currency": "Měna",
        "issued": "Vystaveno",
        "due": "Splatnost",
        "vs": "VS",
        "supplier": "Dodavatel",
        "customer": "Odběratel",
        "payment": "Platba",
        "shipping": "Doprava",
        "payment_info": "Platební údaje",
        "recipient": "Příjemce",
        "amount": "Částka",
        "items": "Položky",
        "qty": "Ks",
        "price_unit": "Cena/ks",
        "total": "Celkem",
        "subtotal": "Mezisoučet",
        "discount": "Sleva",
        "to_pay": "K úhradě",
        "footer": "Generováno automaticky. V případě dotazů pište na",
        "email": "E-mail",
        "phone": "Telefon",
        "address": "Adresa",
        "shipping_address": "Dorucovaci adresa",
        "name": "Jméno",
        "subject": "Faktura k objednávce",
        "greeting": "Dobrý den",
        "body_intro": "v příloze posíláme fakturu k Vaší objednávce",
        "thanks": "S pozdravem",
    },
    "en": {
        "invoice": "Invoice",
        "tax_note": "Tax document",
        "vat_payer": "VAT payer:",
        "currency": "Currency",
        "issued": "Issued",
        "due": "Due date",
        "vs": "Reference",
        "supplier": "Supplier",
        "customer": "Customer",
        "payment": "Payment",
        "shipping": "Shipping",
        "payment_info": "Payment details",
        "recipient": "Recipient",
        "amount": "Amount",
        "items": "Items",
        "qty": "Qty",
        "price_unit": "Unit price",
        "total": "Total",
        "subtotal": "Subtotal",
        "discount": "Discount",
        "to_pay": "Amount due",
        "footer": "Generated automatically. For questions, contact",
        "email": "E-mail",
        "phone": "Phone",
        "address": "Address",
        "shipping_address": "Shipping address",
        "name": "Name",
        "subject": "Invoice for order",
        "greeting": "Hello",
        "body_intro": "we are sending the invoice for your order",
        "thanks": "Best regards",
    },
    "de": {
        "invoice": "Rechnung",
        "tax_note": "Steuerbeleg",
        "vat_payer": "MwSt.-Zahler:",
        "currency": "Währung",
        "issued": "Ausgestellt",
        "due": "Fällig",
        "vs": "Referenz",
        "supplier": "Lieferant",
        "customer": "Kunde",
        "payment": "Zahlung",
        "shipping": "Versand",
        "payment_info": "Zahlungsdetails",
        "recipient": "Empfänger",
        "amount": "Betrag",
        "items": "Positionen",
        "qty": "Menge",
        "price_unit": "Preis/Stk",
        "total": "Gesamt",
        "subtotal": "Zwischensumme",
        "discount": "Rabatt",
        "to_pay": "Zu zahlen",
        "footer": "Automatisch erstellt. Fragen an",
        "email": "E-Mail",
        "phone": "Telefon",
        "address": "Adresse",
        "shipping_address": "Lieferadresse",
        "name": "Name",
        "subject": "Rechnung für Bestellung",
        "greeting": "Guten Tag",
        "body_intro": "wir senden Ihnen die Rechnung für Ihre Bestellung",
        "thanks": "Mit freundlichen Grüßen",
    },
    "fr": {
        "invoice": "Facture",
        "tax_note": "Document fiscal",
        "vat_payer": "Assujetti TVA :",
        "currency": "Devise",
        "issued": "Émis",
        "due": "Échéance",
        "vs": "Référence",
        "supplier": "Fournisseur",
        "customer": "Client",
        "payment": "Paiement",
        "shipping": "Livraison",
        "payment_info": "Coordonnées bancaires",
        "recipient": "Bénéficiaire",
        "amount": "Montant",
        "items": "Articles",
        "qty": "Qté",
        "price_unit": "Prix/pc",
        "total": "Total",
        "subtotal": "Sous-total",
        "discount": "Remise",
        "to_pay": "À payer",
        "footer": "Généré automatiquement. Pour toute question, contactez",
        "email": "E-mail",
        "phone": "Téléphone",
        "address": "Adresse",
        "shipping_address": "Adresse de livraison",
        "name": "Nom",
        "subject": "Facture pour la commande",
        "greeting": "Bonjour",
        "body_intro": "nous vous envoyons la facture pour votre commande",
        "thanks": "Cordialement",
    },
    "ru": {
        "invoice": "Счёт",
        "tax_note": "Налоговый документ",
        "vat_payer": "Плательщик НДС:",
        "currency": "Валюта",
        "issued": "Выставлен",
        "due": "Срок оплаты",
        "vs": "Назначение",
        "supplier": "Поставщик",
        "customer": "Покупатель",
        "payment": "Оплата",
        "shipping": "Доставка",
        "payment_info": "Платёжные данные",
        "recipient": "Получатель",
        "amount": "Сумма",
        "items": "Товары",
        "qty": "Кол-во",
        "price_unit": "Цена/шт",
        "total": "Итого",
        "subtotal": "Промежуточно",
        "discount": "Скидка",
        "to_pay": "К оплате",
        "footer": "Сгенерировано автоматически. Вопросы направляйте на",
        "email": "E-mail",
        "phone": "Телефон",
        "address": "Адрес",
        "shipping_address": "Shipping address",
        "name": "Имя",
        "subject": "Счёт за заказ",
        "greeting": "Здравствуйте",
        "body_intro": "присылаем вам счёт за ваш заказ",
        "thanks": "С уважением",
    },
    "zh": {
        "invoice": "发票",
        "tax_note": "税务文件",
        "vat_payer": "增值税纳税人:",
        "currency": "货币",
        "issued": "开具日期",
        "due": "到期日",
        "vs": "参考号",
        "supplier": "供应商",
        "customer": "客户",
        "payment": "付款方式",
        "shipping": "配送",
        "payment_info": "付款信息",
        "recipient": "收款人",
        "amount": "金额",
        "items": "项目",
        "qty": "数量",
        "price_unit": "单价",
        "total": "合计",
        "subtotal": "小计",
        "discount": "折扣",
        "to_pay": "应付金额",
        "footer": "自动生成。如有疑问，请联系",
        "email": "邮箱",
        "phone": "电话",
        "address": "地址",
        "shipping_address": "Shipping address",
        "name": "姓名",
        "subject": "订单发票",
        "greeting": "您好",
        "body_intro": "我们发送了您的订单发票",
        "thanks": "此致",
    },
    "ja": {
        "invoice": "請求書",
        "tax_note": "税務書類",
        "vat_payer": "VAT 納税者:",
        "currency": "通貨",
        "issued": "発行日",
        "due": "支払期日",
        "vs": "参照番号",
        "supplier": "販売者",
        "customer": "購入者",
        "payment": "支払い",
        "shipping": "配送",
        "payment_info": "支払い情報",
        "recipient": "受取人",
        "amount": "金額",
        "items": "品目",
        "qty": "数量",
        "price_unit": "単価",
        "total": "合計",
        "subtotal": "小計",
        "discount": "割引",
        "to_pay": "支払金額",
        "footer": "自動生成。お問い合わせは",
        "email": "メール",
        "phone": "電話",
        "address": "住所",
        "shipping_address": "Shipping address",
        "name": "氏名",
        "subject": "ご注文の請求書",
        "greeting": "こんにちは",
        "body_intro": "ご注文の請求書をお送りします",
        "thanks": "よろしくお願いいたします",
    },
    "it": {
        "invoice": "Fattura",
        "tax_note": "Documento fiscale",
        "vat_payer": "Soggetto IVA:",
        "currency": "Valuta",
        "issued": "Emessa",
        "due": "Scadenza",
        "vs": "Riferimento",
        "supplier": "Fornitore",
        "customer": "Cliente",
        "payment": "Pagamento",
        "shipping": "Spedizione",
        "payment_info": "Dati di pagamento",
        "recipient": "Beneficiario",
        "amount": "Importo",
        "items": "Articoli",
        "qty": "Q.tà",
        "price_unit": "Prezzo/pezzo",
        "total": "Totale",
        "subtotal": "Subtotale",
        "discount": "Sconto",
        "to_pay": "Da pagare",
        "footer": "Generato automaticamente. Per domande contatta",
        "email": "E-mail",
        "phone": "Telefono",
        "address": "Indirizzo",
        "shipping_address": "Indirizzo di spedizione",
        "name": "Nome",
        "subject": "Fattura per l'ordine",
        "greeting": "Salve",
        "body_intro": "inviamo la fattura per il tuo ordine",
        "thanks": "Cordiali saluti",
    },
    "pl": {
        "invoice": "Faktura",
        "tax_note": "Dokument podatkowy",
        "vat_payer": "Płatnik VAT:",
        "currency": "Waluta",
        "issued": "Wystawiono",
        "due": "Termin płatności",
        "vs": "Nr ref.",
        "supplier": "Dostawca",
        "customer": "Klient",
        "payment": "Płatność",
        "shipping": "Dostawa",
        "payment_info": "Dane płatności",
        "recipient": "Odbiorca",
        "amount": "Kwota",
        "items": "Pozycje",
        "qty": "Szt.",
        "price_unit": "Cena/szt.",
        "total": "Razem",
        "subtotal": "Suma częściowa",
        "discount": "Rabat",
        "to_pay": "Do zapłaty",
        "footer": "Wygenerowano automatycznie. Pytania kieruj na",
        "email": "E-mail",
        "phone": "Telefon",
        "address": "Adres",
        "shipping_address": "Adres dostawy",
        "name": "Imię",
        "subject": "Faktura do zamówienia",
        "greeting": "Dzień dobry",
        "body_intro": "przesyłamy fakturę do Twojego zamówienia",
        "thanks": "Pozdrawiamy",
    },
}


def _pick_lang(order: models.Order, lang: Optional[str] = None) -> str:
    allowed = set(INVOICE_I18N.keys())
    if lang and lang.lower() in allowed:
        return lang.lower()
    o_lang = getattr(order, "language", None)
    if isinstance(o_lang, str) and o_lang.lower() in allowed:
        return o_lang.lower()
    return "cs"


# ---------- SCHEMAS ----------
class SendInvoiceRequest(BaseModel):
    email: Optional[EmailStr] = None
    language: Optional[str] = None


# ---------- HELPERS ----------
def _money(x: Decimal | float | int) -> str:
    try:
        return f"{Decimal(str(x)):.2f}"
    except Exception:
        return f"{x}"


def _moneyc(x: Decimal | float | int, currency_code: str) -> str:
    cc = (currency_code or "").strip().upper() or "CZK"
    return f"{_money(x)} {cc}"


def _as_name(x: Any) -> str:
    if x is None:
        return ""
    if isinstance(x, str):
        return x.strip()
    for attr in ("name", "title", "label", "slug"):
        v = getattr(x, attr, None)
        if isinstance(v, str) and v.strip():
            return v.strip()
    try:
        s = str(x)
    except Exception:
        s = ""
    return "" if s.startswith("<") and s.endswith(">") else s


def _as_names_list(xs: Any) -> str:
    if xs is None:
        return ""
    if isinstance(xs, (list, tuple, set)):
        names = [_as_name(x) for x in xs]
        names = [n for n in names if n]
        return ", ".join(names)
    return _as_name(xs)


def _h(x: Any) -> str:
    return html.escape(str(x or ""), quote=True)


def _env(key: str, default: str = "") -> str:
    v = os.getenv(key)
    if v is None:
        return default
    if isinstance(v, str):
        return v.strip()
    return str(v)


def _as_bool_env(key: str, default: bool = False) -> bool:
    raw = _env(key, "")
    if raw == "":
        return default
    return raw.strip().lower() in {"1", "true", "yes", "y", "on"}


def _bank_cfg(currency: str) -> Dict[str, str]:
    cc = (currency or "CZK").strip().upper() or "CZK"
    if cc == "EUR":
        iban = _env("BANK_IBAN_EUR") or _env("EUR_IBAN") or _env("BANK_IBAN") or ""
        bic = _env("BANK_BIC_EUR") or _env("EUR_BIC") or _env("BANK_BIC") or ""
    else:
        iban = _env("BANK_IBAN") or _env("BANK_IBAN_CZK") or _env("SHOP_IBAN") or ""
        bic = _env("BANK_BIC") or _env("BANK_BIC_CZK") or _env("SHOP_BIC") or ""
    name = (
        _env("BANK_ACCOUNT_NAME")
        or _env("BANK_NAME")
        or _env("SHOP_ACCOUNT_NAME")
        or _env("COMPANY_NAME")
        or "Arte Moderno s.r.o."
    )
    return {"iban": iban, "bic": bic, "name": name}


def _supplier_block() -> Dict[str, str]:
    return {
        "name": _env("COMPANY_NAME", "Arte Moderno s.r.o."),
        "ico": _env("COMPANY_ICO", ""),
        "dic": _env("COMPANY_DIC", ""),
        "addr1": _env("COMPANY_ADDR1", ""),
        "addr2": _env("COMPANY_ADDR2", ""),
        "email": _env("COMPANY_EMAIL") or _env("SMTP_FROM") or _env("SMTP_USER") or "info@kunstkabinett.cz",
        "phone": _env("COMPANY_PHONE", ""),
        "web": _env("COMPANY_WEB", ""),
        "vat_payer": "Ano" if _as_bool_env("COMPANY_VAT_PAYER", False) else "Ne",
    }


def _product_meta_label(p: models.Product) -> Tuple[str, str, str]:
    artist_obj = getattr(p, "artist", None) or getattr(p, "author", None)
    author = _as_name(artist_obj) if artist_obj else _as_name(getattr(p, "artist", None) or getattr(p, "author", None))
    title = _as_name(getattr(p, "title", None) or getattr(p, "name", None))
    raw_kind = (
        getattr(p, "kind", None)
        or getattr(p, "type", None)
        or getattr(p, "category", None)
        or getattr(p, "categories", None)
        or getattr(p, "medium", None)
    )
    kind = _as_names_list(raw_kind)
    return author, title, kind


def _format_dt(dt: Any) -> str:
    if not dt:
        return ""
    if isinstance(dt, str):
        return dt
    if isinstance(dt, datetime):
        return dt.strftime("%d.%m.%Y %H:%M")
    try:
        return str(dt)
    except Exception:
        return ""


def _collect_customer(order: models.Order, db: Session) -> Dict[str, str]:
    email = getattr(order, "email", None)
    full_name = ""
    phone = ""
    address = ""
    shipping_address = ""

    user = None
    profile: Optional[Profile] = None
    if getattr(order, "user_id", None):
        user = db.get(models.User, order.user_id)
        if user and user.email:
            email = user.email
        profile = db.query(Profile).filter(Profile.user_id == order.user_id).first()

    if profile:
        parts = [profile.first_name or "", profile.last_name or ""]
        full_name = " ".join([p for p in parts if p.strip()]).strip()
        phone = profile.phone or ""
        address_parts = [
            profile.billing_street or "",
            " ".join([profile.billing_city or "", profile.billing_postal_code or ""]).strip(),
            profile.billing_country or "",
        ]
        address = ", ".join([p for p in address_parts if p.strip()])
        if profile.same_as_billing:
            shipping_address = address
        else:
            shipping_parts = [
                profile.shipping_street or "",
                " ".join([profile.shipping_city or "", profile.shipping_postal_code or ""]).strip(),
                profile.shipping_country or "",
            ]
            shipping_address = ", ".join([p for p in shipping_parts if p.strip()])

    return {
        "email": email or "",
        "full_name": full_name,
        "phone": phone,
        "address": address,
        "shipping_address": shipping_address,
    }


# ---------- PDF BYTES (WeasyPrint primary, ReportLab fallback) ----------
def _invoice_pdf_bytes(order: models.Order, db: Session, lang: Optional[str] = None) -> bytes:
    """
    Generate invoice PDF. Uses WeasyPrint for nice HTML output, falls back to ReportLab if needed.
    """
    items: List[models.OrderItem] = db.query(models.OrderItem).filter(models.OrderItem.order_id == order.id).all()
    products_by_id = {
        int(p.id): p
        for p in db.query(models.Product).filter(
            models.Product.id.in_([i.product_id for i in items if i.product_id])
        ).all()
    }

    currency = (getattr(order, "currency", "CZK") or "CZK").upper()
    item_rows = []
    for it in items:
        p = products_by_id.get(int(it.product_id)) if it.product_id else None
        author, title, kind = _product_meta_label(p) if p else ("", "", "")
        name = title or f"Produkt #{it.product_id}"
        if author:
            name = f"{name} - {author}"
        if kind:
            name = f"{name} ({kind})"
        qty = int(getattr(it, "qty", 1) or 1)
        unit_price = getattr(it, "unit_price", 0) or 0
        line_total = Decimal(str(unit_price)) * Decimal(str(qty))
        item_rows.append({
            "name": name,
            "qty": qty,
            "unit": unit_price,
            "total": line_total,
        })

    subtotal = sum([r["total"] for r in item_rows], Decimal("0.00"))
    discount = getattr(order, "discount_total", Decimal("0.00")) or Decimal("0.00")
    grand_total = getattr(order, "total", subtotal - discount) or subtotal - discount

    customer = _collect_customer(order, db)
    supplier = _supplier_block()
    bank = _bank_cfg(currency)
    vs = (getattr(order, "vs_code", None) or str(getattr(order, "id", "") or "")).strip()

    issued_dt = getattr(order, "created_at", None)
    issue_date = issued_dt.strftime("%d.%m.%Y") if isinstance(issued_dt, datetime) else _format_dt(issued_dt)
    due_date = ""
    if isinstance(issued_dt, datetime):
        due_date = (issued_dt + timedelta(days=14)).strftime("%d.%m.%Y")

    try:
        t = INVOICE_I18N.get(_pick_lang(order, lang), INVOICE_I18N["cs"])
        from weasyprint import HTML  # type: ignore

        discount_row = ""
        if discount and Decimal(str(discount)) != Decimal("0.00"):
            discount_row = f"""
              <tr class="totals">
                <td colspan="4" class="right muted">{_h(t["discount"])}</td>
                <td class="right">-{_moneyc(discount, currency)}</td>
              </tr>
            """

        html = f"""
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    /* ============================
       FONT (diakritika)
       - primárně DejaVu (CZ diakritika OK)
       - weasyprint načítá file:// fonty, pokud jsou v systému
       ============================ */
    @font-face {{
      font-family: "DejaVuSansFA";
      src:
        local("DejaVu Sans"),
        local("DejaVuSans"),
        url("file:///usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
        url("file:///usr/share/fonts/dejavu/DejaVuSans.ttf");
      font-weight: 400;
      font-style: normal;
    }}
    @font-face {{
      font-family: "DejaVuSansFA";
      src:
        local("DejaVu Sans Bold"),
        local("DejaVuSans-Bold"),
        url("file:///usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
        url("file:///usr/share/fonts/dejavu/DejaVuSans-Bold.ttf");
      font-weight: 700;
      font-style: normal;
    }}
    @font-face {{
      font-family: "DejaVuMonoFA";
      src:
        local("DejaVu Sans Mono"),
        local("DejaVuSansMono"),
        url("file:///usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"),
        url("file:///usr/share/fonts/dejavu/DejaVuSansMono.ttf");
      font-weight: 400;
      font-style: normal;
    }}

    /* ============================
       PAGE LAYOUT (full-width header)
       ============================ */
    @page {{
      size: A4;
      margin: 0;
    }}

    * {{ box-sizing: border-box; }}

    body {{
      margin: 0;
      padding: 0;
      font-family: "DejaVuSansFA", DejaVu Sans, Arial, sans-serif;
      color: #111827;
      font-size: 12px;
      line-height: 1.45;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }}

    .page {{
      padding: 16mm 16mm 14mm 16mm;
    }}

    .muted {{ color: #6b7280; }}
    .small {{ font-size: 11px; }}
    .right {{ text-align: right; }}
    .mono {{
      font-family: "DejaVuMonoFA", "DejaVu Sans Mono", ui-monospace, monospace;
    }}

    /* ============================
       HEADER BAND (full width)
       ============================ */
    .header-band {{
      width: 100%;
      background: #111827;
      color: #ffffff;
      padding: 14mm 16mm 10mm 16mm;
    }}

    .header-inner {{
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
    }}

    .brand {{
      font-weight: 700;
      font-size: 14px;
      letter-spacing: 0.3px;
      margin-bottom: 4px;
    }}

    .doc-type {{
      font-size: 12px;
      opacity: 0.92;
      margin-bottom: 8px;
    }}

    .inv-no {{
      font-size: 26px;
      font-weight: 700;
      letter-spacing: 0.3px;
      text-align: right;
      line-height: 1.1;
    }}

    .header-meta {{
      margin-top: 6px;
      font-size: 11px;
      opacity: 0.95;
      text-align: right;
    }}

    .meta-row {{
      display: flex;
      justify-content: flex-end;
      gap: 6px;
      margin: 2px 0;
      white-space: nowrap;
    }}

    .amount-pill {{
      display: inline-block;
      margin-top: 10px;
      padding: 8px 10px;
      border-radius: 10px;
      background: #ffffff;
      color: #111827;
      font-weight: 700;
      border: 1px solid rgba(255,255,255,0.0);
    }}

    /* ============================
       SECTION TITLES
       ============================ */
    .section-title {{
      font-weight: 700;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #111827;
      margin: 0 0 8px 0;
    }}

    /* ============================
       INFO GRID
       ============================ */
    .grid {{
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-top: 10px;
    }}

    .card {{
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      padding: 12px;
      background: #ffffff;
    }}

    .row {{
      display: grid;
      grid-template-columns: 110px 1fr;
      gap: 8px;
      margin: 3px 0;
    }}

    .row > div:first-child {{
      color: #6b7280;
    }}

    /* ============================
       PAYMENT BOX (profi blok)
       ============================ */
    .payment-box {{
      margin-top: 12px;
      border: 2px solid #111827;
      border-radius: 12px;
      padding: 12px;
      background: #ffffff;
    }}

    .payment-grid {{
      display: grid;
      grid-template-columns: 1.2fr 0.8fr;
      gap: 10px;
      align-items: start;
    }}

    .big-amount {{
      font-size: 18px;
      font-weight: 800;
      letter-spacing: 0.2px;
      text-align: right;
      margin-top: 2px;
    }}

    /* ============================
       ITEMS TABLE (profi)
       ============================ */
    table {{
      width: 100%;
      border-collapse: collapse;
      margin-top: 14px;
      font-size: 12px;
    }}

    thead th {{
      background: #f3f4f6;
      color: #111827;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      padding: 9px 8px;
      border-bottom: 2px solid #111827;
    }}

    tbody td {{
      padding: 9px 8px;
      border-bottom: 1px solid #e5e7eb;
      vertical-align: top;
    }}

    tbody tr:nth-child(even) td {{
      background: #fafafa;
    }}

    tfoot td {{
      padding: 7px 8px;
      border-bottom: none;
      background: #ffffff;
    }}

    .totals td {{
      padding-top: 6px;
      padding-bottom: 6px;
    }}

    .total-line td {{
      border-top: 2px solid #111827;
      padding-top: 10px;
      font-weight: 800;
      font-size: 14px;
      background: #ffffff;
    }}

    /* ============================
       FOOTER
       ============================ */
    .footer {{
      margin-top: 18px;
      padding-top: 8px;
      border-top: 1px solid #e5e7eb;
      font-size: 10px;
      color: #6b7280;
    }}
  </style>
</head>
<body>
  <div class="header-band">
    <div class="header-inner">
      <div>
        <div class="brand">{_h(supplier.get("name"))}</div>
        <div class="doc-type">{_h(t["invoice"])} – {_h(t["tax_note"])} ({_h(t["vat_payer"])} {_h(supplier.get("vat_payer"))})</div>
        <div class="small" style="opacity:0.92;">
          {_h(supplier.get("addr1"))}{("<br>" + _h(supplier.get("addr2"))) if (supplier.get("addr2") or "").strip() else ""}
        </div>
      </div>

      <div>
        <div class="inv-no">{_h(t["invoice"])} #{_h(order.id)}</div>
        <div class="header-meta">
          <div class="meta-row"><span>{_h(t["issued"])}:</span> <span class="mono">{_h(issue_date)}</span></div>
          <div class="meta-row"><span>{_h(t["due"])}:</span> <span class="mono">{_h(due_date or "-")}</span></div>
          <div class="meta-row"><span>{_h(t["vs"])}:</span> <span class="mono">{_h(vs or "-")}</span></div>
          <div class="meta-row"><span>{_h(t["currency"])}:</span> <span class="mono">{_h(currency)}</span></div>
          <div class="amount-pill">{_h(t["to_pay"])}: {_h(_moneyc(grand_total, currency))}</div>
        </div>
      </div>
    </div>
  </div>

  <div class="page">
    <div class="grid">
      <div class="card">
        <div class="section-title">{_h(t["supplier"])}</div>
        <div class="row"><div>{_h(t["name"])}</div><div>{_h(supplier.get("name"))}</div></div>
        <div class="row"><div>{_h(t["address"])}</div><div>{_h(supplier.get("addr1"))}<br>{_h(supplier.get("addr2"))}</div></div>
        <div class="row"><div>IČO</div><div>{_h(supplier.get("ico") or "-")}</div></div>
        <div class="row"><div>DIČ</div><div>{_h(supplier.get("dic") or "-")}</div></div>
        <div class="row"><div>{_h(t["email"])}</div><div>{_h(supplier.get("email") or "-")}</div></div>
        <div class="row"><div>{_h(t["phone"])}</div><div>{_h(supplier.get("phone") or "-")}</div></div>
        <div class="row"><div>Web</div><div>{_h(supplier.get("web") or "-")}</div></div>
      </div>

      <div class="card">
        <div class="section-title">{_h(t["customer"])}</div>
        <div class="row"><div>{_h(t["name"])}</div><div>{_h(customer.get("full_name") or "-")}</div></div>
        <div class="row"><div>{_h(t["email"])}</div><div>{_h(customer.get("email") or "-")}</div></div>
        <div class="row"><div>{_h(t["phone"])}</div><div>{_h(customer.get("phone") or "-")}</div></div>
        <div class="row"><div>{_h(t["address"])}</div><div>{_h(customer.get("address") or "-")}</div></div>
        <div class="row"><div>{_h(t["shipping_address"])}</div><div>{_h(customer.get("shipping_address") or "-")}</div></div>
        <div class="row"><div>{_h(t["payment"])}</div><div>{_h(getattr(order, "payment_method", "") or "-")}</div></div>
        <div class="row"><div>{_h(t["shipping"])}</div><div>{_h(getattr(order, "shipping_method", "") or "-")}</div></div>
      </div>
    </div>

    <div class="payment-box">
      <div class="section-title" style="margin-bottom:10px;">{_h(t["payment_info"])}</div>
      <div class="payment-grid">
        <div>
          <div class="row"><div>{_h(t["recipient"])}</div><div>{_h(bank.get("name") or "-")}</div></div>
          <div class="row"><div>IBAN</div><div class="mono">{_h(bank.get("iban") or "-")}</div></div>
          <div class="row"><div>BIC</div><div class="mono">{_h(bank.get("bic") or "-")}</div></div>
          <div class="row"><div>VS</div><div class="mono">{_h(vs or "-")}</div></div>
        </div>
        <div>
          <div class="muted small right">{_h(t["to_pay"])}</div>
          <div class="big-amount">{_h(_moneyc(grand_total, currency))}</div>
        </div>
      </div>
    </div>

    <table aria-label="Invoice items">
      <thead>
        <tr>
          <th style="width:34px;" class="right">#</th>
          <th>{_h(t["items"])}</th>
          <th style="width:54px;" class="right">{_h(t["qty"])}</th>
          <th style="width:120px;" class="right">{_h(t["price_unit"])}</th>
          <th style="width:120px;" class="right">{_h(t["total"])}</th>
        </tr>
      </thead>
      <tbody>
        {"".join([
          f"<tr>"
          f"<td class='muted right'>{idx}</td>"
          f"<td>{_h(r['name'])}</td>"
          f"<td class='right'>{r['qty']}</td>"
          f"<td class='right'>{_moneyc(r['unit'], currency)}</td>"
          f"<td class='right'><b>{_moneyc(r['total'], currency)}</b></td>"
          f"</tr>"
          for idx, r in enumerate(item_rows, 1)
        ])}
      </tbody>
      <tfoot>
        <tr class="totals">
          <td colspan="4" class="right muted">{_h(t["subtotal"])}</td>
          <td class="right">{_moneyc(subtotal, currency)}</td>
        </tr>
        {discount_row}
        <tr class="total-line">
          <td colspan="4" class="right">{_h(t["to_pay"])}</td>
          <td class="right">{_moneyc(grand_total, currency)}</td>
        </tr>
      </tfoot>
    </table>

    <div class="footer">
      <div>{_h(t["footer"])} {_h(supplier.get("email") or "info@kunstkabinett.cz")}.</div>
    </div>
  </div>
</body>
</html>
"""
        return HTML(string=html).write_pdf()
    except Exception as e:
        # fallback to simple ReportLab PDF
        try:
            from reportlab.pdfgen import canvas  # type: ignore
            from reportlab.lib.pagesizes import A4  # type: ignore
        except Exception:
            raise e

        buf = BytesIO()
        c = canvas.Canvas(buf, pagesize=A4)
        w, h = A4
        y = h - 50

        c.setFont("Helvetica-Bold", 14)
        c.drawString(40, y, f"Faktura #{order.id}")
        y -= 18

        c.setFont("Helvetica", 10)
        c.drawString(40, y, f"Datum: {_format_dt(order.created_at)}")
        y -= 14
        c.drawString(40, y, f"Status: {getattr(order, 'status', '-')}")
        y -= 14
        c.drawString(40, y, f"Email: {customer.get('email') or '-'}")
        y -= 14
        c.drawString(40, y, f"Zakaznik: {customer.get('full_name') or '-'}")
        y -= 14
        c.drawString(40, y, f"Telefon: {customer.get('phone') or '-'}")
        y -= 20

        c.setFont("Helvetica-Bold", 11)
        c.drawString(40, y, "Polozky:")
        y -= 16
        c.setFont("Helvetica", 10)
        for r in item_rows:
            line = f"{r['name']} x{r['qty']} @ {_moneyc(r['unit'], currency)} = {_moneyc(r['total'], currency)}"
            c.drawString(50, y, line[:95])
            y -= 13
            if y < 60:
                c.showPage()
                y = h - 50
                c.setFont("Helvetica", 10)

        y -= 10
        c.setFont("Helvetica-Bold", 11)
        c.drawString(40, y, f"Mezisoucet: {_moneyc(subtotal, currency)}")
        y -= 14
        c.drawString(40, y, f"Sleva: -{_moneyc(discount, currency)}")
        y -= 14
        c.drawString(40, y, f"K uhrade: {_moneyc(grand_total, currency)}")

        c.showPage()
        c.save()
        buf.seek(0)
        return buf.read()


# ---------- ENDPOINTS ----------
@router.get("/{order_id}.pdf", dependencies=[Depends(require_admin)])
def admin_invoice_pdf(
    order_id: int = FPath(..., ge=1),
    lang: Optional[str] = None,
    db: Session = Depends(get_db),
):
    order = db.get(models.Order, order_id)
    if not order:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Objednavka nenalezena.")
    pdf_bytes = _invoice_pdf_bytes(order, db, lang=lang)
    filename = f"invoice_{order.id}.pdf"
    return StreamingResponse(
        iter([pdf_bytes]),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/{order_id}/send", dependencies=[Depends(require_admin)])
def admin_invoice_send(
    order_id: int = FPath(..., ge=1),
    payload: SendInvoiceRequest = Body(...),
    lang: Optional[str] = None,
    db: Session = Depends(get_db),
):
    order = db.get(models.Order, order_id)
    if not order:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Objednavka nenalezena.")

    to_email: Optional[str] = payload.email
    if not to_email and order.user_id:
        u = db.get(models.User, order.user_id)
        if u:
            to_email = getattr(u, "email", None)

    if not to_email:
        raise HTTPException(status_code=400, detail="Email neni zadan a objednavka nema uzivatele s e-mailem.")

    effective_lang = payload.language or lang
    t = INVOICE_I18N.get(_pick_lang(order, effective_lang), INVOICE_I18N["cs"])
    pdf_bytes = _invoice_pdf_bytes(order, db, lang=effective_lang)
    filename = f"invoice_{order.id}.pdf"

    subject = f"{t['subject']} #{order.id}"
    amount_label = _moneyc(getattr(order, "total", 0), getattr(order, "currency", "CZK"))
    text = (
        f"{t['greeting']},\n\n"
        f"{t['body_intro']} #{order.id}.\n"
        f"{t['to_pay']}: {amount_label}\n"
        f"Status: {order.status}\n\n"
        f"{t['thanks']}\nKunstkabinett"
    )
    html_email = f"""
        <p>{_h(t['greeting'])},</p>
        <p>{_h(t['body_intro'])} <b>#{_h(order.id)}</b>.<br>
        {_h(t['to_pay'])}: <b>{_h(amount_label)}</b><br>
        Status: <b>{_h(order.status)}</b></p>
        <p>{_h(t['thanks'])},<br>Kunstkabinett</p>
    """

    send_email(
        to=to_email,
        subject=subject,
        body_text=text,
        body_html=html_email,
        attachments=[(filename, pdf_bytes, "application/pdf")],
    )
    return {"ok": True, "sent_to": to_email}
