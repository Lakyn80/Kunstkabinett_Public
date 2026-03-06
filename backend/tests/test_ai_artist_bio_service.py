from app.modules.ai.artist_bio.service import (
    _normalize_name,
    _sources_to_urls,
)


def test_normalize_name_trims_and_lowercases():
    assert _normalize_name("  Frantisek   Kupka  ") == "frantisek kupka"


def test_sources_to_urls_unique_non_empty():
    urls = _sources_to_urls(
        [
            {"url": "https://example.com/a"},
            {"url": "https://example.com/a"},
            {"url": "https://example.com/b"},
            {"url": ""},
        ]
    )
    assert urls == ["https://example.com/a", "https://example.com/b"]
