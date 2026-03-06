from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from app.core.deps import require_admin

from .schemas import (
    ArtDescribeResponse,
    ArtRewriteRequest,
    ArtRewriteResponse,
    RagIngestRequest,
    RagSearchRequest,
    RagSearchResponse,
)
from .service import (
    describe_art_image,
    ingest_rag_entry,
    load_image_from_reference,
    rewrite_art_description,
    search_rag_entries,
    seed_placeholder_rules,
)


router = APIRouter(prefix="/ai/art", tags=["admin: ai-art"], dependencies=[Depends(require_admin)])
logger = logging.getLogger(__name__)


@router.post("/describe-upload", response_model=ArtDescribeResponse)
async def describe_upload(
    image: UploadFile | None = File(None),
    image_url: str | None = Form(None),
    art_type: str = Form("auto"),
    style_hint: str | None = Form(None),
    save_to_rag: bool = Form(True),
    product_id: int | None = Form(None),
    image_asset_key: str | None = Form(None),
) -> ArtDescribeResponse:
    if image is None and not str(image_url or "").strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide image upload or image_url.",
        )

    try:
        if image is not None:
            content_type = (image.content_type or "").lower()
            if not content_type.startswith("image/"):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Only image files are supported.",
                )
            image_bytes = await image.read()
            if not image_bytes:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Uploaded image is empty.",
                )
        else:
            image_bytes, content_type = await load_image_from_reference(str(image_url or ""))

        result = await describe_art_image(
            image_bytes=image_bytes,
            mime_type=content_type,
            art_type=art_type,
            style_hint=style_hint,
            save_to_rag=save_to_rag,
            product_id=product_id,
            image_asset_key=image_asset_key,
        )
        logger.info(
            "ai_art_describe_done provider=%s from_cache=%s image_key=%s",
            result.get("provider_used"),
            result.get("from_cache"),
            result.get("image_key"),
        )
        return ArtDescribeResponse(**result)
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI describe failed: {exc}",
        ) from exc


@router.post("/rewrite", response_model=ArtRewriteResponse)
async def rewrite_description(payload: ArtRewriteRequest) -> ArtRewriteResponse:
    try:
        result = await rewrite_art_description(
            image_key=payload.image_key,
            mode=payload.mode,
            style_hint=payload.style_hint,
            max_chars=payload.max_chars,
            save_to_rag=payload.save_to_rag,
        )
        return ArtRewriteResponse(**result)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI rewrite failed: {exc}",
        ) from exc


@router.post("/rag/ingest")
def ingest_rag(payload: RagIngestRequest) -> dict[str, str]:
    try:
        doc_id = ingest_rag_entry(
            title=payload.title,
            description=payload.description,
            tags=payload.tags,
            art_type=payload.art_type,
            source=payload.source,
        )
        return {"id": doc_id}
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"RAG ingest failed: {exc}",
        ) from exc


@router.post("/rag/search", response_model=RagSearchResponse)
def rag_search(payload: RagSearchRequest) -> RagSearchResponse:
    try:
        items = search_rag_entries(
            query=payload.query,
            n_results=payload.n_results,
            art_type=payload.art_type,
        )
        return RagSearchResponse(items=items)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"RAG search failed: {exc}",
        ) from exc


@router.post("/rag/seed-placeholders")
def rag_seed_placeholders() -> dict:
    try:
        return seed_placeholder_rules()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"RAG seed failed: {exc}",
        ) from exc
