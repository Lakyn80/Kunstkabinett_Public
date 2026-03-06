from __future__ import annotations

import logging
import os
import time
from typing import Iterable, Optional

from redis import Redis
from rq import Queue, Retry

from app.services.translation_helper import build_product_source_hash, build_product_source_payload
from app.services.translation_service import translation_service

logger = logging.getLogger(__name__)

DEFAULT_QUEUE_NAME = "translations"
DEFAULT_MAX_RETRIES = 6
DEFAULT_BACKOFF = [5, 15, 45, 120, 300, 600]
SKIP_JOB_STATUSES = {"queued", "started", "deferred", "scheduled", "finished"}
REPAIR_JOB_ACTIVE_STATUSES = {"queued", "started", "deferred", "scheduled"}


def get_translate_queue_name() -> str:
    return (os.getenv("TRANSLATE_QUEUE_NAME") or DEFAULT_QUEUE_NAME).strip() or DEFAULT_QUEUE_NAME


def _parse_int_env(name: str, default: int) -> int:
    raw = (os.getenv(name) or "").strip()
    if not raw:
        return default
    try:
        return int(raw)
    except Exception:
        return default


def _parse_backoff_seconds() -> list[int]:
    raw = (os.getenv("TRANSLATE_BACKOFF_SECONDS") or "").strip()
    if not raw:
        return list(DEFAULT_BACKOFF)
    values: list[int] = []
    for part in raw.split(","):
        try:
            val = int(part.strip())
        except Exception:
            continue
        if val > 0:
            values.append(val)
    return values or list(DEFAULT_BACKOFF)


def _normalize_status(status: Optional[object]) -> str:
    if status is None:
        return ""
    if hasattr(status, "value"):
        try:
            return str(status.value).strip().lower()
        except Exception:
            pass
    return str(status).strip().lower()


def get_redis_connection() -> Redis:
    redis_url = (os.getenv("REDIS_URL") or "redis://localhost:6379/0").strip()
    max_attempts = max(1, _parse_int_env("REDIS_CONNECT_MAX_ATTEMPTS", 30))
    delay_seconds = max(1, _parse_int_env("REDIS_CONNECT_RETRY_SECONDS", 2))
    last_exc: Exception | None = None

    for attempt in range(1, max_attempts + 1):
        try:
            conn = Redis.from_url(redis_url, socket_connect_timeout=3, socket_timeout=None)
            conn.ping()
            return conn
        except Exception as exc:
            last_exc = exc
            logger.warning("Redis connection attempt %s/%s failed: %s", attempt, max_attempts, exc)
            if attempt >= max_attempts:
                break
            time.sleep(delay_seconds)

    raise RuntimeError(f"Unable to connect to Redis after {max_attempts} attempts") from last_exc


def get_translation_queue(*, allow_unavailable: bool = False) -> Queue | None:
    try:
        return Queue(name=get_translate_queue_name(), connection=get_redis_connection())
    except Exception as exc:
        if allow_unavailable:
            logger.error("translation.enqueue.skipped reason=redis_unavailable error=%s", exc)
            return None
        raise


def _build_retry_policy() -> Retry:
    max_retries = max(1, _parse_int_env("TRANSLATE_JOB_MAX_RETRIES", DEFAULT_MAX_RETRIES))
    return Retry(max=max_retries, interval=_parse_backoff_seconds())


def build_translation_job_id(product_id: int, lang: str, source_hash: str) -> str:
    return f"tr:product:{int(product_id)}:lang:{lang}:{source_hash}"


def enqueue_translation_job(
    *,
    product_id: int,
    lang: str,
    source_hash: str,
    force_failed: bool = False,
    queue: Queue | None = None,
):
    queue = queue or get_translation_queue(allow_unavailable=True)
    if queue is None:
        return None
    job_id = build_translation_job_id(product_id=product_id, lang=lang, source_hash=source_hash)
    existing = queue.fetch_job(job_id)
    if existing is not None:
        status = _normalize_status(existing.get_status(refresh=False))
        if status in SKIP_JOB_STATUSES:
            logger.info("translation.enqueue.skipped product_id=%s lang=%s status=%s", product_id, lang, status)
            return None
        if status == "failed" and not force_failed:
            logger.info("translation.enqueue.skipped product_id=%s lang=%s status=failed", product_id, lang)
            return None
        if status == "failed" and force_failed:
            try:
                existing.delete()
            except Exception:
                pass

    job = queue.enqueue(
        "app.modules.translation_queue.jobs.translate_product_language_job",
        product_id=product_id,
        lang=lang,
        source_hash=source_hash,
        job_id=job_id,
        retry=_build_retry_policy(),
    )
    logger.info("translation.enqueue.created product_id=%s lang=%s job_id=%s", product_id, lang, job_id)
    return job


def enqueue_translation_jobs(
    *,
    product_id: int,
    title: str,
    description: Optional[str] = None,
    technique: Optional[str] = None,
    materials: Optional[str] = None,
    languages: Optional[Iterable[str]] = None,
    force_failed: bool = False,
) -> dict:
    payload = build_product_source_payload(
        title=title,
        description=description,
        technique=technique,
        materials=materials,
    )
    source_hash = build_product_source_hash(payload)
    target_languages = list(languages or translation_service.TARGET_LANGUAGES)
    queue = get_translation_queue(allow_unavailable=True)
    if queue is None:
        return {
            "source_hash": source_hash,
            "enqueued": 0,
            "skipped": len(target_languages),
        }

    enqueued = 0
    skipped = 0
    for lang in target_languages:
        job = enqueue_translation_job(
            product_id=product_id,
            lang=lang,
            source_hash=source_hash,
            force_failed=force_failed,
            queue=queue,
        )
        if job is None:
            skipped += 1
        else:
            enqueued += 1

    return {
        "source_hash": source_hash,
        "enqueued": enqueued,
        "skipped": skipped,
    }


def enqueue_repair_missing_translations_job(*, offset: int = 0, batch_size: int | None = None) -> bool:
    queue = get_translation_queue(allow_unavailable=True)
    if queue is None:
        return False

    job_id = f"tr:repair:missing-translations:{int(offset)}"
    existing = queue.fetch_job(job_id)
    if existing is not None:
        status = _normalize_status(existing.get_status(refresh=False))
        if status in REPAIR_JOB_ACTIVE_STATUSES:
            logger.info("translation.enqueue.skipped job=repair_missing_translations status=%s offset=%s", status, offset)
            return False
        if status == "finished":
            try:
                existing.delete()
            except Exception:
                pass

    queue.enqueue(
        "app.modules.translation_queue.jobs.repair_missing_translations_job",
        offset=int(offset),
        batch_size=(int(batch_size) if batch_size is not None else None),
        job_id=job_id,
    )
    logger.info("translation.enqueue.created job=repair_missing_translations job_id=%s offset=%s", job_id, offset)
    return True
