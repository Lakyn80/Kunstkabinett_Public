"""
Translation service using DeepSeek API for automatic translations.

Supported languages:
- cs (Czech) - source language
- en (English)
- fr (French)
- de (German)
- ru (Russian)
- zh (Chinese)
- ja (Japanese)
- it (Italian)
- pl (Polish)
"""

import os
import logging
import asyncio
import random
import re
import unicodedata
from typing import Dict, Optional
import httpx

logger = logging.getLogger(__name__)


class TranslationRetryableError(RuntimeError):
    def __init__(self, message: str, status_code: Optional[int] = None):
        super().__init__(message)
        self.status_code = status_code


class TranslationTerminalError(RuntimeError):
    def __init__(self, message: str, status_code: Optional[int] = None):
        super().__init__(message)
        self.status_code = status_code


class TranslationQualityGate:
    """Validation layer to detect broken/mixed-language translation outputs."""

    EN_STOPWORDS = {
        "the", "and", "of", "to", "in", "is", "for", "with", "on", "that", "this", "it", "as", "are", "from",
    }

    TARGET_STOPWORDS = {
        "en": {"the", "and", "of", "to", "in", "is", "for", "with", "on", "that"},
        "de": {"der", "die", "das", "und", "ist", "zu", "mit", "von", "den", "ein"},
        "fr": {"le", "la", "les", "et", "est", "de", "des", "pour", "avec", "une", "un"},
        "it": {"il", "la", "le", "e", "di", "che", "per", "con", "una", "un"},
        "pl": {"i", "w", "z", "na", "to", "jest", "oraz", "dla", "sie", "nie"},
        "ru": {"и", "в", "на", "что", "это", "не", "с", "по", "для", "как"},
    }

    @staticmethod
    def _extract_words(text: str) -> list[str]:
        return re.findall(r"[0-9A-Za-zÀ-ÖØ-öø-ÿĀ-žЀ-ӿ一-龯ぁ-ゟ゠-ヿー]+", (text or "").lower())

    @staticmethod
    def _script_counts(text: str) -> dict:
        letters = 0
        latin = 0
        cyrillic = 0
        han = 0
        kana = 0
        for ch in text or "":
            if not ch.isalpha():
                continue
            letters += 1
            name = unicodedata.name(ch, "")
            if "LATIN" in name:
                latin += 1
            elif "CYRILLIC" in name:
                cyrillic += 1
            elif "CJK UNIFIED IDEOGRAPH" in name:
                han += 1
            elif "HIRAGANA" in name or "KATAKANA" in name:
                kana += 1
        return {
            "letters": letters,
            "latin": latin,
            "cyrillic": cyrillic,
            "han": han,
            "kana": kana,
        }

    @staticmethod
    def _ratio(value: int, total: int) -> float:
        if total <= 0:
            return 0.0
        return float(value) / float(total)

    @staticmethod
    def _normalize_spaces(text: str) -> str:
        return re.sub(r"\s+", " ", text or "").strip()

    def validate(self, source_text: str, translated_text: str, target_lang: str) -> tuple[bool, str]:
        translated = (translated_text or "").strip()
        source = (source_text or "").strip()

        if not translated:
            return False, "empty_translation"

        source_compact = re.sub(r"\s+", "", source)
        translated_compact = re.sub(r"\s+", "", translated)
        source_len = len(source_compact)
        translated_len = len(translated_compact)

        if source_len >= 40:
            ratio = float(translated_len) / float(max(1, source_len))
            if ratio < 0.35 or ratio > 2.4:
                return False, "length_ratio_out_of_range"

        # If long source tail appears unchanged in translation, this is likely leakage/hallucinated append.
        if source_len >= 120 and target_lang != "cs":
            source_tail = self._normalize_spaces(source.lower())[-120:]
            translated_norm = self._normalize_spaces(translated.lower())
            if len(source_tail) >= 50 and source_tail in translated_norm:
                return False, "contains_unchanged_source_tail"

        words = self._extract_words(translated)
        if source_len >= 120 and words:
            target_stopwords = self.TARGET_STOPWORDS.get(target_lang)
            if target_stopwords and target_lang != "en":
                target_hits = sum(1 for w in words if w in target_stopwords)
                en_hits = sum(1 for w in words if w in self.EN_STOPWORDS)
                if target_hits == 0 and en_hits >= 6:
                    return False, "likely_wrong_language_output"

        scripts = self._script_counts(translated)
        letters = scripts["letters"]
        cyrillic_ratio = self._ratio(scripts["cyrillic"], letters)
        han_ratio = self._ratio(scripts["han"], letters)
        jp_ratio = self._ratio(scripts["han"] + scripts["kana"], letters)

        # Non-latin language guardrails.
        if source_len >= 60 and target_lang == "ru":
            if cyrillic_ratio < 0.20:
                return False, "insufficient_cyrillic_script"
            tail = translated[-220:]
            tail_scripts = self._script_counts(tail)
            tail_letters = tail_scripts["letters"]
            tail_latin_ratio = self._ratio(tail_scripts["latin"], tail_letters)
            tail_cyrillic_ratio = self._ratio(tail_scripts["cyrillic"], tail_letters)
            if tail_latin_ratio > 0.55 and tail_cyrillic_ratio < 0.35:
                return False, "tail_script_mismatch"

        if source_len >= 60 and target_lang == "zh" and han_ratio < 0.12:
            return False, "insufficient_han_script"

        if source_len >= 60 and target_lang == "ja" and jp_ratio < 0.10:
            return False, "insufficient_japanese_script"

        return True, "ok"


