from pydantic import BaseModel, Field
from pydantic import ConfigDict

class CategoryCreate(BaseModel):
    name: str = Field(..., description="Název kategorie", examples=["Obrazy"])
    slug: str = Field(..., description="URL slug", examples=["obrazy"])

class CategoryOut(CategoryCreate):
    id: int
    model_config = ConfigDict(from_attributes=True)
