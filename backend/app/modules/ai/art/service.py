from __future__ import annotations

from typing import Any, Dict, List, Optional
import base64
import hashlib
import io
import json
import logging
import os
from pathlib import Path
import re
from difflib import SequenceMatcher

import httpx
from PIL import Image, ImageOps

from .chroma_client import add_document, search
from ..http_retry import post_json_with_retry

OPENAI_API_URL = "https://api.openai.com/v1/chat/completions"
DEFAULT_OPENAI_MODEL = "gpt-4o-mini"
DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions"
DEEPSEEK_MODEL = "deepseek-chat"
ALLOWED_ART_TYPES = {"painting", "sculpture", "other", "auto"}
ALLOWED_REWRITE_MODES = {"shorten", "marketing", "regenerate", "lyric"}
DEFAULT_LYRIC_STYLE_RULE = (
    "Piš kultivovaně a mírně lyricky, ale zachovej přesná vizuální fakta, kompozici a kunsthistorickou věcnost."
)
VISION_GENERIC_MIN_CHARS = 900
VISION_GENERIC_MIN_TAGS = 5
VISION_GENERIC_HINTS = (
    "kompozic",
    "barev",
    "svět",
    "stín",
    "technik",
    "povrch",
    "materi",
    "textur",
    "linie",
)
VISION_PREPROCESS_MAX_SIDE = 1024
VISION_PREPROCESS_WEBP_QUALITY = 78
DESCRIPTION_DUPLICATE_THRESHOLD = float(os.getenv("AI_DESCRIPTION_DUPLICATE_THRESHOLD", "0.8") or "0.8")
RECENT_BASE_DESCRIPTION_LIMIT = int(os.getenv("AI_RECENT_BASE_DESCRIPTION_LIMIT", "512") or "512")

logger = logging.getLogger(__name__)
_recent_base_descriptions: dict[str, dict[str, Any]] = {}


def _to_data_url(image_bytes: bytes, mime_type: str) -> str:
    b64 = base64.b64encode(image_bytes).decode("utf-8")
    return f"data:{mime_type};base64,{b64}"


def _safe_json_loads(text: str) -> Dict[str, Any]:
    raw = (text or "").strip()
    if not raw:
        return {}

    try:
        return json.loads(raw)
    except Exception:
        start = raw.find("{")
        end = raw.rfind("}")
        if start >= 0 and end > start:
            try:
                return json.loads(raw[start : end + 1])
            except Exception:
                return {}
        return {}


def _normalize_tags(value: Any) -> List[str]:
    if not isinstance(value, list):
        return []

    out: List[str] = []
    seen = set()
    for item in value:
        tag = str(item or "").strip()
        if not tag:
            continue
        key = tag.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(tag)
    return out[:12]


def _normalize_art_type(value: Any, fallback: str = "other") -> str:
    art_type = str(value or "").strip().lower()
    if art_type in ALLOWED_ART_TYPES:
        return "other" if art_type == "auto" else art_type
    return fallback


def _normalize_rewrite_mode(value: Any) -> str:
    mode = str(value or "").strip().lower()
    if mode in ALLOWED_REWRITE_MODES:
        return mode
    raise ValueError("Invalid rewrite mode. Allowed: shorten, marketing, regenerate, lyric")


def _split_tags(value: Any) -> List[str]:
    raw = str(value or "").strip()
    if not raw:
        return []
    return _normalize_tags([part.strip() for part in raw.split(",") if str(part).strip()])


def _normalize_search_text(value: Any) -> str:
    text = str(value or "").strip().lower()
    text = re.sub(r"\s+", " ", text)
    return text


def _similarity_ratio(left: str, right: str) -> float:
    a = _normalize_search_text(left)
    b = _normalize_search_text(right)
    if not a or not b:
        return 0.0
    return float(SequenceMatcher(a=a, b=b).ratio())


def _find_best_description_similarity(description: str, product_id: Optional[int] = None) -> tuple[float, Optional[int]]:
    try:
        from app.db import models as db_models
        from app.db.session import SessionLocal
    except Exception:
        return 0.0, None

    db = SessionLocal()
    try:
        query = db.query(db_models.Product.id, db_models.Product.description).filter(db_models.Product.description.isnot(None))
        if product_id is not None:
            try:
                query = query.filter(db_models.Product.id != int(product_id))
            except Exception:
                pass

        best_ratio = 0.0
        best_product_id: Optional[int] = None
        for row in query.all():
            existing = str(row[1] or "").strip()
            if not existing:
                continue
            ratio = _similarity_ratio(description, existing)
            if ratio > best_ratio:
                best_ratio = ratio
                best_product_id = int(row[0])
        return best_ratio, best_product_id
    except Exception:
        return 0.0, None
    finally:
        db.close()


