from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any

from .ai_draft_service import generate_draft_for_inbox_image


@dataclass
class PreparedInboxItem:
    filename: str
    webp_abs_path: str
    webp_rel_path: str


@dataclass
class InboxDraftResult:
    draft: dict[str, Any]
    error: str | None = None


async def _generate_single_draft(
    item: PreparedInboxItem,
    *,
    semaphore: asyncio.Semaphore,
    timeout_sec: float,
) -> InboxDraftResult:
    try:
        async with semaphore:
            async with asyncio.timeout(timeout_sec):
                draft = await generate_draft_for_inbox_image(
                    item.webp_abs_path,
                    filename=item.filename,
                )
        return InboxDraftResult(draft=draft, error=None)
    except Exception as exc:
        return InboxDraftResult(draft={}, error=str(exc))


async def generate_inbox_drafts_batch(
    prepared_items: list[PreparedInboxItem],
    *,
    concurrency: int = 2,
    timeout_sec: float = 90.0,
) -> list[InboxDraftResult]:
    if not prepared_items:
        return []
    semaphore = asyncio.Semaphore(max(int(concurrency), 1))
    tasks = [
        _generate_single_draft(item, semaphore=semaphore, timeout_sec=timeout_sec)
        for item in prepared_items
    ]
    return await asyncio.gather(*tasks)

