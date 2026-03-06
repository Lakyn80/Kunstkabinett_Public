from __future__ import annotations
import os
import smtplib
from email.message import EmailMessage
from typing import Iterable, Optional, Tuple

def _smtp_client():
    host = os.getenv("SMTP_HOST", "")
    port = int(os.getenv("SMTP_PORT", "587"))
    user = os.getenv("SMTP_USER", "")
    password = os.getenv("SMTP_PASSWORD", "")  # POZOR: držíme tvůj název proměnné
    use_tls = os.getenv("SMTP_USE_TLS", "true").lower() == "true"
    use_ssl = os.getenv("SMTP_USE_SSL", "false").lower() == "true"

    if use_ssl:
        client = smtplib.SMTP_SSL(host=host, port=port, timeout=20)
    else:
        client = smtplib.SMTP(host=host, port=port, timeout=20)
    client.ehlo()
    if use_tls and not use_ssl:
        client.starttls()
        client.ehlo()
    if user:
        client.login(user, password)
    return client

def send_email(
    to: str | Iterable[str],
    subject: str,
    body_text: str,
    body_html: str | None = None,
    attachments: Optional[Iterable[Tuple[str, bytes, str]]] = None,  # (filename, data, mime)
):
    """
    attachments: iterace trojic (filename, data_bytes, mime_type),
    např. [("invoice.pdf", pdf_bytes, "application/pdf")]
    """
    # normalizuj příjemce
    recipients = [to] if isinstance(to, str) else list(to)

    sender = os.getenv("SMTP_FROM", os.getenv("SMTP_USER", "no-reply@example.com"))
    msg = EmailMessage()
    msg["From"] = sender
    msg["To"] = ", ".join(recipients)
    msg["Bcc"] = "info@kunstkabinett.cz"  # Skrytá kopie všech emailů na info@kunstkabinett.cz
    msg["Subject"] = subject

    if body_html:
        msg.set_content(body_text or "")
        msg.add_alternative(body_html, subtype="html")
    else:
        msg.set_content(body_text or "")

    # přílohy
    for (filename, data, mime) in (attachments or []):
        maintype, subtype = (mime.split("/", 1) + ["octet-stream"])[:2]
        msg.add_attachment(data, maintype=maintype, subtype=subtype, filename=filename)

    with _smtp_client() as c:
        c.send_message(msg)
