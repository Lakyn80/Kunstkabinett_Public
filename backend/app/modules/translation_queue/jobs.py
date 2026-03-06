from __future__ import annotations

import asyncio
import logging
import os

from app.db import models
from app.db.session import SessionLocal
from app.modules.translation_queue.queue import enqueue_translation_jobs
from app.services.translation_helper import (
    build_product_source_hash,
    build_product_source_payload,
    get_product_source_specs,
    seed_product_translations,
)
from app.services.translation_service import (
    TranslationRetryableError,
    TranslationTerminalError,
    translation_service,
)
from rq import get_current_job

logger = logging.getLogger(__name__)


def _translate_text_strict(text: str, lang: str) -> str:
    return asyncio.run(translation_service.translate_text_for_queue(text=text, target_lang=lang, source_lang="cs"))


def translate_product_language_job(product_id: int, lang: str, source_hash: str):
    db = SessionLocal()
    try:
        current_job = get_current_job()
        retries_left = getattr(current_job, "retries_left", None) if current_job else None
        logger.info(
            "translation.job.started product_id=%s lang=%s job_id=%s retries_left=%s",
            product_id,
            lang,
            getattr(current_job, "id", None),
            retries_left,
        )

        if lang not in translation_service.TARGET_LANGUAGES:
            raise TranslationTerminalError(f"Unsupported language: {lang}")

        product = db.get(models.Product, int(product_id))
        if not product:
            logger.warning("translation.job.missing_product product=%s lang=%s", product_id, lang)
            return {"status": "missing_product"}

        specs = get_product_source_specs(product.id)
        payload = build_product_source_payload(
            title=product.title,
            description=product.description,
            technique=specs.get("technique"),
            materials=specs.get("materials"),
        )
        current_hash = build_product_source_hash(payload)
        if current_hash != source_hash:
            logger.info(
                "translation.job.stale product_id=%s lang=%s expected_hash=%s current_hash=%s",
                product_id,
                lang,
                source_hash,
                current_hash,
            )
            return {"status": "stale"}

        source_title = payload.get("title") or ""
        source_description = payload.get("description") or ""
        translated_title = _translate_text_strict(source_title, lang) if source_title else source_title
        translated_description = _translate_text_strict(source_description, lang) if source_description else None

        row = (
            db.query(models.ProductTranslation)
            .filter(
                models.ProductTranslation.product_id == product.id,
                models.ProductTranslation.language_code == lang,
            )
            .first()
        )
        if row:
            row.title = translated_title
            row.description = translated_description
        else:
            db.add(
                models.ProductTranslation(
                    product_id=product.id,
                    language_code=lang,
                    title=translated_title,
                    description=translated_description,
                )
            )

        db.commit()
        logger.info("translation.job.done product_id=%s lang=%s", product_id, lang)
        return {"status": "done"}

    except TranslationRetryableError as exc:
        db.rollback()
        current_job = get_current_job()
        retries_left = getattr(current_job, "retries_left", None) if current_job else None
        logger.warning(
            "translation.job.retry product_id=%s lang=%s job_id=%s retries_left=%s error=%s",
            product_id,
            lang,
            getattr(current_job, "id", None),
            retries_left,
            exc,
        )
        try:
            if retries_left is not None and int(retries_left) <= 0:
                logger.error(
                    "translation.job.failed product_id=%s lang=%s terminal=false reason=retry_exhausted error=%s",
                    product_id,
                    lang,
                    exc,
                )
        except Exception:
            pass
        raise
    except TranslationTerminalError as exc:
        db.rollback()
        logger.error("translation.job.failed product_id=%s lang=%s terminal=true error=%s", product_id, lang, exc)
        return {"status": "terminal_fail", "error": str(exc)}
    except Exception as exc:
        db.rollback()
        logger.error("translation.job.failed product_id=%s lang=%s terminal=false error=%s", product_id, lang, exc)
        raise
    finally:
        db.close()


def repair_missing_translations_job(offset: int = 0, batch_size: int | None = None):
    db = SessionLocal()
    try:
        target_languages = list(translation_service.TARGET_LANGUAGES)
        target_count = len(target_languages)
        batch = int(batch_size or int(os.getenv("TRANSLATE_REPAIR_BATCH_SIZE", "500") or "500"))
        if batch <= 0:
            batch = 500

        products = (
            db.query(models.Product)
            .order_by(models.Product.id.asc())
            .offset(int(offset))
            .limit(batch)
            .all()
        )

        repaired = 0
        enqueued = 0
        for product in products:
            rows = (
                db.query(models.ProductTranslation.language_code)
                .filter(models.ProductTranslation.product_id == product.id)
                .all()
            )
            existing_languages = {str(r[0]).strip() for r in rows if r and r[0]}
            if len(existing_languages) >= target_count:
                continue

            missing_languages = [lang for lang in target_languages if lang not in existing_languages]
            if not missing_languages:
                continue

            seed_product_translations(db, product)
            db.commit()

            specs = get_product_source_specs(product.id)
            stats = enqueue_translation_jobs(
                product_id=product.id,
                title=product.title,
                description=product.description,
                technique=specs.get("technique"),
                materials=specs.get("materials"),
                languages=missing_languages,
            )
            repaired += 1
            enqueued += int(stats.get("enqueued") or 0)

        has_more = len(products) >= batch
        logger.info(
            "translation.repair.batch offset=%s batch_size=%s scanned=%s repaired=%s enqueued=%s has_more=%s",
            offset,
            batch,
            len(products),
            repaired,
            enqueued,
            has_more,
        )

        if has_more:
            from app.modules.translation_queue.queue import enqueue_repair_missing_translations_job

            enqueue_repair_missing_translations_job(offset=int(offset) + batch, batch_size=batch)

        return {
            "offset": int(offset),
            "batch_size": batch,
            "scanned": len(products),
            "repaired": repaired,
            "enqueued": enqueued,
            "has_more": has_more,
        }
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
