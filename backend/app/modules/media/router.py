from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.deps import get_db, require_admin

from .schemas import MediaFiltersOut, MediaListOut
from .service import delete_media, get_media_filters, list_media


router = APIRouter(prefix="/api/media", tags=["media"], dependencies=[Depends(require_admin)])


@router.get("", response_model=MediaListOut)
async def list_media_endpoint(
    q: str | None = Query(None),
    product_id: int | None = Query(None),
    category_id: int | None = Query(None),
    artist_id: int | None = Query(None),
    kind: str | None = Query(None),
    mime_prefix: str | None = Query(None),
    created_from: datetime | None = Query(None),
    created_to: datetime | None = Query(None),
    has_file: bool | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    sort_by: str = Query("created_at"),
    sort_dir: str = Query("desc"),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return list_media(
        db,
        q=q,
        product_id=product_id,
        category_id=category_id,
        artist_id=artist_id,
        kind=kind,
        mime_prefix=mime_prefix,
        created_from=created_from,
        created_to=created_to,
        has_file=has_file,
        limit=limit,
        offset=offset,
        sort_by=sort_by,
        sort_dir=sort_dir,
    )


@router.get("/filters", response_model=MediaFiltersOut)
async def list_media_filters_endpoint(db: Session = Depends(get_db)) -> dict[str, Any]:
    return get_media_filters(db)


@router.delete("/{media_id}")
async def delete_media_endpoint(
    media_id: str,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    data = delete_media(db, media_id)
    if not data:
        raise HTTPException(status_code=404, detail="Not found")
    return data
