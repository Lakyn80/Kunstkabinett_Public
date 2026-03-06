from __future__ import annotations

import logging

from rq import get_current_job
from sqlalchemy.exc import IntegrityError

from app.db import models
from app.db.session import SessionLocal
from app.modules.vision_queue.worker_utils import (
    compute_image_hash,
    generate_vision_description,
    read_product_media_image_bytes,
)

logger = logging.getLogger(__name__)


def generate_image_vision_job(media_id: int, model: str, dry_run: bool = False):
    db = SessionLocal()
    try:
        current_job = get_current_job()
        logger.info(
            "VISION_JOB_START media_id=%s model=%s job_id=%s dry_run=%s",
            media_id,
            model,
            getattr(current_job, "id", None),
            dry_run,
        )

        media = db.get(models.ProductMedia, int(media_id))
        if media is None:
            logger.error("VISION_JOB_ERROR media_id=%s model=%s error=missing_media", media_id, model)
            return {"status": "missing_media"}

        image_bytes = read_product_media_image_bytes(product_id=int(media.product_id), filename=str(media.filename))
        image_hash = compute_image_hash(image_bytes)

        existing = (
            db.query(models.ProductMediaAI)
            .filter(
                models.ProductMediaAI.media_id == int(media.id),
                models.ProductMediaAI.image_hash == image_hash,
                models.ProductMediaAI.model == str(model),
            )
            .first()
        )
        if existing is not None:
            logger.info(
                "VISION_JOB_SKIP_ALREADY_EXISTS media_id=%s model=%s image_hash=%s",
                media.id,
                model,
                image_hash,
            )
            return {"status": "exists", "media_id": int(media.id), "image_hash": image_hash}

        if dry_run:
            logger.info("DRY RUN vision job media_id=%s model=%s", media.id, model)
            return {"status": "dry_run", "media_id": int(media.id), "image_hash": image_hash}

        vision_result = generate_vision_description(image_bytes, filename=str(media.filename))
        description = str(vision_result.get("description") or "").strip() or None
        vision_json = vision_result.get("vision_json") if isinstance(vision_result.get("vision_json"), dict) else {}

        row = models.ProductMediaAI(
            media_id=int(media.id),
            image_hash=image_hash,
            model=str(model),
            description=description,
            vision_json=vision_json,
        )
        db.add(row)
        db.commit()

        logger.info(
            "VISION_JOB_SUCCESS media_id=%s model=%s image_hash=%s",
            media.id,
            model,
            image_hash,
        )
        return {"status": "done", "media_id": int(media.id), "image_hash": image_hash}

    except IntegrityError:
        db.rollback()
        logger.info("VISION_JOB_SKIP_ALREADY_EXISTS media_id=%s model=%s reason=unique_constraint", media_id, model)
        return {"status": "exists_race", "media_id": int(media_id)}
    except Exception as exc:
        db.rollback()
        logger.exception("VISION_JOB_ERROR media_id=%s model=%s error=%s", media_id, model, exc)
        raise
    finally:
        db.close()
