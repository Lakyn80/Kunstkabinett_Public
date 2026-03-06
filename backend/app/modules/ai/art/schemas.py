from __future__ import annotations

from typing import Any, Dict, List, Optional
from typing import Literal

from pydantic import BaseModel, Field


class RagIngestRequest(BaseModel):
    title: str = Field(..., min_length=1)
    description: str = Field(..., min_length=1)
    tags: List[str] = Field(default_factory=list)
    art_type: Optional[str] = None
    source: str = "manual"


class RagSearchRequest(BaseModel):
    query: str = Field(..., min_length=1)
    n_results: int = Field(5, ge=1, le=20)
    art_type: Optional[str] = None


class RagMatch(BaseModel):
    id: str
    text: str
    metadata: Dict[str, Any] = Field(default_factory=dict)
    distance: Optional[float] = None


class RagSearchResponse(BaseModel):
    items: List[RagMatch] = Field(default_factory=list)


class ArtDescribeResponse(BaseModel):
    title: str
    description: str
    tags: List[str] = Field(default_factory=list)
    art_type: str = "other"
    rag_matches: List[RagMatch] = Field(default_factory=list)
    image_key: str = ""
    provider_used: str = "openai_vision"
    from_cache: bool = False


class ArtRewriteRequest(BaseModel):
    image_key: str = Field(..., min_length=8)
    mode: Literal["shorten", "marketing", "regenerate", "lyric"]
    style_hint: Optional[str] = None
    max_chars: int = Field(420, ge=80, le=1200)
    save_to_rag: bool = True


class ArtRewriteResponse(BaseModel):
    image_key: str
    mode: Literal["shorten", "marketing", "regenerate", "lyric"]
    description: str
    provider_used: str = "deepseek"
    from_cache: bool = False
