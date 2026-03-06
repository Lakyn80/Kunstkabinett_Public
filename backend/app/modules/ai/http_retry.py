from __future__ import annotations

from typing import Any, Dict, Optional
import asyncio
import random

import httpx


RETRYABLE_STATUS_CODES = {429, 500, 502, 503, 504}
DEFAULT_ATTEMPTS = 4
DEFAULT_BASE_DELAY = 0.8
DEFAULT_MAX_DELAY = 6.4


def is_retryable_network_error(exc: Exception) -> bool:
    if isinstance(
        exc,
        (
            httpx.ConnectError,
            httpx.ConnectTimeout,
            httpx.ReadTimeout,
            httpx.WriteTimeout,
            httpx.PoolTimeout,
            httpx.RemoteProtocolError,
        ),
    ):
        return True

    message = str(exc or "").lower()
    return any(
        pattern in message
        for pattern in (
            "temporary failure in name resolution",
            "name resolution",
            "getaddrinfo failed",
            "nodename nor servname provided",
        )
    )


async def post_json_with_retry(
    url: str,
    headers: Dict[str, str],
    payload: Dict[str, Any],
    timeout: float = 90.0,
    attempts: int = DEFAULT_ATTEMPTS,
    base_delay: float = DEFAULT_BASE_DELAY,
    max_delay: float = DEFAULT_MAX_DELAY,
    retryable_status_codes: Optional[set[int]] = None,
) -> httpx.Response:
    status_codes = retryable_status_codes or RETRYABLE_STATUS_CODES
    max_attempts = max(1, int(attempts or DEFAULT_ATTEMPTS))
    last_error: Exception | None = None

    for attempt in range(1, max_attempts + 1):
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(
                    url,
                    headers=headers,
                    json=payload,
                )
            if response.status_code in status_codes and attempt < max_attempts:
                delay = min(
                    base_delay * (2 ** (attempt - 1)) + random.uniform(0.0, 0.2),
                    max_delay,
                )
                await asyncio.sleep(delay)
                continue
            return response
        except Exception as exc:
            last_error = exc
            if not is_retryable_network_error(exc) or attempt >= max_attempts:
                raise
            delay = min(
                base_delay * (2 ** (attempt - 1)) + random.uniform(0.0, 0.2),
                max_delay,
            )
            await asyncio.sleep(delay)

    if last_error is not None:
        raise last_error
    raise RuntimeError("HTTP retry attempts exhausted")
