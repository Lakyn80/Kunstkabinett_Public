from __future__ import annotations

import logging
import os

from rq import Queue

from app.db import models
from app.db.session import SessionLocal
from app.modules.media.repository import sync_manifest_to_product_media
from app.modules.translation_queue.queue import get_redis_connection

logger = logging.getLogger(__name__)

DEFAULT_VISION_QUEUE_NAME = "vision"
SKIP_JOB_STATUSES = {"queued", "started", "deferred", "scheduled", "finished"}


def get_vision_queue_name() -> str:
    return (os.getenv("VISION_QUEUE_NAME") or DEFAULT_VISION_QUEUE_NAME).strip() or DEFAULT_VISION_QUEUE_NAME


def _normalize_status(status: object | None) -> str:
    if status is None:
        return ""
    if hasattr(status, "value"):
        try:
            return str(status.value).strip().lower()
        except Exception:
            pass
    return str(status).strip().lower()


def enqueue_product_media_vision(product_id: int, model: str, dry_run: bool = False) -> dict[str, int | str | bool]:
    db = SessionLocal()
    try:
        sync_stats = sync_manifest_to_product_media(db, int(product_id))
        rows = (
            db.query(models.ProductMedia)
            .filter(models.ProductMedia.product_id == int(product_id))
            .order_by(models.ProductMedia.position.asc(), models.ProductMedia.id.asc())
            .all()
        )

        queue = Queue(name=get_vision_queue_name(), connection=get_redis_connection())

        enqueued = 0
        skipped = 0
        for row in rows:
            job_id = f"vision:media:{int(row.id)}:{str(model)}"
            existing = queue.fetch_job(job_id)
            if existing is not None:
                status = _normalize_status(existing.get_status(refresh=False))
                if status in SKIP_JOB_STATUSES:
                    skipped += 1
                    continue
                try:
                    existing.delete()
                except Exception:
                    pass

            queue.enqueue(
                "app.modules.vision_queue.jobs.generate_image_vision_job",
                media_id=int(row.id),
                model=str(model),
                dry_run=bool(dry_run),
                job_id=job_id,
                result_ttl=500,
                failure_ttl=86400,
            )
            enqueued += 1

        logger.info(
            "vision.enqueue.done product_id=%s model=%s dry_run=%s synced=%s enqueued=%s skipped=%s",
            product_id,
            model,
            dry_run,
            int(sync_stats.get("inserted", 0)),
            enqueued,
            skipped,
        )
        return {
            "product_id": int(product_id),
            "model": str(model),
            "dry_run": bool(dry_run),
            "manifest_items": int(sync_stats.get("manifest_items", 0)),
            "synced_inserted": int(sync_stats.get("inserted", 0)),
            "enqueued": enqueued,
            "skipped": skipped,
        }
    finally:
        db.close()
