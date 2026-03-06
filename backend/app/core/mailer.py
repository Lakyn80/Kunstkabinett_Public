# app/core/mailer.py
from __future__ import annotations
import os
import smtplib
from email.message import EmailMessage

def _smtp_client():
    host = os.getenv("SMTP_HOST", "")
    port = int(os.getenv("SMTP_PORT", "587"))
    user = os.getenv("SMTP_USER", "")
    password = os.getenv("SMTP_PASSWORD", "")
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

def send_email(to: str, subject: str, body_text: str, body_html: str | None = None):
    sender = os.getenv("SMTP_FROM", os.getenv("SMTP_USER", "no-reply@example.com"))
    msg = EmailMessage()
    msg["From"] = sender
    msg["To"] = to
    msg["Subject"] = subject
    if body_html:
        msg.set_content(body_text or "")
        msg.add_alternative(body_html, subtype="html")
    else:
        msg.set_content(body_text or "")

    with _smtp_client() as c:
        c.send_message(msg)
