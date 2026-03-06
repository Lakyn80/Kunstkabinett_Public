from __future__ import annotations

from typing import Optional

from sqlalchemy import func

from app.db import models
from app.services.text_utils import to_plain_text


def last_name_expression():
    """Return SQL expression that extracts the lastname (fallback to full name)."""
    last_token = func.nullif(
        func.trim(func.regexp_replace(models.Artist.name, r"^.*\s", "")),
        "",
    )
    return func.coalesce(last_token, func.trim(models.Artist.name))


def apply_lastname_filters(query, last_name_expr, filter_lastname: Optional[str], filter_letter: Optional[str]):
    if filter_lastname:
        term = to_plain_text(filter_lastname).strip()
        if term:
            query = query.filter(last_name_expr.ilike(f"%{term}%"))
    if filter_letter:
        letter = to_plain_text(filter_letter).strip().upper()
        if len(letter) == 1 and letter.isalpha():
            query = query.filter(last_name_expr.ilike(f"{letter}%"))
    return query
