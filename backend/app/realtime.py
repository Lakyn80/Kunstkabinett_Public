# app/realtime.py
import asyncio
from typing import Dict, List, AsyncIterator
from fastapi import APIRouter, Request
try:
    from sse_starlette.sse import EventSourceResponse  # správný import
except Exception:  # fallback kdybys měl starší prostředí
    from starlette.responses import Response as EventSourceResponse  # typově projde, ale bez SSE

router = APIRouter(prefix="/realtime", tags=["realtime"])

_subs: Dict[int, List[asyncio.Queue[str]]] = {}

async def publish_order_status(order_id: int, data: str) -> None:
    for q in list(_subs.get(order_id, [])):
        await q.put(data)

@router.get("/orders/{order_id}/events")
async def order_events(order_id: int, request: Request):
    q: asyncio.Queue[str] = asyncio.Queue()
    _subs.setdefault(order_id, []).append(q)

    async def event_stream() -> AsyncIterator[dict]:
        try:
            await q.put('{"type":"hello"}')
            while True:
                if await request.is_disconnected():
                    break
                data = await q.get()
                yield {"event": "status", "data": data}
        finally:
            _subs[order_id].remove(q)

    return EventSourceResponse(event_stream())
