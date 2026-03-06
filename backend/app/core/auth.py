# app/core/authz.py
from fastapi import Depends, HTTPException, status
from app.core.deps import get_current_user
from app.db.models import User


def _is_admin(user: User) -> bool:
    return bool(getattr(user, "is_admin", False) or str(getattr(user, "role", "")).lower() == "admin")

def require_admin(user: User = Depends(get_current_user)) -> User:
    """
    Povinná kontrola oprávnění administrace.
    Povolí pokud má uživatel `is_admin=True` nebo `role='admin'`.
    Jinak vrátí 403.
    """
    if not _is_admin(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required",
        )
    return user
