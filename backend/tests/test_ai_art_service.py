import json

import httpx
import pytest

from app.modules.ai.art import service as art_service
from app.modules.ai.art.service import (
    _normalize_art_type,
    _normalize_rewrite_mode,
    _normalize_tags,
    _safe_json_loads,
)


def test_normalize_art_type_known_values():
    assert _normalize_art_type("painting") == "painting"
    assert _normalize_art_type("sculpture") == "sculpture"
    assert _normalize_art_type("auto") == "other"


def test_normalize_art_type_unknown_returns_fallback():
    assert _normalize_art_type("unknown", fallback="other") == "other"
    assert _normalize_art_type("", fallback="painting") == "painting"


def test_normalize_tags_deduplicates_and_strips():
    tags = _normalize_tags(["  Blue ", "blue", "", "Abstract", "ABSTRACT"])
    assert tags == ["Blue", "Abstract"]


def test_normalize_rewrite_mode_accepts_lyric():
    assert _normalize_rewrite_mode("lyric") == "lyric"


def test_safe_json_loads_extracts_json_object():
    raw = "result: {\"title\": \"Test\", \"description\": \"Desc\"}"
    parsed = _safe_json_loads(raw)
    assert parsed["title"] == "Test"
    assert parsed["description"] == "Desc"


