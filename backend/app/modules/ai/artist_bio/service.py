from __future__ import annotations

from typing import Any, Dict, List, Optional
from urllib.parse import quote
import json
import os
import re

import httpx

from .chroma_client import add_document, find_cached_bio_by_artist_name, search
from ..http_retry import post_json_with_retry

DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions"
DEEPSEEK_MODEL = "deepseek-chat"
OPENAI_API_URL = "https://api.openai.com/v1/chat/completions"
OPENAI_MODEL = "gpt-4o-mini"


def _normalize_name(name: str) -> str:
    return re.sub(r"\s+", " ", str(name or "").strip()).lower()


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


async def _wiki_search_title(name: str, lang: str) -> Optional[str]:
    url = f"https://{lang}.wikipedia.org/w/api.php"
    params = {
        "action": "query",
        "list": "search",
        "srsearch": name,
        "srlimit": 1,
        "utf8": 1,
        "format": "json",
    }
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.get(url, params=params)
    if response.status_code != 200:
        return None

    data = response.json()
    items = data.get("query", {}).get("search", [])
    if not items:
        return None
    return str(items[0].get("title") or "").strip() or None


async def _wiki_summary(title: str, lang: str) -> Optional[Dict[str, str]]:
    if not title:
        return None

    url = f"https://{lang}.wikipedia.org/api/rest_v1/page/summary/{quote(title)}"
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.get(url, headers={"accept": "application/json"})
    if response.status_code != 200:
        return None

    data = response.json()
    extract = str(data.get("extract") or "").strip()
    page_url = str(
        data.get("content_urls", {}).get("desktop", {}).get("page")
        or f"https://{lang}.wikipedia.org/wiki/{quote(title.replace(' ', '_'))}"
    ).strip()
    if not extract:
        return None

    return {"lang": lang, "title": title, "extract": extract, "url": page_url}


async def _collect_bio_sources(artist_name: str) -> List[Dict[str, str]]:
    sources: List[Dict[str, str]] = []
    for lang in ("cs", "en"):
        title = await _wiki_search_title(artist_name, lang)
        if not title:
            continue
        summary = await _wiki_summary(title, lang)
        if summary:
            sources.append(summary)
    return sources


def _sources_to_prompt(sources: List[Dict[str, str]]) -> str:
    chunks = []
    for idx, item in enumerate(sources, start=1):
        chunks.append(
            f"[{idx}] jazyk={item.get('lang')} titul={item.get('title')}\n"
            f"URL: {item.get('url')}\n"
            f"TEXT: {item.get('extract')}"
        )
    return "\n\n".join(chunks)


def _sources_to_urls(sources: List[Dict[str, str]]) -> List[str]:
    out: List[str] = []
    seen = set()
    for item in sources:
        url = str(item.get("url") or "").strip()
        if not url:
            continue
        if url in seen:
            continue
        seen.add(url)
        out.append(url)
    return out


def _build_rag_context(rag_matches: List[Dict[str, Any]]) -> str:
    if not rag_matches:
        return ""

    lines: List[str] = []
    for item in rag_matches[:5]:
        text = str(item.get("text") or "").strip()
        if text:
            lines.append(f"- {text}")
    return "\n".join(lines)


def _build_bio_prompt(
    artist_name: str,
    sources: List[Dict[str, str]],
    rag_context: str = "",
) -> str:
    return (
        "Napiš biografii autora výhradně v češtině.\n"
        "Dodrž přesně tuto strukturu:\n"
        "Úvodní odstavec s identifikací autora (jméno, roky, hlavní význam).\n"
        "Nadpis 'Život' a souvislý text o vzdělání, působení a vývoji.\n"
        "Nadpis 'Tvorba' a hlavní charakteristiky díla + klíčová díla.\n"
        "Nadpis 'Význam' a krátké shrnutí přínosu.\n"
        "Před jednotlivé sekce nepoužívej číslování (např. 1), 2), 3), 4)).\n"
        "Sekce 'Život' a 'Tvorba' stav výhradně na údajích ze zdrojů Wikipedia uvedených níže.\n"
        "Pokud ve zdrojích není výslovně uveden význam autora, dopočítej sekci 'Význam' z dostupného textu,\n"
        "ale tato sekce musí mít maximálně 500 znaků.\n"
        "Vrať pouze JSON objekt: {\"bio\":\"...\"}.\n"
        "Neuváděj nic mimo JSON.\n"
        "Pokud některé údaje nejsou doložitelné, neuváděj je.\n\n"
        f"Autor: {artist_name}\n\n"
        f"RAG pravidla stylu:\n{rag_context or '- žádná'}\n\n"
        f"ZDROJE:\n{_sources_to_prompt(sources) if sources else '- nejsou dostupné'}"
    )


