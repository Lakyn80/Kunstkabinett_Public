"""
Exchange rate API endpoint.

Goal: provide a stable EUR/CZK rate endpoint for the admin UI.

Requirements:
- avoid transient 502s (return a numeric fallback instead)
- handle timeouts
- keep a short-lived in-memory cache
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Iterable, Optional
import asyncio
import logging

import httpx
from fastapi import APIRouter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/exchange-rate", tags=["exchange-rate"])


DEFAULT_FALLBACK_RATE = 25.0
CACHE_TTL = timedelta(hours=6)
MAX_DAYS_BACK = 10  # weekend/holiday safety


@dataclass
class _RateCache:
    rate: float
    date_str: str
    fetched_at: datetime


_cache: _RateCache | None = None
_cache_lock = asyncio.Lock()


def _format_date(d: date) -> str:
    return d.strftime("%d.%m.%Y")


def _iter_dates(start: date, max_back: int) -> Iterable[str]:
    for i in range(0, max_back + 1):
        yield _format_date(start - timedelta(days=i))


def _parse_cnb_eur_rate(text: str) -> float:
    lines = (text or "").splitlines()
    # Format: first 2 lines are headers, then: country|currency|amount|code|rate
    for line in lines[2:]:
        if not line.strip() or "EUR" not in line:
            continue
        parts = line.split("|")
        if len(parts) < 5:
            continue
        if parts[3].strip() != "EUR":
            continue
        amount_str = parts[2].strip()
        rate_str = parts[4].strip()
        amount = float(amount_str.replace(",", "."))
        rate = float(rate_str.replace(",", "."))
        if amount == 0:
            raise ValueError("CNB EUR amount is 0")
        return rate / amount
    raise ValueError("EUR exchange rate not found in CNB response")


async def _fetch_cnb_text(date_str: str) -> str:
    url = (
        "https://www.cnb.cz/cs/financni-trhy/devizovy-trh/kurzy-devizoveho-trhu/"
        f"kurzy-devizoveho-trhu/denni_kurz.txt?date={date_str}"
    )
    timeout = httpx.Timeout(connect=3.0, read=10.0, write=10.0, pool=10.0)
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        return resp.text


def _cache_fresh_for(date_str: str) -> bool:
    if _cache is None:
        return False
    if _cache.date_str != date_str:
        return False
    return (datetime.utcnow() - _cache.fetched_at) <= CACHE_TTL


def _cache_is_fresh() -> bool:
    if _cache is None:
        return False
    return (datetime.utcnow() - _cache.fetched_at) <= CACHE_TTL


@router.get("/eur")
async def get_eur_exchange_rate(date_str: Optional[str] = None):
    """
    Return EUR/CZK exchange rate from CNB (denni_kurz.txt).

    Stable behavior:
    - on CNB/network failures returns last known cached rate or DEFAULT_FALLBACK_RATE
    - avoids returning 502 just because an upstream is temporarily unavailable

    Response shape is backward-compatible with the admin FE:
      { "rate": float, "date": "DD.MM.YYYY", ... }
    """
    global _cache
    start = date.today()

    requested_date = str(date_str).strip() if date_str else None

    # Fast-path for "latest" calls (default from admin UI): if we have a fresh cache,
    # return it immediately (even if the cached date is not "today" due to weekends/holidays).
    if requested_date is None and _cache_is_fresh():
        return {"rate": _cache.rate, "date": _cache.date_str, "stale": False, "source": "cache"}

    # Fast-path: fresh cache for an explicitly requested date
    if requested_date is not None and _cache_fresh_for(requested_date):
        return {"rate": _cache.rate, "date": _cache.date_str, "stale": False, "source": "cache"}

    async with _cache_lock:
        # cache could have been filled while waiting for the lock
        if requested_date is None and _cache_is_fresh():
            return {"rate": _cache.rate, "date": _cache.date_str, "stale": False, "source": "cache"}
        if requested_date is not None and _cache_fresh_for(requested_date):
            return {"rate": _cache.rate, "date": _cache.date_str, "stale": False, "source": "cache"}

        if requested_date:
            # Explicit date requested
            try_dates = [requested_date]
        else:
            # Common case: "latest" (today may be weekend/holiday, try previous days)
            try_dates = list(_iter_dates(start, MAX_DAYS_BACK))

        last_error: str | None = None
        for ds in try_dates:
            try:
                logger.info("Fetching EUR/CZK rate from CNB for date=%s", ds)
                text = await _fetch_cnb_text(ds)
                rate = _parse_cnb_eur_rate(text)
                _cache = _RateCache(rate=float(rate), date_str=ds, fetched_at=datetime.utcnow())
                return {"rate": float(rate), "date": ds, "stale": False, "source": "cnb"}
            except Exception as e:  # noqa: BLE001 - we intentionally fall back on any upstream/parsing issue
                last_error = str(e)
                continue

        # Fallback: last known cached rate (even if stale or for different date)
        if _cache is not None:
            logger.warning("CNB rate fetch failed (%s). Using cached rate from %s.", last_error, _cache.date_str)
            return {"rate": float(_cache.rate), "date": _cache.date_str, "stale": True, "source": "cache"}

        # Final fallback: safe constant to keep admin UI operational
        logger.warning("CNB rate fetch failed (%s). Using fallback rate=%s.", last_error, DEFAULT_FALLBACK_RATE)
        return {"rate": float(DEFAULT_FALLBACK_RATE), "date": requested_date or _format_date(start), "stale": True, "source": "fallback"}
