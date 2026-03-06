from typing import List, Literal
from decimal import Decimal
from pydantic import BaseModel, Field, ConfigDict

class OrderItemIn(BaseModel):
    product_id: int = Field(..., description="ID produktu")
    qty: int = Field(..., gt=0, description="Počet kusů")

class OrderCreate(BaseModel):
    items: List[OrderItemIn]
    use_profile: bool = True
    shipping_method: str | None = Field(None, description="např. osobní, expres")
    payment_method: str | None = Field(None, description="např. cod, card")
    # NOVÉ: volitelný kupon z FE
    coupon_code: str | None = Field(None, max_length=64, description="Slevový kód")
    # NOVÉ: měna objednávky (pokud nepřijde, BE použije výchozí CZK)
    currency: Literal["CZK", "EUR"] = "CZK"
    # Jazyk objednávky (ISO kód), volitelný – pokud není, detekuje se z Accept-Language
    language: str | None = Field(None, max_length=5, description="cs, en, de, fr, ...")

class OrderItemOut(BaseModel):
    id: int
    product_id: int
    qty: int
    unit_price: Decimal
    model_config = ConfigDict(from_attributes=True)

class OrderOut(BaseModel):
    id: int
    status: str
    total: Decimal
    # NOVÉ: co se použilo a kolik se odečetlo
    coupon_code: str | None = None
    discount_total: Decimal = Decimal("0.00")
    # NOVÉ: měna objednávky
    currency: Literal["CZK", "EUR"]
    language: str | None = None

    shipping_method: str | None
    payment_method: str | None
    items: List[OrderItemOut]
    model_config = ConfigDict(from_attributes=True)
