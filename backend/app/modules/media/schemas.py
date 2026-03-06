from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class MediaProductOption(BaseModel):
    id: int
    title: str
    slug: str


class MediaCategoryOption(BaseModel):
    id: int
    name: str


class MediaArtistOption(BaseModel):
    id: int
    name: str


class MediaItemOut(BaseModel):
    media_id: str
    product_id: int
    product_title: str
    product_slug: str
    category_id: int | None = None
    category_name: str | None = None
    artist_id: int | None = None
    artist_name: str | None = None
    filename: str
    kind: str
    mime: str | None = None
    size: int | None = None
    url: str
    created_at: datetime | None = None
    has_file: bool = True


class MediaListOut(BaseModel):
    total: int
    limit: int
    offset: int
    items: list[MediaItemOut] = Field(default_factory=list)


class MediaFiltersOut(BaseModel):
    products: list[MediaProductOption] = Field(default_factory=list)
    categories: list[MediaCategoryOption] = Field(default_factory=list)
    artists: list[MediaArtistOption] = Field(default_factory=list)
    kinds: list[str] = Field(default_factory=list)
    mime_prefixes: list[str] = Field(default_factory=list)