async def _generate_bio_with_deepseek(
    artist_name: str,
    sources: List[Dict[str, str]],
    rag_context: str = "",
) -> str:
    api_key = os.getenv("DEEPSEEK_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("DEEPSEEK_API_KEY is not configured")

    prompt = _build_bio_prompt(
        artist_name=artist_name,
        sources=sources,
        rag_context=rag_context,
    )

    payload = {
        "model": DEEPSEEK_MODEL,
        "temperature": 0.2,
        "messages": [
            {
                "role": "system",
                "content": "Jsi kurátor a editor. Píšeš věcný a přesný životopisný odstavec bez spekulací.",
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
    bio = str(parsed.get("bio") or "").strip()
    if not bio:
        bio = str(content or "").strip()
    if not bio:
        raise RuntimeError("DeepSeek returned empty biography")
    return bio


async def _generate_bio_with_openai(
    artist_name: str,
    sources: List[Dict[str, str]],
    rag_context: str = "",
) -> str:
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured")

    prompt = _build_bio_prompt(
        artist_name=artist_name,
        sources=sources,
        rag_context=rag_context,
    )

    payload = {
        "model": os.getenv("OPENAI_BIO_MODEL", OPENAI_MODEL),
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
        "messages": [
            {
                "role": "system",
                "content": "Jsi kunsthistorik a editor. Vždy odpovídáš česky a věcně.",
            },
            {"role": "user", "content": prompt},
        ],
    }

    response = await post_json_with_retry(
        url=OPENAI_API_URL,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        payload=payload,
        timeout=90.0,
    )

    if response.status_code != 200:
        raise RuntimeError(f"OpenAI API error: {response.status_code} - {response.text}")

    data = response.json()
    content = (
        data.get("choices", [{}])[0]
        .get("message", {})
        .get("content", "")
    )
    parsed = _safe_json_loads(content)
    bio = str(parsed.get("bio") or "").strip()
    if not bio:
        bio = str(content or "").strip()
    if not bio:
        raise RuntimeError("OpenAI returned empty biography")
    return bio


async def generate_artist_bio(
    artist_name: str,
    force_refresh: bool = False,
    save_to_rag: bool = True,
) -> Dict[str, Any]:
    clean_name = str(artist_name or "").strip()
    if not clean_name:
        raise ValueError("artist_name is required")

    artist_name_norm = _normalize_name(clean_name)

    if not force_refresh:
        cached = find_cached_bio_by_artist_name(artist_name_norm)
        if cached and str(cached.get("text") or "").strip():
            meta = cached.get("metadata") or {}
            urls = str(meta.get("source_urls") or "").split("|")
            return {
                "artist_name": clean_name,
                "bio": str(cached.get("text") or "").strip(),
                "sources": [u for u in urls if u],
                "from_cache": True,
            }

    rag_rules = search(
        query="pravidla struktura bio umělce životopis",
        n_results=5,
        where={"doc_kind": "bio_rule"},
    )
    rag_context = _build_rag_context(rag_rules)

    sources = await _collect_bio_sources(clean_name)
    source_urls = _sources_to_urls(sources)
    source_kind = "wikipedia" if sources else "none"

    deepseek_error: Exception | None = None
    try:
        bio = await _generate_bio_with_deepseek(clean_name, sources, rag_context=rag_context)
        provider_used = "deepseek"
    except Exception as exc:
        deepseek_error = exc
        try:
            bio = await _generate_bio_with_openai(clean_name, sources, rag_context=rag_context)
            provider_used = "openai"
        except Exception as openai_exc:
            raise RuntimeError(
                f"Artist bio generation failed (Wikipedia={source_kind}, DeepSeek failed: {deepseek_error}, OpenAI failed: {openai_exc})"
            ) from openai_exc

    if save_to_rag:
        metadata = {
            "source": "ai_artist_bio",
            "artist_name": clean_name,
            "artist_name_norm": artist_name_norm,
            "source_urls": "|".join(source_urls),
            "source_kind": source_kind,
            "provider_used": provider_used,
        }
        add_document(text=bio, metadata=metadata)

    return {
        "artist_name": clean_name,
        "bio": bio,
        "sources": source_urls,
        "from_cache": False,
    }


def search_artist_bio_rag(query: str, n_results: int = 5) -> List[Dict[str, Any]]:
    return search(query=query, n_results=n_results)


def seed_placeholder_rules() -> Dict[str, Any]:
    placeholders = [
        {
            "id": "bio_rule_czech_first",
            "text": (
                "Bio autora vždy vytvoř nejdřív česky. Překlady do dalších jazyků se dělají až následně."
            ),
            "metadata": {"source": "seed_rule", "doc_kind": "bio_rule", "tags": "pravidla,cz-first"},
        },
        {
            "id": "bio_rule_structure",
            "text": (
                "Používej strukturu: úvodní odstavec, sekce Život, sekce Tvorba, sekce Význam."
            ),
            "metadata": {"source": "seed_rule", "doc_kind": "bio_rule", "tags": "pravidla,struktura"},
        },
        {
            "id": "bio_rule_facts_only",
            "text": (
                "Uváděj pouze informace doložitelné zdroji. Pokud údaj ve zdrojích není, nezahrnuj ho a nevymýšlej."
            ),
            "metadata": {"source": "seed_rule", "doc_kind": "bio_rule", "tags": "pravidla,fakta"},
        },
        {
            "id": "bio_rule_style",
            "text": (
                "Styl bio: věcný, neutrální, bez PR formulací. Piš srozumitelně a terminologicky přesně."
            ),
            "metadata": {"source": "seed_rule", "doc_kind": "bio_rule", "tags": "pravidla,styl"},
        },
        {
            "id": "bio_example_reference",
            "text": (
                "František Kupka (23. 9. 1871, Opočno – 24. 6. 1957, Puteaux, Francie) byl český malíř a grafik, "
                "průkopník abstraktního umění a jeden z prvních autorů čisté abstrakce v Evropě.\n\n"
                "Život\n\n"
                "Studoval na Akademii výtvarných umění v Praze a ve Vídni. Roku 1896 se usadil v Paříži, kde působil "
                "většinu života. Zpočátku tvořil symbolistní a secesní díla, postupně však přešel k abstrakci inspirované "
                "hudbou, pohybem, barvou a vědeckými poznatky o světle.\n\n"
                "Byl členem skupiny Section d’Or a účastnil se významných pařížských výstav avantgardy. Od roku 1931 byl "
                "členem francouzské Akademie výtvarných umění.\n\n"
                "Tvorba\n\n"
                "Kupka patří mezi zakladatele abstraktní malby. Mezi jeho klíčová díla patří:\n\n"
                "Amorpha – Dvoubarevná fuga (1912)\n\n"
                "Disks of Newton (Studie kruhů)\n\n"
                "cykly inspirované hudbou a kosmickými principy\n\n"
                "Jeho díla pracují s rytmem, barevnou harmonií a dynamikou tvarů.\n\n"
                "Význam\n\n"
                "František Kupka je považován za jednoho z nejvýznamnějších českých umělců 20. století a za světového "
                "průkopníka abstraktní malby. Jeho díla jsou dnes součástí sbírek předních světových galerií "
                "(např. Centre Pompidou v Paříži) a dosahují vysokých cen na aukcích."
            ),
            "metadata": {"source": "seed_example", "doc_kind": "bio_rule", "tags": "vzor,bio"},
        },
    ]

    for rule in placeholders:
        add_document(text=rule["text"], metadata=rule["metadata"], doc_id=rule["id"])

    return {"ok": True, "seeded": len(placeholders)}
