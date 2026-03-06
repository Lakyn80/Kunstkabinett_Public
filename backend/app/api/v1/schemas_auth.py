from __future__ import annotations
from pydantic import BaseModel, EmailStr, Field
from pydantic import ConfigDict

class RegisterIn(BaseModel):
    email: EmailStr = Field(..., description="E-mail uživatele")
    password: str = Field(..., min_length=6, description="Heslo (min 6 znaků)")
    role: str | None = Field(None, description="role (admin|editor|customer) – volitelné")

class UserOut(BaseModel):
    id: int
    email: EmailStr
    role: str
    is_active: bool = False
    email_verified: bool = False
    is_corporate: bool = False
    model_config = ConfigDict(from_attributes=True)

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