@pytest.mark.asyncio
async def test_describe_art_image_always_generates_fresh_text(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-openai-key")

    counts = {"openai": 0}

    async def fake_post_json_with_retry(url, headers, payload, timeout=90.0, **kwargs):
        assert url == art_service.OPENAI_API_URL
        counts["openai"] += 1
        description = (
            "Kompozice pracuje s přesným rytmem tvarů a citlivou gradací světla. "
            "Barevnost staví na jemných přechodech i kontrastních akcentních bodech, které vedou divákův pohled. "
            "Vrstvení povrchu zvýrazňuje materiálovou kvalitu a podporuje prostorový účinek celku. "
            "Motiv je čitelný, ale ponechává prostor pro interpretaci skrze detaily v okrajových partiích. "
            "Celkové vyznění je soustředěné a vizuálně vyvážené, s důrazem na vztah světla, stínu a textury. "
        ) * 3
        return httpx.Response(
            200,
            json={
                "choices": [
                    {
                        "message": {
                            "content": json.dumps(
                                {
                                    "title": "Originální dílo",
                                    "description": description,
                                    "tags": ["abstrakce", "kompozice", "světlo", "textura", "rytmus"],
                                    "art_type": "painting",
                                },
                                ensure_ascii=False,
                            )
                        }
                    }
                ]
            },
        )

    monkeypatch.setattr(art_service, "post_json_with_retry", fake_post_json_with_retry)
    monkeypatch.setattr(
        art_service,
        "search",
        lambda *args, **kwargs: [{"id": "1", "text": "", "metadata": {"art_type": "painting", "tags": "abstrakce,kompozice"}}],
    )

    first = await art_service.describe_art_image(
        image_bytes=b"same-image",
        mime_type="image/webp",
        art_type="auto",
        save_to_rag=True,
        product_id=1,
        image_asset_key="42",
    )
    second = await art_service.describe_art_image(
        image_bytes=b"same-image",
        mime_type="image/webp",
        art_type="auto",
        save_to_rag=True,
        product_id=1,
        image_asset_key="42",
    )

    assert first["provider_used"] == "openai_vision"
    assert first["from_cache"] is False
    assert second["provider_used"] == "openai_vision"
    assert second["from_cache"] is False
    assert counts["openai"] == 2


@pytest.mark.asyncio
async def test_describe_art_image_runs_low_then_high_when_low_is_generic(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-openai-key")

    counts = {"low": 0, "high": 0}

    async def fake_post_json_with_retry(url, headers, payload, timeout=90.0, **kwargs):
        assert url == art_service.OPENAI_API_URL
        detail = (
            (((payload or {}).get("messages") or [{}, {}])[1].get("content") or [{}, {}])[1]
            .get("image_url", {})
            .get("detail")
        )

        if detail == "low":
            counts["low"] += 1
            content = json.dumps(
                {
                    "title": "Nizky detail",
                    "description": "Příliš krátký obecný popis.",
                    "tags": ["obraz", "barva"],
                    "art_type": "painting",
                },
                ensure_ascii=False,
            )
        else:
            counts["high"] += 1
            content = json.dumps(
                {
                    "title": "Vysoky detail",
                    "description": (
                        "Kompozice je rozvržena v několika prostorových plánech, kde se střídá světlo a stín. "
                        "Barevnost přechází od tlumených okrů k chladnějším modrým tónům, které vyvažují centrální motiv. "
                        "Povrch působí živě díky vrstvené technice a patrné textuře, jež podtrhuje materiálovou kvalitu díla. "
                        "Linie směřují oko diváka od dominantního tvaru k vedlejším akcentům a uzavírají kompozici do rytmického celku. "
                        "Vizuální struktura pracuje s napětím mezi klidnými plochami a dynamickými zásahy, což vytváří soustředěnou atmosféru. "
                        "Motiv je čitelný, ale ponechává prostor pro interpretaci, protože jednotlivé vrstvy odhalují nové významy při delším pozorování. "
                        "Technika je přesná, současně však ponechává stopu autorova gesta, které dává obrazu osobní charakter. "
                        "Celkový účinek stojí na vyváženosti tvaru, barvy, světla a materiálového projevu. "
                        "Dílo působí soudržně a současně živě díky jemným posunům v rytmu kompozice, které udržují pozornost diváka. "
                        "Vztah mezi předním plánem a pozadím je vystavěn citlivě, takže obraz nabízí čitelnost i hloubku."
                    ),
                    "tags": ["kompozice", "barevnost", "světlo", "stín", "textura", "technika"],
                    "art_type": "painting",
                },
                ensure_ascii=False,
            )

        return httpx.Response(200, json={"choices": [{"message": {"content": content}}]})

    monkeypatch.setattr(art_service, "post_json_with_retry", fake_post_json_with_retry)
    monkeypatch.setattr(
        art_service,
        "search",
        lambda *args, **kwargs: [{"id": "1", "text": "", "metadata": {"art_type": "painting", "tags": "kompozice,textura"}}],
    )

    result = await art_service.describe_art_image(
        image_bytes=b"img-low-high",
        mime_type="image/webp",
        art_type="auto",
        save_to_rag=False,
        product_id=20,
        image_asset_key="90",
    )
    assert result["from_cache"] is False
    assert counts["low"] == 1
    assert counts["high"] == 1
    assert len(result["description"]) >= 900


@pytest.mark.asyncio
async def test_describe_art_image_regenerates_when_duplicate_detected(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-openai-key")

    counts = {"openai": 0}

    async def fake_post_json_with_retry(url, headers, payload, timeout=90.0, **kwargs):
        assert url == art_service.OPENAI_API_URL
        counts["openai"] += 1
        strict_mode = float(payload.get("temperature") or 0.0) >= 0.35
        text = (
            "Toto je původní popis, který je příliš podobný existujícímu textu. " * 40
            if not strict_mode
            else "Toto je nově regenerovaný originální popis s odlišnou stylistikou. " * 40
        )
        content = json.dumps(
            {
                "title": "Test",
                "description": text,
                "tags": ["abstrakce", "forma", "světlo", "textura", "hmota"],
                "art_type": "sculpture",
            },
            ensure_ascii=False,
        )
        return httpx.Response(200, json={"choices": [{"message": {"content": content}}]})

    monkeypatch.setattr(art_service, "post_json_with_retry", fake_post_json_with_retry)
    monkeypatch.setattr(art_service, "_find_best_description_similarity", lambda *args, **kwargs: (0.91, 999))
    monkeypatch.setattr(art_service, "search", lambda *args, **kwargs: [])

    result = await art_service.describe_art_image(
        image_bytes=b"dup-check-image",
        mime_type="image/webp",
        art_type="auto",
        save_to_rag=False,
    )
    assert result["from_cache"] is False
    assert counts["openai"] >= 2
    assert "regenerovaný" in result["description"]


@pytest.mark.asyncio
async def test_rewrite_art_description_requires_recent_base(monkeypatch):
    monkeypatch.setattr(art_service, "_get_recent_base_description", lambda _image_key: None)

    with pytest.raises(ValueError, match="Base description"):
        await art_service.rewrite_art_description(
            image_key="img_key_2",
            mode="shorten",
            style_hint=None,
            max_chars=420,
            save_to_rag=True,
        )


@pytest.mark.asyncio
async def test_rewrite_art_description_uses_recent_base_and_deepseek(monkeypatch):
    monkeypatch.setenv("DEEPSEEK_API_KEY", "test-deepseek-key")

    saved = []

    monkeypatch.setattr(
        art_service,
        "_get_recent_base_description",
        lambda _image_key: {
            "title": "Base title",
            "description": "Base description text",
            "tags": ["abstrakce", "figura"],
            "art_type": "painting",
        },
    )
    monkeypatch.setattr(
        art_service,
        "search",
        lambda *args, **kwargs: [{"id": "1", "text": "", "metadata": {"art_type": "painting", "tags": "abstrakce,figura"}}],
    )

    def fake_add_document(text, metadata=None, doc_id=None):
        saved.append({"text": text, "metadata": metadata or {}, "doc_id": doc_id})
        return doc_id or "doc_saved"

    async def fake_post_json_with_retry(url, headers, payload, timeout=90.0, **kwargs):
        assert url == art_service.DEEPSEEK_API_URL
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": "{\"description\":\"Generated marketing text\"}"}}]},
        )

    monkeypatch.setattr(art_service, "add_document", fake_add_document)
    monkeypatch.setattr(art_service, "post_json_with_retry", fake_post_json_with_retry)

    result = await art_service.rewrite_art_description(
        image_key="img_key_3",
        mode="marketing",
        style_hint=None,
        max_chars=420,
        save_to_rag=True,
    )

    assert result["from_cache"] is False
    assert result["provider_used"] == "deepseek"
    assert result["description"] == "Generated marketing text"
    assert saved
    assert "Generated marketing text" not in saved[0]["text"]
