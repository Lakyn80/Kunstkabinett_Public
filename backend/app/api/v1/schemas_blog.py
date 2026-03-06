# app/schemas/blog.py

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict


class BlogPostOut(BaseModel):
    id: int
    title: str
    slug: Optional[str] = None  # slug je nyní volitelný (kvůli NULL v DB)
    content: Optional[str] = None
    cover_url: Optional[str] = None
    status: str
    published_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class BlogListParams(BaseModel):
    status: Optional[str] = Field(default="published", description="draft|published")
