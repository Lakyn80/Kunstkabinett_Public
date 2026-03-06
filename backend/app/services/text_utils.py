"""
Utilities for sanitizing rich/plain text so we don't leak HTML into the client.
"""

from __future__ import annotations

import re
from typing import Optional

_BR_RE = re.compile(r"<br\s*/?>", re.IGNORECASE)
_P_BREAK_RE = re.compile(r"</p>\s*<p>", re.IGNORECASE)
_TAG_RE = re.compile(r"<[^>]+>")


def to_plain_text(value: Optional[str]) -> Optional[str]:
    """
    Convert arbitrary HTML-ish input to plain text.
    - Converts <br> to newline
    - Converts paragraph boundaries to blank line
    - Strips remaining tags
    - Keeps emoji and standard whitespace/newlines
    """
    if value is None:
        return None
    if not isinstance(value, str):
        value = str(value)

    text = value.replace("\r\n", "\n").replace("\r", "\n")
    text = _P_BREAK_RE.sub("\n\n", text)
    text = _BR_RE.sub("\n", text)
    text = text.replace("&nbsp;", " ")
    text = _TAG_RE.sub("", text)
    return text.strip("\n")
