import pytest

from app.services.translation_service import TranslationQualityGate, TranslationService


def test_quality_gate_rejects_english_output_for_russian_target():
    gate = TranslationQualityGate()
    source = (
        "Moderni umeni predstavuje zasadni promenu v pristupu k tvorbe a vyznamu dila. "
        "Nejde jen o estetiku, ale o myslenku, kontext a osobni vyjadreni autora. "
    ) * 4
    bad_translation = (
        "Modern art represents a fundamental change in the way artists approach creation and meaning. "
        "It is not only about aesthetics, but about the idea and context of the author. "
    ) * 4

    ok, reason = gate.validate(source, bad_translation, "ru")
    assert ok is False
    assert reason != "ok"


def test_quality_gate_accepts_russian_output_for_russian_target():
    gate = TranslationQualityGate()
    source = (
        "Moderni umeni predstavuje zasadni promenu v pristupu k tvorbe a vyznamu dila. "
        "Nejde jen o estetiku, ale o myslenku, kontext a osobni vyjadreni autora. "
    ) * 4
    good_translation = (
        "Современное искусство представляет фундаментальное изменение в подходе к творчеству и смыслу произведения. "
        "Речь идет не только об эстетике, но и об идее, контексте и личном высказывании автора. "
    ) * 4

    ok, reason = gate.validate(source, good_translation, "ru")
    assert ok is True
    assert reason == "ok"


@pytest.mark.asyncio
async def test_translate_text_with_quality_gate_retries_until_valid(monkeypatch):
    service = TranslationService()
    calls = {"count": 0}
    source = (
        "Moderni umeni predstavuje zasadni promenu v pristupu k tvorbe a vyznamu dila. "
        "Nejde jen o estetiku, ale o myslenku, kontext a osobni vyjadreni autora. "
    ) * 4
    bad_translation = (
        "Modern art represents a fundamental change in the way artists approach creation and meaning. "
        "It is not only about aesthetics, but about the idea and context of the author. "
    ) * 4
    good_translation = (
        "Современное искусство представляет фундаментальное изменение в подходе к творчеству и смыслу произведения. "
        "Речь идет не только об эстетике, но и об идее, контексте и личном высказывании автора. "
    ) * 4

    async def fake_translate_text(text, target_lang, source_lang="cs", client=None, extra_instruction=None):
        calls["count"] += 1
        return bad_translation if calls["count"] == 1 else good_translation

    async def fake_fallback(text, target_lang, source_lang="cs", client=None):
        return None

    monkeypatch.setattr(service, "translate_text", fake_translate_text)
    monkeypatch.setattr(service, "_translate_with_google_fallback", fake_fallback)

    result = await service.translate_text_with_quality_gate(
        text=source,
        target_lang="ru",
        source_lang="cs",
    )

    assert result == good_translation
    assert calls["count"] == 2