def _build_rag_hint_summary(metadata: Dict[str, Any]) -> str:
    style = str(metadata.get("style") or metadata.get("art_type") or "").strip()
    materials = str(metadata.get("materials") or "").strip()
    movement = str(metadata.get("movement") or "").strip()
    tags = _split_tags(metadata.get("tags"))

    parts: List[str] = []
    if style:
        parts.append(f"styl: {style}")
    if tags:
        parts.append(f"klíčová slova: {', '.join(tags[:8])}")
    if materials:
        parts.append(f"materiály: {materials}")
    if movement:
        parts.append(f"směr: {movement}")
    return "; ".join(parts).strip()


def _build_rag_embedding_text(
    title: str,
    art_type: str,
    tags: List[str],
    style_hint: Optional[str] = None,
) -> str:
    title_part = str(title or "").strip() or "bez názvu"
    art_part = str(art_type or "").strip() or "other"
    tags_part = ", ".join(_normalize_tags(tags or []))
    style_part = str(style_hint or "").strip()
    parts = [f"title: {title_part}", f"art_type: {art_part}"]
    if tags_part:
        parts.append(f"keywords: {tags_part}")
    if style_part:
        parts.append(f"style_hint: {style_part}")
    return " | ".join(parts)


def _cache_recent_base_description(
    image_key: str,
    *,
    title: str,
    description: str,
    tags: List[str],
    art_type: str,
) -> None:
    key = str(image_key or "").strip()
    if not key:
        return
    _recent_base_descriptions[key] = {
        "title": str(title or "").strip(),
        "description": str(description or "").strip(),
        "tags": _normalize_tags(tags or []),
        "art_type": _normalize_art_type(art_type, fallback="other"),
    }

    if len(_recent_base_descriptions) > RECENT_BASE_DESCRIPTION_LIMIT:
        for old_key in list(_recent_base_descriptions.keys())[: len(_recent_base_descriptions) - RECENT_BASE_DESCRIPTION_LIMIT]:
            _recent_base_descriptions.pop(old_key, None)


def _get_recent_base_description(image_key: str) -> Optional[Dict[str, Any]]:
    key = str(image_key or "").strip()
    if not key:
        return None
    payload = _recent_base_descriptions.get(key)
    if not isinstance(payload, dict):
        return None
    return payload


def _build_image_key(image_bytes: bytes, mime_type: str) -> str:
    digest = hashlib.sha256()
    digest.update(image_bytes or b"")
    digest.update((mime_type or "").encode("utf-8"))
    return digest.hexdigest()


def _sanitize_scope_value(value: Any) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""
    return "".join(ch for ch in raw if ch.isalnum() or ch in ("-", "_"))


def _build_scoped_image_key(
    image_key: str,
    product_id: Optional[int] = None,
    image_asset_key: Optional[str] = None,
) -> str:
    base = str(image_key or "").strip()
    if not base:
        return base

    scope_parts: List[str] = []
    if product_id is not None:
        try:
            pid = int(product_id)
            if pid > 0:
                scope_parts.append(f"p{pid}")
        except Exception:
            pass

    asset = _sanitize_scope_value(image_asset_key)
    if asset:
        scope_parts.append(f"a{asset}")

    if not scope_parts:
        return base
    return f"{'_'.join(scope_parts)}_{base}"


def _base_doc_id(image_key: str) -> str:
    return f"art_image_base_{image_key}"


def _marketing_doc_id(image_key: str) -> str:
    return f"art_image_marketing_{image_key}"


def _build_rag_query(art_type: str, style_hint: Optional[str]) -> str:
    chunks = ["umění", "obraz", "socha", "výtvarné dílo", art_type]
    if style_hint:
        chunks.append(style_hint)
    return " ".join([c for c in chunks if c]).strip()


def _build_rag_context(rag_matches: List[Dict[str, Any]]) -> str:
    if not rag_matches:
        return ""

    lines = []
    for item in rag_matches[:5]:
        metadata = item.get("metadata") if isinstance(item.get("metadata"), dict) else {}
        hint = _build_rag_hint_summary(metadata)
        if hint:
            lines.append(f"- {hint}")
    return "\n".join(lines)


