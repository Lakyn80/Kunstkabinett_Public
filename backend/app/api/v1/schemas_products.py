from typing import Optional, List
from pydantic import BaseModel, Field
from pydantic import ConfigDict  # Pydantic v2

class ProductCreate(BaseModel):
    title: str = Field(..., description="Název produktu", examples=["Obraz – Krajina"])
    slug: str = Field(..., description="URL slug", examples=["obraz-krajina"])
    description: Optional[str] = Field(
        None,
        description="Popis produktu",
        examples=["Olej na plátně, 60x80 cm"],
    )
    price: float = Field(..., description="Cena v Kč", examples=[12000.0])
    stock: int = Field(0, description="Skladové množství", examples=[5])
    category_id: Optional[int] = Field(None, description="ID kategorie", examples=[1])

class ProductOut(ProductCreate):
    id: int

    # Pydantic v2 náhrada za Config.orm_mode = True
    model_config = ConfigDict(from_attributes=True)
