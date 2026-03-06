from __future__ import annotations
from pathlib import Path

TPL_DIR = Path(__file__).resolve().parents[1] / "templates" / "email"

def _safe_read(name: str) -> str | None:
    try:
        p = TPL_DIR / name
        if p.exists():
            return p.read_text(encoding="utf-8")
    except Exception:
        pass
    return None

def render_verify_email(ttl_minutes: int, verify_url: str) -> tuple[str, str]:
    txt = _safe_read("verify_email.txt")
    html = _safe_read("verify_email.html")

    if txt is None:
        txt = (
            "Ahoj,\n\n"
            "dokonči prosím ověření e-mailu pro účet Arte Moderno:\n"
            f"{verify_url}\n\n"
            f"Odkaz vyprší za {ttl_minutes} minut.\n\n"
            "Díky,\nArte Moderno\n"
        )
    else:
        txt = (
            txt.replace("{{ ttl_minutes }}", str(ttl_minutes))
               .replace("{{ verify_url }}", verify_url)
        )

    if html is None:
        html = (
            "<!doctype html><html><body style='font-family:Arial,sans-serif;color:#111'>"
            "<p>Ahoj,</p>"
            "<p>dokonči prosím ověření e-mailu pro účet <strong>Arte Moderno</strong>:</p>"
            f"<p><a href=\"{verify_url}\">{verify_url}</a></p>"
            f"<p>Odkaz vyprší za {ttl_minutes} minut.</p>"
            "<p>Díky,<br/>Arte Moderno</p>"
            "</body></html>"
        )
    else:
        html = (
            html.replace("{{ ttl_minutes }}", str(ttl_minutes))
                .replace("{{ verify_url }}", verify_url)
        )

    return txt, html

def render_reset_password(ttl_minutes: int, reset_url: str) -> tuple[str, str]:
    txt = _safe_read("reset_password.txt")
    html = _safe_read("reset_password.html")

    if txt is None:
        txt = (
            "Ahoj,\n\n"
            "požádal(a) jsi o obnovení hesla na Arte Moderno.\n"
            "Pokračuj kliknutím sem:\n"
            f"{reset_url}\n\n"
            f"Odkaz vyprší za {ttl_minutes} minut.\n"
            "Pokud jsi to nebyl(a) ty, tento e-mail ignoruj.\n\n"
            "Díky,\nArte Moderno\n"
        )
    else:
        txt = (
            txt.replace("{{ ttl_minutes }}", str(ttl_minutes))
               .replace("{{ reset_url }}", reset_url)
        )

    if html is None:
        html = (
            "<!doctype html><html><body style='font-family:Arial,sans-serif;color:#111'>"
            "<p>Ahoj,</p>"
            "<p>požádal(a) jsi o obnovení hesla na <strong>Arte Moderno</strong>.</p>"
            f"<p><a href=\"{reset_url}\">{reset_url}</a></p>"
            f"<p>Odkaz vyprší za {ttl_minutes} minut. Pokud jsi to nebyl(a) ty, tento e-mail ignoruj.</p>"
            "<p>Díky,<br/>Arte Moderno</p>"
            "</body></html>"
        )
    else:
        html = (
            html.replace("{{ ttl_minutes }}", str(ttl_minutes))
                .replace("{{ reset_url }}", reset_url)
        )

    return txt, html