def _with_default_lyric_style(rag_context: str) -> str:
    clean = str(rag_context or "").strip()
    lyric_line = f"- {DEFAULT_LYRIC_STYLE_RULE}"
    if not clean:
        return lyric_line
    return f"{clean}\n{lyric_line}"


def _merge_rag_matches(primary: List[Dict[str, Any]], secondary: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    merged: List[Dict[str, Any]] = []
    seen = set()

    for item in (primary or []) + (secondary or []):
        key = str(item.get("id") or "").strip()
        if not key or key in seen:
            continue
        seen.add(key)
        merged.append(item)
    return merged


def _is_too_generic_art_description(description: str, tags: List[str]) -> bool:
    clean = str(description or "").strip()
    if len(clean) < VISION_GENERIC_MIN_CHARS:
        return True
    if len(tags or []) < VISION_GENERIC_MIN_TAGS:
        return True

    text = clean.lower()
    hint_hits = 0
    for hint in VISION_GENERIC_HINTS:
        if hint in text:
            hint_hits += 1
    return hint_hits < 2


def _prepare_image_for_vision(image_bytes: bytes, mime_type: str) -> tuple[bytes, str]:
    if not image_bytes:
        return image_bytes, mime_type

    try:
        try:
            import pillow_heif

            pillow_heif.register_heif_opener()
        except Exception:
            pass

        with Image.open(io.BytesIO(image_bytes)) as image:
            image = ImageOps.exif_transpose(image)
            if image.mode not in ("RGB", "RGBA"):
                image = image.convert("RGB")
            elif image.mode == "RGBA":
                rgb = Image.new("RGB", image.size, (255, 255, 255))
                rgb.paste(image, mask=image.split()[-1])
                image = rgb

            image.thumbnail((VISION_PREPROCESS_MAX_SIDE, VISION_PREPROCESS_MAX_SIDE), Image.Resampling.LANCZOS)

            output = io.BytesIO()
            image.save(
                output,
                format="WEBP",
                quality=VISION_PREPROCESS_WEBP_QUALITY,
                method=6,
            )
            return output.getvalue(), "image/webp"
    except Exception:
        return image_bytes, mime_type


def _resolve_upload_root() -> Path:
    candidates = []
    env_dir = os.getenv("UPLOAD_DIR")
    if env_dir:
        candidates.append(Path(env_dir))
    candidates.append(Path("/app/uploads"))
    candidates.append(Path("/var/www/kunst/uploads"))
    candidates.append(Path(os.getcwd()) / "uploads")

    for path in candidates:
        try:
            path.mkdir(parents=True, exist_ok=True)
            return path
        except Exception:
            continue
    return Path("./uploads")


async def load_image_from_reference(image_ref: str) -> tuple[bytes, str]:
    ref = str(image_ref or "").strip()
    if not ref:
        raise ValueError("image reference is empty")

    if ref.startswith("/uploads/"):
        upload_root = _resolve_upload_root().resolve()
        relative = ref[len("/uploads/") :].lstrip("/\\")
        local_path = (upload_root / relative).resolve()
        if upload_root not in local_path.parents and local_path != upload_root:
            raise ValueError("Invalid image path")
        if not local_path.exists() or not local_path.is_file():
            raise ValueError("Referenced image file not found")
        data = local_path.read_bytes()
        if not data:
            raise ValueError("Referenced image file is empty")
        ext = local_path.suffix.lower()
        mime = {
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".webp": "image/webp",
            ".gif": "image/gif",
            ".avif": "image/avif",
        }.get(ext, "image/webp")
        return data, mime

    if ref.startswith("http://") or ref.startswith("https://"):
        async with httpx.AsyncClient(timeout=45.0) as client:
            response = await client.get(ref)
        if response.status_code != 200:
            raise ValueError(f"Image fetch failed with status {response.status_code}")
        content_type = str(response.headers.get("content-type") or "").split(";")[0].strip().lower()
        if not content_type.startswith("image/"):
            raise ValueError("Referenced URL is not an image")
        data = response.content
        if not data:
            raise ValueError("Referenced image is empty")
        return data, content_type

    raise ValueError("Unsupported image reference format")


async def describe_art_image(
    image_bytes: bytes,
    mime_type: str,
    art_type: str = "auto",
    style_hint: Optional[str] = None,
    save_to_rag: bool = True,
    product_id: Optional[int] = None,
    image_asset_key: Optional[str] = None,
) -> Dict[str, Any]:
    vision_image_bytes, vision_mime_type = _prepare_image_for_vision(image_bytes=image_bytes, mime_type=mime_type)
    raw_image_key = _build_image_key(image_bytes=image_bytes, mime_type=mime_type)
    image_key = _build_scoped_image_key(
        image_key=raw_image_key,
        product_id=product_id,
        image_asset_key=image_asset_key,
    )

    logger.info(
        "vision_analysis_start image_key=%s product_id=%s image_asset_key=%s",
        image_key,
        product_id,
        _sanitize_scope_value(image_asset_key),
    )

    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured")

    normalized_art_type = _normalize_art_type(art_type, fallback="other")
    rag_query = _build_rag_query(normalized_art_type, style_hint)
    rag_where = {"art_type": normalized_art_type} if normalized_art_type in {"painting", "sculpture"} else None
    rag_matches = search(rag_query, n_results=5, where=rag_where)
    if normalized_art_type in {"painting", "sculpture"}:
        common_matches = search("obecná pravidla popisu uměleckého díla", n_results=3, where={"art_type": "other"})
        rag_matches = _merge_rag_matches(rag_matches, common_matches)
    rag_context = _with_default_lyric_style(_build_rag_context(rag_matches))
    logger.info(
        "rag_keywords_loaded image_key=%s matches=%s",
        image_key,
        len(rag_matches),
    )

    system_prompt = (
        "Jsi kurátor galerie. Vytváříš přesný název a originální popis výtvarného díla. "
        "Vrátíš pouze validní JSON objekt bez dalších komentářů."
    )

    user_prompt = (
        "Analyzuj obrázek díla (obraz nebo socha) a vrať JSON s klíči: "
        "title (string), description (string), tags (array string), art_type (painting|sculpture|other).\n"
        "Požadavky:\n"
        "- description v češtině, věcný, bez marketingových frází.\n"
        "- description musí být obsáhlejší: minimálně o 300 znaků delší než běžný krátký popis (cílově 900+ znaků).\n"
        "- popiš motiv, techniku/vizuální charakter a kompozici.\n"
        "- napiš zcela nový originální popis na základě aktuálního obrázku.\n"
        "- nepřebírej ani nekopíruj text z jiných děl.\n"
        "- title max 8 slov.\n"
        "- tags 4 až 10 položek.\n"
        f"Hint art_type: {normalized_art_type}.\n"
        f"Hint stylu: {style_hint or 'neuvedeno'}.\n"
        f"Inspirační metadata (nepoužívej je jako hotový text):\n{rag_context or '- žádná'}"
    )
    vision_data_url = _to_data_url(vision_image_bytes, vision_mime_type)

    async def _request_openai_description(image_detail: str, *, strict_uniqueness: bool = False) -> Dict[str, Any]:
        uniqueness_addon = ""
        if strict_uniqueness:
            uniqueness_addon = (
                "\nDodatečné pravidlo: popis musí být stylisticky odlišný od běžných galerijních textů "
                "a nesmí opakovat existující formulace."
            )
        payload = {
            "model": os.getenv("OPENAI_VISION_MODEL", DEFAULT_OPENAI_MODEL),
            "temperature": 0.35 if strict_uniqueness else 0.2,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": f"{user_prompt}{uniqueness_addon}"},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": vision_data_url,
                                "detail": image_detail,
                            },
                        },
                    ],
                },
            ],
        }

        response = await post_json_with_retry(
            url=OPENAI_API_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            payload=payload,
            timeout=45.0,
            attempts=2,
        )
        if response.status_code != 200:
            raise RuntimeError(f"OpenAI API error: {response.status_code} - {response.text}")

        data = response.json()
        content = (
            data.get("choices", [{}])[0]
            .get("message", {})
            .get("content", "")
        )
        return _safe_json_loads(content)

    def _extract_describe_fields(parsed: Dict[str, Any]) -> tuple[str, str, List[str], str]:
        title_value = str(parsed.get("title") or "").strip() or "Bez názvu díla"
        desc_value = str(parsed.get("description") or "").strip()
        tags_value = _normalize_tags(parsed.get("tags"))
        art_type_value = _normalize_art_type(parsed.get("art_type"), fallback=normalized_art_type)
        return title_value, desc_value, tags_value, art_type_value

    low_parsed = await _request_openai_description("low")
    title, description, tags, detected_art_type = _extract_describe_fields(low_parsed)
    vision_detail_used = "low"
    if _is_too_generic_art_description(description, tags):
        try:
            high_parsed = await _request_openai_description("high")
            high_title, high_description, high_tags, high_art_type = _extract_describe_fields(high_parsed)
            if str(high_description or "").strip():
                title = high_title
                description = high_description
                tags = high_tags
                detected_art_type = high_art_type
                vision_detail_used = "high"
        except Exception:
            vision_detail_used = "low"

    if not description:
        description = "Popis nebyl vygenerován."

    similarity_ratio, similar_product_id = _find_best_description_similarity(description, product_id=product_id)
    if similarity_ratio > DESCRIPTION_DUPLICATE_THRESHOLD:
        logger.warning(
            "duplicate_detected_regenerate image_key=%s similarity=%.3f similar_product_id=%s",
            image_key,
            similarity_ratio,
            similar_product_id,
        )
        try:
            strict_parsed = await _request_openai_description("high", strict_uniqueness=True)
            strict_title, strict_description, strict_tags, strict_art_type = _extract_describe_fields(strict_parsed)
            if str(strict_description or "").strip():
                title = strict_title
                description = strict_description
                tags = strict_tags
                detected_art_type = strict_art_type
                vision_detail_used = "high"
        except Exception:
            pass

    if save_to_rag:
        doc_text = _build_rag_embedding_text(
            title=title,
            art_type=detected_art_type,
            tags=tags,
            style_hint=style_hint,
        )
        metadata = {
            "source": "ai_generated",
            "art_type": detected_art_type,
            "title": title,
            "tags": ",".join(tags),
            "style": str(style_hint or "").strip(),
            "product_id": str(product_id or ""),
            "image_asset_key": _sanitize_scope_value(image_asset_key),
            "vision_detail_used": vision_detail_used,
        }
        add_document(text=doc_text, metadata=metadata)

    _cache_recent_base_description(
        image_key=image_key,
        title=title,
        description=description,
        tags=tags,
        art_type=detected_art_type,
    )

    logger.info(
        "description_generated image_key=%s vision_detail=%s chars=%s",
        image_key,
        vision_detail_used,
        len(description),
    )

    return {
        "title": title,
        "description": description,
        "tags": tags,
        "art_type": detected_art_type,
        "rag_matches": rag_matches,
        "image_key": image_key,
        "provider_used": "openai_vision",
        "from_cache": False,
    }


