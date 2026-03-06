from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_db, require_admin
from app.db import models

from .schemas import (
    ArtistBioGenerateRequest,
    ArtistBioGenerateResponse,
    ArtistBioRagSearchRequest,
    ArtistBioRagSearchResponse,
)
from .service import generate_artist_bio, search_artist_bio_rag, seed_placeholder_rules


router = APIRouter(prefix="/ai/artist-bio", tags=["admin: ai-artist-bio"], dependencies=[Depends(require_admin)])


@router.post("/generate", response_model=ArtistBioGenerateResponse)
async def generate_bio(
    payload: ArtistBioGenerateRequest,
    db: Session = Depends(get_db),
) -> ArtistBioGenerateResponse:
    artist = None
    artist_name = str(payload.artist_name or "").strip()

    if payload.artist_id is not None:
        artist = db.get(models.Artist, int(payload.artist_id))
        if not artist:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artist not found.")
        if not artist_name:
            artist_name = str(artist.name or "").strip()

    if not artist_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="artist_name or artist_id is required.")

    try:
        result = await generate_artist_bio(
            artist_name=artist_name,
            force_refresh=payload.force_refresh,
            save_to_rag=payload.save_to_rag,
        )

        if artist is not None:
            artist.bio = result["bio"]
            db.commit()
            db.refresh(artist)

        return ArtistBioGenerateResponse(
            artist_id=artist.id if artist is not None else None,
            artist_name=result["artist_name"],
            bio=result["bio"],
            sources=result.get("sources") or [],
            from_cache=bool(result.get("from_cache")),
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Artist bio generation failed: {exc}",
        ) from exc


@router.post("/rag/search", response_model=ArtistBioRagSearchResponse)
def rag_search(payload: ArtistBioRagSearchRequest) -> ArtistBioRagSearchResponse:
    try:
        items = search_artist_bio_rag(query=payload.query, n_results=payload.n_results)
        return ArtistBioRagSearchResponse(items=items)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Artist bio RAG search failed: {exc}",
        ) from exc


@router.post("/rag/seed-placeholders")
def rag_seed_placeholders() -> dict:
    try:
        return seed_placeholder_rules()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Artist bio RAG seed failed: {exc}",
        ) from exc
