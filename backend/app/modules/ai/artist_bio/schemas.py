from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class ArtistBioGenerateRequest(BaseModel):
    artist_id: Optional[int] = None
    artist_name: Optional[str] = None
    force_refresh: bool = False
    save_to_rag: bool = True


class ArtistBioGenerateResponse(BaseModel):
    artist_id: Optional[int] = None
    artist_name: str
    bio: str
    sources: List[str] = Field(default_factory=list)
    from_cache: bool = False


class ArtistBioRagSearchRequest(BaseModel):
    query: str = Field(..., min_length=1)
    n_results: int = Field(5, ge=1, le=20)


class ArtistBioRagMatch(BaseModel):
    id: str
    text: str
    metadata: Dict[str, Any] = Field(default_factory=dict)
    distance: Optional[float] = None


class ArtistBioRagSearchResponse(BaseModel):
    items: List[ArtistBioRagMatch] = Field(default_factory=list)