def _build_rewrite_prompt(
    mode: str,
    base_description: str,
    rag_context: str,
    max_chars: int = 420,
    style_hint: Optional[str] = None,
) -> str:
    if mode == "shorten":
        mode_instruction = (
            f"Zkrať text na maximum {max_chars} znaků. Zachovej faktickou přesnost, hlavní motiv, kompozici a vizuální charakter."
        )
    elif mode == "marketing":
        mode_instruction = (
            "Vytvoř marketingovější a lyricky laděný popis, ale bez nepravdivých tvrzení. "
            "Zachovej konkrétní vizuální informace o díle."
        )
    elif mode == "lyric":
        mode_instruction = (
            "Vytvoř více lyrický popis díla s bohatším jazykem a obrazností, "
            "ale zachovej původní fakta a vizuální přesnost."
        )
    else:
        mode_instruction = (
            "Vytvoř novou variantu popisu stejného díla. Musí být obsahově věrná původnímu textu, ale stylisticky odlišná."
        )

    return (
        "Uprav následující český popis výtvarného díla.\n"
        "Vrať pouze JSON objekt: {\"description\":\"...\"}.\n"
        "Neuváděj nic mimo JSON.\n"
        f"Režim: {mode}\n"
        f"Instrukce: {mode_instruction}\n"
        f"Stylový hint: {style_hint or 'neuvedeno'}\n"
        f"Inspirační metadata (pokud jsou):\n{rag_context or '- žádná'}\n\n"
        f"PŮVODNÍ TEXT:\n{base_description}"
    )