class TranslationService:
    """Service for automatic translations using DeepSeek API."""

    # Language names for prompts
    LANG_NAMES = {
        "cs": "Czech",
        "en": "English",
        "fr": "French",
        "de": "German",
        "ru": "Russian",
        "zh": "Chinese (Simplified)",
        "ja": "Japanese",
        "it": "Italian",
        "pl": "Polish",
    }

    TARGET_LANGUAGES = ["en", "fr", "de", "ru", "zh", "ja", "it", "pl"]
    SOURCE_LANGUAGE = "cs"
    TRANSLATE_PARALLELISM = int(os.getenv("TRANSLATE_PARALLELISM", "3") or "3")
    TRANSLATE_MAX_ATTEMPTS = int(os.getenv("TRANSLATE_MAX_ATTEMPTS", "10") or "10")
    TRANSLATE_QUALITY_MAX_ATTEMPTS = int(os.getenv("TRANSLATE_QUALITY_MAX_ATTEMPTS", "3") or "3")

    def __init__(self):
        """Initialize translation service with DeepSeek API key."""
        self.api_key = os.getenv("DEEPSEEK_API_KEY")
        self.api_url = "https://api.deepseek.com/v1/chat/completions"
        self.quality_gate = TranslationQualityGate()

        if not self.api_key:
            logger.warning("DEEPSEEK_API_KEY not found in environment. Translation service will be disabled.")

    @staticmethod
    def _is_retryable_status(status_code: int) -> bool:
        return status_code in {408, 409, 425, 429, 500, 502, 503, 504}

    @staticmethod
    def _is_invalid_api_key(status_code: int, response_text: str) -> bool:
        lowered = (response_text or "").lower()
        return status_code in {401, 403} or "invalid api key" in lowered or "invalid_api_key" in lowered

    @staticmethod
    def _retry_delay(attempt: int) -> float:
        return min(0.5 * (2 ** max(0, attempt - 1)) + random.uniform(0.0, 0.2), 4.0)

    async def _translate_with_google_fallback(
        self, text: str, target_lang: str, source_lang: str = "cs", client: Optional[httpx.AsyncClient] = None
    ) -> Optional[str]:
        """
        Fallback translation via public Google endpoint when DeepSeek is unavailable.
        """
        endpoints = [
            "https://translate.googleapis.com/translate_a/single",
            "https://translate.google.com/translate_a/single",
        ]
        params = {
            "client": "gtx",
            "sl": source_lang,
            "tl": target_lang,
            "dt": "t",
            "q": text,
        }
        headers = {
            "User-Agent": "Mozilla/5.0",
        }

        for endpoint in endpoints:
            try:
                if client is not None:
                    response = await client.get(
                        endpoint,
                        params=params,
                        headers=headers,
                        timeout=20.0,
                    )
                else:
                    async with httpx.AsyncClient() as local_client:
                        response = await local_client.get(
                            endpoint,
                            params=params,
                            headers=headers,
                            timeout=20.0,
                        )

                if response.status_code != 200:
                    logger.error(
                        f"Google fallback API error ({endpoint}): {response.status_code} - {response.text}"
                    )
                    continue

                data = response.json()
                if not isinstance(data, list) or not data or not isinstance(data[0], list):
                    continue

                translated_parts = []
                for chunk in data[0]:
                    if isinstance(chunk, list) and chunk and isinstance(chunk[0], str):
                        translated_parts.append(chunk[0])

                translated_text = "".join(translated_parts).strip()
                if translated_text:
                    return translated_text
            except Exception as e:
                logger.error(f"Google fallback translation error ({endpoint}): {str(e)}")

        return None

    async def translate_text(
        self,
        text: str,
        target_lang: str,
        source_lang: str = "cs",
        client: Optional[httpx.AsyncClient] = None,
        extra_instruction: Optional[str] = None,
    ) -> Optional[str]:
        """
        Translate text from source language to target language using DeepSeek.

        Args:
            text: Text to translate
            target_lang: Target language code (en, fr, de, etc.)
            source_lang: Source language code (default: cs)

        Returns:
            Translated text or None if translation failed
        """
        if not text or text.strip() == "":
            return text

        if not self.api_key:
            logger.warning("DeepSeek API key not configured, using fallback translator")
            return await self._translate_with_google_fallback(text, target_lang, source_lang, client=client)

        source_lang_name = self.LANG_NAMES.get(source_lang, source_lang)
        target_lang_name = self.LANG_NAMES.get(target_lang, target_lang)

        # Create translation prompt
        prompt_parts = [
            f"Translate the following text from {source_lang_name} to {target_lang_name}. Return ONLY the translated text, no explanations or additional text.",
        ]
        if extra_instruction:
            prompt_parts.append(f"Strict requirements: {extra_instruction}")
        prompt_parts.append(f"Text to translate:\n{text}")
        prompt = "\n\n".join(prompt_parts)

        max_attempts = max(1, int(self.TRANSLATE_MAX_ATTEMPTS or 10))

        for attempt in range(1, max_attempts + 1):
            try:
                if client is not None:
                    response = await client.post(
                        self.api_url,
                        headers={
                            "Authorization": f"Bearer {self.api_key}",
                            "Content-Type": "application/json",
                        },
                        json={
                            "model": "deepseek-chat",
                            "messages": [
                                {
                                    "role": "system",
                                    "content": "You are a professional translator. Translate text accurately while preserving meaning, tone, and formatting. Return ONLY the translation without any explanations."
                                },
                                {
                                    "role": "user",
                                    "content": prompt
                                }
                            ],
                            "temperature": 0.3,
                            "max_tokens": 2000,
                        },
                        timeout=30.0,
                    )
                else:
                    async with httpx.AsyncClient() as local_client:
                        response = await local_client.post(
                            self.api_url,
                            headers={
                                "Authorization": f"Bearer {self.api_key}",
                                "Content-Type": "application/json",
                            },
                            json={
                                "model": "deepseek-chat",
                                "messages": [
                                    {
                                        "role": "system",
                                        "content": "You are a professional translator. Translate text accurately while preserving meaning, tone, and formatting. Return ONLY the translation without any explanations."
                                    },
                                    {
                                        "role": "user",
                                        "content": prompt
                                    }
                                ],
                                "temperature": 0.3,
                                "max_tokens": 2000,
                            },
                            timeout=30.0,
                        )

                if response.status_code == 200:
                    data = response.json()
                    translated_text = data["choices"][0]["message"]["content"].strip()
                    logger.info(f"Successfully translated text to {target_lang}")
                    return translated_text

                if self._is_invalid_api_key(response.status_code, response.text):
                    logger.error(
                        f"DeepSeek API key invalid for language {target_lang}, switching to fallback translator"
                    )
                    return await self._translate_with_google_fallback(text, target_lang, source_lang, client=client)

                if attempt < max_attempts and self._is_retryable_status(response.status_code):
                    await asyncio.sleep(self._retry_delay(attempt))
                    continue

                logger.error(
                    f"DeepSeek API error: {response.status_code} - {response.text}"
                )
                return await self._translate_with_google_fallback(text, target_lang, source_lang, client=client)

            except Exception as e:
                if attempt < max_attempts:
                    await asyncio.sleep(self._retry_delay(attempt))
                    continue
                logger.error(f"Translation error: {str(e)}")
                return await self._translate_with_google_fallback(text, target_lang, source_lang, client=client)

    async def translate_text_for_queue(
        self,
        text: str,
        target_lang: str,
        source_lang: str = "cs",
    ) -> str:
        """
        Strict translation path for background queue workers.
        Raises retryable/terminal errors so RQ can apply retry policy.
        """
        if not text or text.strip() == "":
            return text

        if not self.api_key:
            raise TranslationTerminalError("DEEPSEEK_API_KEY is not configured")

        source_lang_name = self.LANG_NAMES.get(source_lang, source_lang)
        target_lang_name = self.LANG_NAMES.get(target_lang, target_lang)
        prompt = (
            f"Translate the following text from {source_lang_name} to {target_lang_name}. "
            f"Return ONLY the translated text, no explanations or additional text.\n\n"
            f"Text to translate:\n{text}"
        )

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.api_url,
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": "deepseek-chat",
                        "messages": [
                            {
                                "role": "system",
                                "content": (
                                    "You are a professional translator. Translate text accurately while preserving "
                                    "meaning, tone, and formatting. Return ONLY the translation without explanations."
                                ),
                            },
                            {
                                "role": "user",
                                "content": prompt,
                            },
                        ],
                        "temperature": 0.3,
                        "max_tokens": 2000,
                    },
                    timeout=30.0,
                )
        except (httpx.TimeoutException, httpx.ConnectError, httpx.NetworkError, httpx.ReadError) as exc:
            raise TranslationRetryableError(f"Network error: {exc}") from exc
        except Exception as exc:
            raise TranslationRetryableError(f"Translation request failed: {exc}") from exc

        status_code = int(response.status_code)
        if status_code == 200:
            try:
                data = response.json()
                translated = str(data["choices"][0]["message"]["content"]).strip()
            except Exception as exc:
                raise TranslationRetryableError("Invalid translation response format", status_code=200) from exc
            if not translated:
                raise TranslationRetryableError("Empty translation response", status_code=200)
            return translated

        body = (response.text or "")[:500]
        if status_code in (401, 403):
            raise TranslationTerminalError(
                f"Translation API authorization failed ({status_code}): {body}",
                status_code=status_code,
            )
        if status_code == 429 or 500 <= status_code <= 599:
            raise TranslationRetryableError(
                f"Translation API temporary error ({status_code}): {body}",
                status_code=status_code,
            )
        if status_code in (400, 404, 422):
            raise TranslationTerminalError(
                f"Translation API validation/client error ({status_code}): {body}",
                status_code=status_code,
            )

        raise TranslationRetryableError(
            f"Translation API unexpected status ({status_code}): {body}",
            status_code=status_code,
        )

    async def translate_text_with_quality_gate(
        self,
        text: str,
        target_lang: str,
        source_lang: str = "cs",
        client: Optional[httpx.AsyncClient] = None,
    ) -> Optional[str]:
        """Translate text with post-translation validation and guarded retries."""
        if not text or text.strip() == "":
            return text

        max_quality_attempts = max(1, int(self.TRANSLATE_QUALITY_MAX_ATTEMPTS or 3))
        last_candidate: Optional[str] = None
        feedback: Optional[str] = None

        for attempt in range(1, max_quality_attempts + 1):
            candidate = await self.translate_text(
                text=text,
                target_lang=target_lang,
                source_lang=source_lang,
                client=client,
                extra_instruction=feedback,
            )
            if not candidate:
                continue
            last_candidate = candidate
            is_valid, reason = self.quality_gate.validate(text, candidate, target_lang)
            if is_valid:
                return candidate
            feedback = (
                f"Previous output failed quality check ({reason}). "
                f"Output MUST be only in {self.LANG_NAMES.get(target_lang, target_lang)}, preserve structure, and contain no extra appended text."
            )
            logger.warning(
                "Translation quality gate rejected output for %s (attempt %s/%s): %s",
                target_lang,
                attempt,
                max_quality_attempts,
                reason,
            )

        fallback = await self._translate_with_google_fallback(text, target_lang, source_lang, client=client)
        if fallback:
            is_valid, reason = self.quality_gate.validate(text, fallback, target_lang)
            if is_valid:
                return fallback
            logger.warning(
                "Fallback translation rejected by quality gate for %s: %s",
                target_lang,
                reason,
            )
            last_candidate = fallback

        return last_candidate or text

    async def translate_to_all_languages(
        self, text: str, source_lang: str = "cs"
    ) -> Dict[str, str]:
        """
        Translate text to all supported languages.

        Args:
            text: Text to translate (in Czech by default)
            source_lang: Source language code (default: cs)

        Returns:
            Dictionary with language codes as keys and translated texts as values
            Example: {"en": "Abstract", "fr": "Abstrait", ...}
        """
        translations = {source_lang: text}  # Include original text

        if not self.api_key:
            logger.warning("DeepSeek API key not configured, using fallback translator for all languages")

        target_languages = [lang for lang in self.TARGET_LANGUAGES if lang != source_lang]
        semaphore = asyncio.Semaphore(max(1, int(self.TRANSLATE_PARALLELISM or 3)))

        async with httpx.AsyncClient() as shared_client:
            async def _translate_single(lang: str) -> tuple[str, str]:
                async with semaphore:
                    translated = await self.translate_text(
                        text,
                        lang,
                        source_lang,
                        client=shared_client,
                    )
                if translated:
                    return lang, translated
                logger.warning(f"Failed to translate to {lang}, using source text")
                return lang, text

            results = await asyncio.gather(*[_translate_single(lang) for lang in target_languages])

        for lang_code, translated_text in results:
            translations[lang_code] = translated_text

        return translations

    async def translate_to_all_languages_with_quality_gate(
        self, text: str, source_lang: str = "cs"
    ) -> Dict[str, str]:
        """
        Translate text to all supported languages with output validation.
        """
        translations = {source_lang: text}

        if not self.api_key:
            logger.warning("DeepSeek API key not configured, using fallback translator for all languages")

        target_languages = [lang for lang in self.TARGET_LANGUAGES if lang != source_lang]
        semaphore = asyncio.Semaphore(max(1, int(self.TRANSLATE_PARALLELISM or 3)))

        async with httpx.AsyncClient() as shared_client:
            async def _translate_single(lang: str) -> tuple[str, str]:
                async with semaphore:
                    translated = await self.translate_text_with_quality_gate(
                        text,
                        lang,
                        source_lang,
                        client=shared_client,
                    )
                if translated:
                    return lang, translated
                logger.warning(f"Failed to translate to {lang}, using source text")
                return lang, text

            results = await asyncio.gather(*[_translate_single(lang) for lang in target_languages])

        for lang_code, translated_text in results:
            translations[lang_code] = translated_text

        return translations


# Global instance
translation_service = TranslationService()
