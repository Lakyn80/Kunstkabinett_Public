from __future__ import annotations

from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from jose import JWTError, jwt

from app.db.session import SessionLocal
from app.db import models

# Z tvého security importujeme jen stabilní věci (ALGORITHM, get_jwt_secret).
# get_current_user bereme modulárně přes getattr, aby Pylance nekřičel,
# i když symbol v některých branchech není.
from app.core.security import ALGORITHM, get_jwt_secret  # typicky existují

# --- Bearer schema (ponecháno kvůli Swaggeru a kompatibilitě) ---
bearer_scheme = HTTPBearer(auto_error=True)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# === Pokus načíst canonical get_current_user ze security ===
try:
    from app.core import security as _security_mod  # import modulu je stabilní
    _SECURITY_GET_CURRENT_USER = getattr(_security_mod, "get_current_user", None)
except Exception:  # pragma: no cover
    _SECURITY_GET_CURRENT_USER = None


# === Fallback resolver (když v security není get_current_user) ===
def _fallback_resolve_user(
    credentials: HTTPAuthorizationCredentials,
    db: Session,
) -> models.User:
    """
    Dekóduje JWT a vrátí uživatele. Podporuje sub = user_id (int) i email (str s '@').
    Chování odpovídá původnímu deps.py, jen je tolerantnější k sub.
    """
    token = credentials.credentials
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[ALGORITHM])
        sub = payload.get("sub")
        if sub is None:
            raise ValueError("missing sub")
    except (JWTError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Neautorizováno",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user: Optional[models.User] = None

    # sub jako ID
    if isinstance(sub, int) or (isinstance(sub, str) and sub.isdigit()):
        try:
            user_id = int(sub)
            user = db.get(models.User, user_id)
        except Exception:
            user = None

    # sub jako email
    if user is None and isinstance(sub, str) and "@" in sub:
        user = db.query(models.User).filter(models.User.email == sub).first()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Neautorizováno",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Volitelná kontrola flagů – bezpečný fallback (nemění původní chování, jen chrání)
    if hasattr(user, "is_active") and not getattr(user, "is_active"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Účet je neaktivní",
        )

    return user


# === Veřejná dependency: get_current_user ===
# Pokud security.get_current_user existuje, použijeme ji 1:1.
# Jinak použijeme lokální fallback.
if _SECURITY_GET_CURRENT_USER is not None:

    def get_current_user(  # type: ignore[override]
        _cred: HTTPAuthorizationCredentials = Depends(bearer_scheme),
        user: models.User = Depends(_SECURITY_GET_CURRENT_USER),  # přesně to, co používá /auth/me
        db: Session = Depends(get_db),  # signatura zachována kvůli kompatibilitě
    ) -> models.User:
        return user

else:

    def get_current_user(  # fallback varianta
        credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
        db: Session = Depends(get_db),
    ) -> models.User:
        return _fallback_resolve_user(credentials, db)


# === Admin guard: re-export (nepřepisujeme tvoji logiku) ===
from app.core.auth import require_admin  # noqa: E402,F401
