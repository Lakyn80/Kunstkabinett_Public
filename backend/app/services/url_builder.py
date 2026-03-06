from __future__ import annotations
import os
from urllib.parse import urlencode


def frontend_url(path: str, **params) -> str:
    """
    URL pro veřejný (client) frontend – použij FRONTEND_BASE_URL.
    """
    base = os.getenv("FRONTEND_BASE_URL", "http://localhost:5173").rstrip("/")
    q = f"?{urlencode(params)}" if params else ""
    return f"{base}/{path.lstrip('/')}{q}"


def admin_frontend_url(path: str, **params) -> str:
    """
    URL pro admin frontend – použij ADMIN_FRONTEND_BASE_URL, fallback na FRONTEND_BASE_URL.
    """
    base = (
        os.getenv("ADMIN_FRONTEND_BASE_URL")
        or os.getenv("FRONTEND_BASE_URL", "http://localhost:8081")
    ).rstrip("/")
    q = f"?{urlencode(params)}" if params else ""
    return f"{base}/{path.lstrip('/')}{q}"


def backend_url(path: str, **params) -> str:
    base = os.getenv("BACKEND_BASE_URL", "http://localhost:8000").rstrip("/")
    q = f"?{urlencode(params)}" if params else ""
    return f"{base}/{path.lstrip('/')}{q}"