async def _rewrite_with_deepseek(
    mode: str,
    base_description: str,
    rag_context: str,
    max_chars: int = 420,
    style_hint: Optional[str] = None,
) -> str:
    api_key = os.getenv("DEEPSEEK_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("DEEPSEEK_API_KEY is not configured")

    prompt = _build_rewrite_prompt(
        mode=mode,
        base_description=base_description,
        rag_context=rag_context,
        max_chars=max_chars,
        style_hint=style_hint,
    )

    payload = {
        "model": os.getenv("DEEPSEEK_ART_MODEL", DEEPSEEK_MODEL),
        "temperature": 0.35 if mode == "regenerate" else 0.2,
        "messages": [
            {
                "role": "system",
                "content": "Jsi kurátor galerie. Zachováváš faktickou přesnost a píšeš česky.",
            },
            {"role": "user", "content": prompt},
        ],
    }

    response = await post_json_with_retry(
        url=DEEPSEEK_API_URL,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        payload=payload,
        timeout=90.0,
    )

    if response.status_code != 200:
        raise RuntimeError(f"DeepSeek API error: {response.status_code} - {response.text}")

    data = response.json()
    content = (
        data.get("choices", [{}])[0]
        .get("message", {})
        .get("content", "")
    )
    parsed = _safe_json_loads(content)
    description = str(parsed.get("description") or "").strip()
    if not description:
        description = str(content or "").strip()
    if not description:
        raise RuntimeError("DeepSeek returned empty rewritten description")
    return description


async def rewrite_art_description(
    image_key: str,
    mode: str,
    style_hint: Optional[str] = None,
    max_chars: int = 420,
    save_to_rag: bool = True,
) -> Dict[str, Any]:
    clean_image_key = str(image_key or "").strip()
    if not clean_image_key:
        raise ValueError("image_key is required")

    normalized_mode = _normalize_rewrite_mode(mode)
    base = _get_recent_base_description(clean_image_key) or {}
    base_description = str(base.get("description") or "").strip()
    if not base_description:
        raise ValueError("Base description for image_key was not found. Generate initial description first.")

    art_type = _normalize_art_type(base.get("art_type"), fallback="other")

    rag_query = _build_rag_query(art_type, style_hint)
    rag_where = {"art_type": art_type} if art_type in {"painting", "sculpture"} else None
    rag_matches = search(rag_query, n_results=5, where=rag_where)
    if art_type in {"painting", "sculpture"}:
        common_matches = search("obecná pravidla popisu uměleckého díla", n_results=3, where={"art_type": "other"})
        rag_matches = _merge_rag_matches(rag_matches, common_matches)
    rag_context = _with_default_lyric_style(_build_rag_context(rag_matches))

    rewritten = await _rewrite_with_deepseek(
        mode=normalized_mode,
        base_description=base_description,
        rag_context=rag_context,
        max_chars=max_chars,
        style_hint=style_hint,
    )

    if normalized_mode == "marketing" and save_to_rag:
        add_document(
            text=_build_rag_embedding_text(
                title=str(base.get("title") or "Bez názvu díla"),
                art_type=art_type,
                tags=list(base.get("tags") or []),
                style_hint=style_hint,
            ),
            metadata={
                "source": "ai_generated_variant",
                "doc_kind": "image_marketing",
                "image_key": clean_image_key,
                "art_type": art_type,
                "title": str(base.get("title") or "Bez názvu díla"),
                "tags": ",".join(_normalize_tags(list(base.get("tags") or []))),
            },
        )

    return {
        "image_key": clean_image_key,
        "mode": normalized_mode,
        "description": rewritten,
        "provider_used": "deepseek",
        "from_cache": False,
    }


def ingest_rag_entry(
    title: str,
    description: str,
    tags: Optional[List[str]] = None,
    art_type: Optional[str] = None,
    source: str = "manual",
) -> str:
    clean_title = (title or "").strip()
    clean_desc = (description or "").strip()
    if not clean_title:
        raise ValueError("title is required")
    if not clean_desc:
        raise ValueError("description is required")

    norm_tags = _normalize_tags(tags or [])
    norm_art_type = _normalize_art_type(art_type, fallback="other")

    text = _build_rag_embedding_text(
        title=clean_title,
        art_type=norm_art_type,
        tags=norm_tags,
    )
    metadata = {
        "source": (source or "manual").strip() or "manual",
        "art_type": norm_art_type,
        "title": clean_title,
        "tags": ",".join(norm_tags),
        "description_hash": hashlib.sha256(clean_desc.encode("utf-8")).hexdigest(),
    }
    return add_document(text=text, metadata=metadata)


def search_rag_entries(query: str, n_results: int = 5, art_type: Optional[str] = None) -> List[Dict[str, Any]]:
    norm_art_type = _normalize_art_type(art_type, fallback="other") if art_type else None
    where = {"art_type": norm_art_type} if norm_art_type in {"painting", "sculpture", "other"} else None
    return search(query=query, n_results=n_results, where=where)


def seed_placeholder_rules() -> Dict[str, Any]:
    placeholders = [
        {
            "id": "rule_painting_structure",
            "text": (
                "Obraz popisuj v tomto sledu: hlavní motiv, barevnost a světlo, kompozice/prostor, "
                "technika a výraz malby."
            ),
            "metadata": {"source": "seed_rule", "art_type": "painting", "tags": "pravidla,struktura", "doc_kind": "rule"},
        },
        {
            "id": "rule_painting_detail",
            "text": (
                "U obrazu uváděj konkrétní vizuální prvky: tah štětce, kontrast, rytmus tvarů, "
                "směr pohledu diváka a celkové emocionální vyznění."
            ),
            "metadata": {"source": "seed_rule", "art_type": "painting", "tags": "pravidla,detaily", "doc_kind": "rule"},
        },
        {
            "id": "rule_sculpture_structure",
            "text": (
                "Sochu popisuj v tomto sledu: materiál a povrch, objem/proporce, gesto těla nebo formy, "
                "vztah k prostoru a působení při pohledu z různých úhlů."
            ),
            "metadata": {"source": "seed_rule", "art_type": "sculpture", "tags": "pravidla,struktura", "doc_kind": "rule"},
        },
        {
            "id": "rule_sculpture_detail",
            "text": (
                "U sochy zdůrazni plasticitu, práci se světlem na povrchu, texturu materiálu "
                "a napětí mezi stabilitou a pohybem."
            ),
            "metadata": {"source": "seed_rule", "art_type": "sculpture", "tags": "pravidla,detaily", "doc_kind": "rule"},
        },
        {
            "id": "rule_general_style",
            "text": (
                "Popis musí být věcný, bez spekulací a bez marketingových superlativů. "
                "Piš konkrétně, krátkými větami a používej terminologii výtvarného umění."
            ),
            "metadata": {"source": "seed_rule", "art_type": "other", "tags": "pravidla,styl", "doc_kind": "rule"},
        },
        {
            "id": "rule_general_output",
            "text": (
                "Název díla má být stručný (max 8 slov). Popis má mít přirozeně 4-7 vět. "
                "Tagy mají pokrýt motiv, techniku, styl a náladu."
            ),
            "metadata": {"source": "seed_rule", "art_type": "other", "tags": "pravidla,vystup", "doc_kind": "rule"},
        },
        {
            "id": "sample_painting_reference",
            "text": (
                "Vzor obrazu: Na plátně dominuje centrální figura v šedomodré paletě. "
                "Šikmá kompozice vede pohled od popředí k tlumenému horizontu. "
                "Pastózní vrstvení barvy zvýrazňuje napětí mezi světlem a stínem."
            ),
            "metadata": {"source": "seed_example", "art_type": "painting", "tags": "vzor,obraz", "doc_kind": "example"},
        },
        {
            "id": "sample_sculpture_reference",
            "text": (
                "Vzor sochy: Bronzová figura má protáhlé proporce a zdrsněný povrch. "
                "Svislá osa těla působí stabilně, zatímco natočení hlavy vytváří pohyb. "
                "Odlesky na hranách zvýrazňují objem a dramatickou siluetu."
            ),
            "metadata": {"source": "seed_example", "art_type": "sculpture", "tags": "vzor,socha", "doc_kind": "example"},
        },
        {
            "id": "rule_lyric_style_reference",
            "text": (
                "Popis díla piš v kultivovaném, mírně lyrickém tónu. "
                "Zachovej konkrétní vizuální fakta a kunsthistorickou přesnost, "
                "ale pracuj s rytmem věty, atmosférou a obrazností bez přehnaných superlativů."
            ),
            "metadata": {"source": "seed_rule", "art_type": "other", "tags": "pravidla,lyrika,styl", "doc_kind": "rule"},
        },
    ]

    for rule in placeholders:
        add_document(text=rule["text"], metadata=rule["metadata"], doc_id=rule["id"])

    return {"ok": True, "seeded": len(placeholders)}
