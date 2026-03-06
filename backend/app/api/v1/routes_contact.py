from __future__ import annotations
from pydantic import BaseModel, EmailStr, Field
import logging
import time
import socket
from fastapi import APIRouter, HTTPException
from app.services.mailer import send_email
import os

router = APIRouter(tags=["contact"])
logger = logging.getLogger(__name__)


class ContactIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=200, description="Jméno")
    email: EmailStr = Field(..., description="Email")
    subject: str = Field(..., min_length=1, max_length=200, description="Předmět")
    message: str = Field(..., min_length=1, max_length=5000, description="Zpráva")


class ContactOut(BaseModel):
    ok: bool
    message: str


@router.post("/contact", response_model=ContactOut)
def contact_form(payload: ContactIn):
    """
    Kontaktní formulář - odešle email na info@kunstkabinett.cz
    a potvrzovací email klientovi.
    """
    def send_with_retry(*, to, subject, body_text, body_html=None, attempts: int = 2, delay: float = 1.0):
        for i in range(attempts):
            try:
                send_email(to=to, subject=subject, body_text=body_text, body_html=body_html)
                return True
            except (socket.gaierror, OSError) as e:
                logger.warning(f"[CONTACT] SMTP send failed ({i+1}/{attempts}): {e}")
                if i + 1 == attempts:
                    raise
                time.sleep(delay)
            except Exception as e:
                logger.error(f"[CONTACT] Unexpected SMTP error ({i+1}/{attempts}): {e}")
                if i + 1 == attempts:
                    raise
                time.sleep(delay)
        return False

    try:
        info_email = "info@kunstkabinett.cz"
        client_email = payload.email

        info_subject = f"Kontaktní formulář: {payload.subject}"
        info_body_text = f"""Nový kontaktní formulář z webu Arte Moderno

Jméno: {payload.name}
Email: {payload.email}
Předmět: {payload.subject}

Zpráva:
{payload.message}

---
Tento email byl odeslán z kontaktního formuláře na webu Arte Moderno.
"""
        info_body_html = f"""<html>
<body>
<h2>Nový kontaktní formulář z webu Arte Moderno</h2>
<p><strong>Jméno:</strong> {payload.name}</p>
<p><strong>Email:</strong> <a href="mailto:{payload.email}">{payload.email}</a></p>
<p><strong>Předmět:</strong> {payload.subject}</p>
<h3>Zpráva:</h3>
<p style="white-space: pre-wrap;">{payload.message}</p>
<hr>
<p style="color: #666; font-size: 12px;">Tento email byl odeslán z kontaktního formuláře na webu Arte Moderno.</p>
</body>
</html>
"""

        # hlavní email (povinný) – s retry kvůli dočasným DNS/SMTP výpadkům
        send_with_retry(
            to=info_email,
            subject=info_subject,
            body_text=info_body_text,
            body_html=info_body_html,
        )

        confirmation_subject = "Vaše zpráva byla přijata - Arte Moderno"
        confirmation_body_text = f"""Dobrý den {payload.name},

děkujeme za Vaši zprávu. Vaše zpráva byla úspěšně přijata a odpovíme Vám co nejdříve.

Vaše zpráva:
Předmět: {payload.subject}

{payload.message}

S pozdravem
Tým Arte Moderno
info@kunstkabinett.cz
"""
        confirmation_body_html = f"""<html>
<body>
<p>Dobrý den <strong>{payload.name}</strong>,</p>
<p>děkujeme za Vaši zprávu. Vaše zpráva byla úspěšně přijata a odpovíme Vám co nejdříve.</p>
<div style="background: #f5f5f5; padding: 15px; margin: 20px 0; border-left: 4px solid #333;">
<p><strong>Předmět:</strong> {payload.subject}</p>
<p style="white-space: pre-wrap;">{payload.message}</p>
</div>
<p>S pozdravem<br>Tým Arte Moderno<br><a href="mailto:info@kunstkabinett.cz">info@kunstkabinett.cz</a></p>
</body>
</html>
"""

        # Potvrzení klientovi – neblokuje úspěch (log chybu, ale nevynucuje 500)
        try:
            send_with_retry(
                to=client_email,
                subject=confirmation_subject,
                body_text=confirmation_body_text,
                body_html=confirmation_body_html,
            )
        except Exception as e:
            logger.warning(f"[CONTACT] Confirmation email failed, but info email sent: {e}")

        return ContactOut(ok=True, message="Email byl úspěšně odeslán.")

    except Exception as e:
        logger.error(f"Failed to send contact form email: {e}")
        raise HTTPException(status_code=500, detail="Nepodařilo se odeslat email. Zkuste to prosím později.")
