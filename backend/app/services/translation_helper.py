"""
Helper functions for automatic translation and saving to database.
"""

from typing import Optional
import os
import json
import hashlib
from sqlalchemy.orm import Session
from app.db import models
from app.services.translation_service import translation_service
from app.services.text_utils import to_plain_text
import logging

logger = logging.getLogger(__name__)


def _specs_translation_store_path() -> str:
    candidates = []
    env_dir = os.getenv("UPLOAD_DIR")
    if env_dir:
        candidates.append(env_dir)
    candidates.append("/app/uploads")
    candidates.append(os.path.join(os.getcwd(), "uploads"))
    for base in candidates:
        try:
            os.makedirs(base, exist_ok=True)
            return os.path.join(base, "product_specs_translations.json")
        except Exception:
            continue
    return os.path.join(os.getcwd(), "product_specs_translations.json")


def _load_specs_translation_store() -> dict:
    path = _specs_translation_store_path()
    if not os.path.exists(path):
        return {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict):
            return data
    except Exception:
        pass
    return {}


def _save_specs_translation_store(store: dict) -> None:
    path = _specs_translation_store_path()
    with open(path, "w", encoding="utf-8") as f:
        json.dump(store, f, ensure_ascii=False, indent=2)


def _normalize_optional_text(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    text_value = to_plain_text(value)
    text_value = (text_value or "").strip()
    return text_value or None


def _product_specs_source_store_path() -> str:
    candidates = []
    env_dir = os.getenv("UPLOAD_DIR")
    if env_dir:
        candidates.append(env_dir)
    candidates.append("/app/uploads")
    candidates.append(os.path.join(os.getcwd(), "uploads"))
    for base in candidates:
        try:
            os.makedirs(base, exist_ok=True)
            return os.path.join(base, "product_specs.json")
        except Exception:
            continue
    return os.path.join(os.getcwd(), "product_specs.json")


def _load_product_specs_source_store() -> dict:
    path = _product_specs_source_store_path()
    if not os.path.exists(path):
        return {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict):
            return data
    except Exception:
        pass
    return {}


def get_product_source_specs(product_id: int) -> dict:
    store = _load_product_specs_source_store()
    row = store.get(str(product_id), {})
    if not isinstance(row, dict):
        row = {}
    return {
        "technique": _normalize_optional_text(row.get("technique")),
        "materials": _normalize_optional_text(row.get("materials")),
    }


def build_product_source_payload(
    title: Optional[str],
    description: Optional[str] = None,
    technique: Optional[str] = None,
    materials: Optional[str] = None,
) -> dict:
    return {
        "title": _normalize_optional_text(title) or "",
        "description": _normalize_optional_text(description) or "",
        "technique": _normalize_optional_text(technique) or "",
        "materials": _normalize_optional_text(materials) or "",
    }


def build_product_source_hash(payload: dict) -> str:
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def seed_product_translations(db: Session, product: models.Product) -> dict:
    base_title = _normalize_optional_text(getattr(product, "title", None)) or ""
    base_description = _normalize_optional_text(getattr(product, "description", None))
    created = 0
    updated = 0

    for lang_code in translation_service.TARGET_LANGUAGES:
        existing = (
            db.query(models.ProductTranslation)
            .filter(
                models.ProductTranslation.product_id == product.id,
                models.ProductTranslation.language_code == lang_code,
            )
            .first()
        )

        if not existing:
            db.add(
                models.ProductTranslation(
                    product_id=product.id,
                    language_code=lang_code,
                    title=base_title,
                    description=base_description,
                )
            )
            created += 1
            continue

        changed = False
        if not _normalize_optional_text(existing.title):
            existing.title = base_title
            changed = True
        if not _normalize_optional_text(existing.description) and base_description:
            existing.description = base_description
            changed = True
        if changed:
            updated += 1

    logger.info(
        "translation.seed.done product_id=%s created=%s updated=%s",
        getattr(product, "id", None),
        created,
        updated,
    )
    return {"created": created, "updated": updated}


def save_product_specs_translations(
    product_id: int,
    technique_translations: Optional[dict] = None,
    materials_translations: Optional[dict] = None,
) -> None:
    store = _load_specs_translation_store()
    key = str(product_id)
    row = store.get(key, {})
    if not isinstance(row, dict):
        row = {}

    normalized_technique = {}
    if isinstance(technique_translations, dict):
        for lang_code in translation_service.TARGET_LANGUAGES:
            val = _normalize_optional_text(technique_translations.get(lang_code))
            if val:
                normalized_technique[lang_code] = val

    normalized_materials = {}
    if isinstance(materials_translations, dict):
        for lang_code in translation_service.TARGET_LANGUAGES:
            val = _normalize_optional_text(materials_translations.get(lang_code))
            if val:
                normalized_materials[lang_code] = val

    if normalized_technique:
        row["technique"] = normalized_technique
    else:
        row.pop("technique", None)

    if normalized_materials:
        row["materials"] = normalized_materials
    else:
        row.pop("materials", None)

    if row:
        store[key] = row
    else:
        store.pop(key, None)

    _save_specs_translation_store(store)


def get_product_specs_translation(product_id: int, lang_code: str) -> dict:
    store = _load_specs_translation_store()
    row = store.get(str(product_id), {})
    if not isinstance(row, dict):
        row = {}
    technique_map = row.get("technique", {})
    materials_map = row.get("materials", {})
    if not isinstance(technique_map, dict):
        technique_map = {}
    if not isinstance(materials_map, dict):
        materials_map = {}
    return {
        "technique": _normalize_optional_text(technique_map.get(lang_code)),
        "materials": _normalize_optional_text(materials_map.get(lang_code)),
    }


def clear_product_specs_translations(product_id: int) -> None:
    store = _load_specs_translation_store()
    key = str(product_id)
    if key in store:
        store.pop(key, None)
        _save_specs_translation_store(store)


async def auto_translate_category(db: Session, category_id: int, name: str) -> None:
    """
    Automatically translate category name to all languages and save to database.
    
    Args:
        db: Database session
        category_id: Category ID
        name: Category name in Czech
    """
    try:
        base_name = to_plain_text(name) if name is not None else ""
        base_name = (base_name or "").strip()
        if not base_name:
            return

        translations = await translation_service.translate_to_all_languages(base_name, source_lang="cs")
        translations = {k: to_plain_text(v) for k, v in translations.items()}

        # Do NOT delete existing translations - do not overwrite manual edits.
        # Fill missing languages and update only placeholder values (empty / same as Czech).
        updated = 0
        created = 0
        for lang_code in translation_service.TARGET_LANGUAGES:
            translated_text = (translations.get(lang_code) or base_name).strip()

            existing = (
                db.query(models.CategoryTranslation)
                .filter(
                    models.CategoryTranslation.category_id == category_id,
                    models.CategoryTranslation.language_code == lang_code,
                )
                .first()
            )
            if existing:
                existing_name = to_plain_text(existing.name).strip() if existing.name else ""
                if (not existing_name) or (existing_name == base_name):
                    existing.name = translated_text
                    updated += 1
            else:
                db.add(
                    models.CategoryTranslation(
                        category_id=category_id,
                        language_code=lang_code,
                        name=translated_text,
                    )
                )
                created += 1

        db.commit()
        logger.info(
            f"Successfully translated category {category_id}: created={created}, updated={updated} (manual preserved)"
        )
        
    except Exception as e:
        logger.error(f"Error translating category {category_id}: {str(e)}")
        db.rollback()


async def auto_translate_product(
    db: Session, 
    product_id: int, 
    title: str, 
    description: Optional[str] = None,
    technique: Optional[str] = None,
    materials: Optional[str] = None,
) -> None:
    """
    Automatically translate product title and description to all languages.
    
    Args:
        db: Database session
        product_id: Product ID
        title: Product title in Czech
        description: Product description in Czech (optional)
    """
    try:
        base_title = _normalize_optional_text(title) or ""
        base_description = _normalize_optional_text(description)
        base_technique = _normalize_optional_text(technique)
        base_materials = _normalize_optional_text(materials)

        # Translate title
        title_translations = await translation_service.translate_to_all_languages(base_title, source_lang="cs")
        
        # Translate description if provided
        desc_translations = {}
        if base_description:
            desc_translations = await translation_service.translate_to_all_languages(base_description, source_lang="cs")

        # Translate technique/materials if provided
        technique_translations = {}
        if base_technique:
            technique_translations = await translation_service.translate_to_all_languages(base_technique, source_lang="cs")
        materials_translations = {}
        if base_materials:
            materials_translations = await translation_service.translate_to_all_languages(base_materials, source_lang="cs")
        
        # Delete existing translations
        db.query(models.ProductTranslation).filter(
            models.ProductTranslation.product_id == product_id
        ).delete()
        
        # Save new translations
        for lang_code in translation_service.TARGET_LANGUAGES:
            translation = models.ProductTranslation(
                product_id=product_id,
                language_code=lang_code,
                title=title_translations.get(lang_code, base_title),
                description=desc_translations.get(lang_code, base_description) if base_description else None
            )
            db.add(translation)

        save_product_specs_translations(
            product_id=product_id,
            technique_translations=technique_translations,
            materials_translations=materials_translations,
        )
        
        db.commit()
        logger.info(f"Successfully translated product {product_id} to {len(translation_service.TARGET_LANGUAGES)} languages")
        
    except Exception as e:
        logger.error(f"Error translating product {product_id}: {str(e)}")
        db.rollback()


async def auto_translate_artist(
    db: Session, 
    artist_id: int, 
    name: str, 
    bio: Optional[str] = None
) -> None:
    """
    Automatically translate artist name and bio to all languages.
    
    Args:
        db: Database session
        artist_id: Artist ID
        name: Artist name in Czech
        bio: Artist bio in Czech (optional)
    """
    try:
        base_name = to_plain_text(name) if name is not None else None
        base_bio = to_plain_text(bio) if bio is not None else None

        # Translate name
        name_translations = await translation_service.translate_to_all_languages(base_name or "", source_lang="cs")
        name_translations = {k: to_plain_text(v) for k, v in name_translations.items()}

        # Translate bio if provided
        bio_translations = {}
        if base_bio and base_bio.strip():
            bio_translations = await translation_service.translate_to_all_languages(base_bio, source_lang="cs")
            bio_translations = {k: to_plain_text(v) for k, v in bio_translations.items()}
        
        # Delete existing translations
        db.query(models.ArtistTranslation).filter(
            models.ArtistTranslation.artist_id == artist_id
        ).delete()
        
        # Save new translations
        for lang_code in translation_service.TARGET_LANGUAGES:
            translation = models.ArtistTranslation(
                artist_id=artist_id,
                language_code=lang_code,
                name=name_translations.get(lang_code, base_name),
                bio=bio_translations.get(lang_code, base_bio) if base_bio else None
            )
            db.add(translation)
        
        db.commit()
        logger.info(f"Successfully translated artist {artist_id} to {len(translation_service.TARGET_LANGUAGES)} languages")
        
    except Exception as e:
        logger.error(f"Error translating artist {artist_id}: {str(e)}")
        db.rollback()


async def auto_translate_blog_post(
    db: Session, 
    blog_post_id: int, 
    title: str, 
    content: Optional[str] = None
) -> None:
    """
    Automatically translate blog post title and content to all languages.
    
    Args:
        db: Database session
        blog_post_id: Blog post ID
        title: Post title in Czech
        content: Post content in Czech (optional)
    """
    try:
        # Translate title with quality gate
        title_translations = await translation_service.translate_to_all_languages_with_quality_gate(
            title,
            source_lang="cs",
        )
        
        # Translate content if provided
        content_translations = {}
        if content and content.strip():
            content_translations = await translation_service.translate_to_all_languages_with_quality_gate(
                content,
                source_lang="cs",
            )
        
        # Delete existing translations
        db.query(models.BlogPostTranslation).filter(
            models.BlogPostTranslation.blog_post_id == blog_post_id
        ).delete()
        
        # Save new translations
        for lang_code in translation_service.TARGET_LANGUAGES:
            translation = models.BlogPostTranslation(
                blog_post_id=blog_post_id,
                language_code=lang_code,
                title=title_translations.get(lang_code, title),
                content=content_translations.get(lang_code, content) if content else None
            )
            db.add(translation)
        
        db.commit()
        logger.info(f"Successfully translated blog post {blog_post_id} to {len(translation_service.TARGET_LANGUAGES)} languages")
        
    except Exception as e:
        logger.error(f"Error translating blog post {blog_post_id}: {str(e)}")
        db.rollback()
