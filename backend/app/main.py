from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from fastapi.staticfiles import StaticFiles
from sqlalchemy import create_engine, text
from pathlib import Path
from dotenv import load_dotenv
import os
import logging

ENV_PATH = Path(__file__).resolve().parents[1] / ".env"
# override=False zajišťuje, že environment variables mají přednost (důležité pro Docker)
load_dotenv(dotenv_path=ENV_PATH, override=False)

DATABASE_URL = os.getenv("DATABASE_URL", "")
CORS = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5174,http://localhost,http://127.0.0.1")

from app.api.v1 import routes_products
from app.api.v1 import routes_categories
from app.api.v1 import routes_auth
from app.api.v1 import routes_blog
from app.api_admin.v1 import routes_reservations as admin_reservations
from app.api_admin.v1 import routes_products as admin_products
from app.api_admin.v1 import routes_categories as admin_categories
from app.api_admin.v1 import routes_blog as admin_blog
from app.api_admin.v1 import routes_orders as admin_orders
from app.api.v1 import routes_artists
from app.api_admin.v1 import routes_artists as admin_artists
from app.api_admin.v1 import routes_dashboard as admin_dashboard
from app.api_admin.v1 import routes_orders_export as admin_orders_export
from app.api_admin.v1 import routes_invoices as admin_invoices
from app.api.v1 import routes_auth_password_reset
from app.api_admin.v1 import routes_reports as admin_reports
from app.api.v1 import routes_auth_register
from app.api.v1 import routes_media_upload
from app.api.v1 import routes_contact
from app.api.v1 import routes_seo
from app.api.v1.routes_orders_payment import router as client_payments_router
from app.api_admin.v1 import routes_users as admin_users
from app.api_admin.v1 import routes_auth as admin_auth
from app.api_admin.v1 import routes_exchange_rate as admin_exchange_rate
from app.modules.ai.art.router import router as ai_art_router
from app.modules.ai.artist_bio.router import router as ai_artist_bio_router
from app.modules.media.router import router as media_router
from app.modules.media_inbox.router import router as media_inbox_router
from app.modules.translation_queue.queue import enqueue_repair_missing_translations_job

from app.api.v1 import routes_coupons as public_coupons
from app.api_admin.v1 import routes_coupons as admin_coupons

from app.api.v1.routes_profile import router as profile_router
from app.db import models_profile

from app.api.v1 import routes_reservations
from app.api.v1 import routes_orders_from_reservation

from app.tasks.reservations_cleanup import register_cleanup
from app.tasks.orders_expire import register_orders_expire

from app.realtime import router as realtime_router
from app.api_admin.v1.routes_users_corporate import router as admin_users_corporate_router

from app.api.v1.routes_orders import router_root as client_orders_root, router_v1 as client_orders_v1

logger = logging.getLogger(__name__)


def _mask_url(url: str) -> str:
    if "://" not in url:
        return url
    scheme, rest = url.split("://", 1)
    if "@" in rest and ":" in rest.split("@")[0]:
        user = rest.split("@", 1)[0].split(":", 1)[0]
        hostpart = rest.split("@", 1)[1]
        return f"{scheme}://{user}:***@{hostpart}."
    return url


app = FastAPI(
    title="Arte Moderno API (Postgres Test)",
    swagger_ui_parameters={"persistAuthorization": True},
)

def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    openapi_schema = get_openapi(
        title=app.title,
        version="1.0.0",
        description="Arte Moderno API",
        routes=app.routes,
    )
    comps = openapi_schema.setdefault("components", {})
    comps["securitySchemes"] = comps.get("securitySchemes", {})
    comps["securitySchemes"]["bearerAuth"] = {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "JWT",
    }
    openapi_schema["security"] = [{"bearerAuth": []}]
    app.openapi_schema = openapi_schema
    return app.openapi_schema

app.openapi = custom_openapi

register_cleanup(app)
register_orders_expire(app)


@app.on_event("startup")
async def _enqueue_translation_repair_startup() -> None:
    try:
        created = enqueue_repair_missing_translations_job(offset=0)
        logger.info("translation.enqueue.created job=repair_missing_translations startup=true created=%s", bool(created))
    except Exception as exc:
        logger.error("translation.enqueue.skipped job=repair_missing_translations startup=true reason=%s", exc)

cors_env = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5174,http://localhost,http://127.0.0.1")
allow_origins = [o.strip() for o in cors_env.split(",") if o.strip()]
if not allow_origins:
    allow_origins = ["http://localhost:5173", "http://127.0.0.1:5173", "http://127.0.0.1:5174", "http://localhost", "http://127.0.0.1"]
if "*" in allow_origins:
    allow_origins = [o for o in allow_origins if o != "*"]
    if not allow_origins:
        raise RuntimeError("CORS_ORIGINS must not contain '*' when allow_credentials=True")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Session-Id"],
    max_age=86400,
)

# Resolve upload directory (prefers env, then common docker paths, then cwd)
def _resolve_upload_dir() -> Path:
    candidates = []
    env_dir = os.getenv("UPLOAD_DIR")
    if env_dir:
        candidates.append(Path(env_dir))
    candidates.append(Path("/app/uploads"))
    candidates.append(Path("/var/www/kunst/uploads"))
    candidates.append(Path(os.getcwd()) / "uploads")

    for p in candidates:
        try:
            p.mkdir(parents=True, exist_ok=True)
            return p
        except Exception:
            continue
    fallback = Path("./uploads")
    fallback.mkdir(parents=True, exist_ok=True)
    return fallback

UPLOAD_DIR = _resolve_upload_dir()
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

@app.get("/health", tags=["meta"])
def health():
    url_used = DATABASE_URL or "(EMPTY)"
    if not DATABASE_URL:
        return {"status": "error", "reason": "DATABASE_URL not set", "env_path": str(ENV_PATH)}
    try:
        engine = create_engine(DATABASE_URL)
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "ok", "db": "connected", "database_url": _mask_url(url_used)}
    except Exception as e:
        return {"status": "error", "db_error": str(e), "database_url": _mask_url(url_used)}

# ====== VEŘEJNÉ ROUTERY ======
app.include_router(routes_products.router, prefix="/api/v1")
app.include_router(routes_categories.router, prefix="/api/v1")
app.include_router(client_orders_root)
app.include_router(client_orders_v1)
app.include_router(routes_auth.router, prefix="/api/v1")  # Client auth endpoints
app.include_router(routes_blog.router, prefix="/api/v1")
app.include_router(routes_reservations.router, prefix="/api/v1")
app.include_router(routes_orders_from_reservation.router, prefix="/api/v1")
app.include_router(routes_auth_password_reset.router, prefix="/auth")
app.include_router(routes_artists.router, prefix="/api/v1")
app.include_router(routes_auth_register.router, prefix="/api/v1/auth")
app.include_router(routes_media_upload.router, prefix="/api/v1")
app.include_router(routes_contact.router, prefix="/api/v1")
app.include_router(routes_seo.router, prefix="/api/v1")
app.include_router(public_coupons.router, prefix="/api/v1")
app.include_router(profile_router, prefix="/api/v1")
app.include_router(realtime_router)
app.include_router(admin_users_corporate_router, prefix="/api/admin/v1")
app.include_router(client_payments_router, prefix="/api/client/v1")

# ====== ADMIN ROUTERY ======
app.include_router(admin_auth.router, prefix="/api/admin/v1")
app.include_router(admin_users.router, prefix="/api/admin/v1")
app.include_router(admin_reservations.router, prefix="/api/admin/v1")
app.include_router(admin_products.router, prefix="/api/admin/v1")
app.include_router(admin_categories.router, prefix="/api/admin/v1")
app.include_router(admin_blog.router, prefix="/api/admin/v1")
app.include_router(admin_orders.router, prefix="/api/admin/v1")
app.include_router(admin_dashboard.router, prefix="/api/admin/v1")
app.include_router(admin_orders_export.router, prefix="/api/admin/v1")
app.include_router(admin_invoices.router, prefix="/api/admin/v1")
app.include_router(admin_reports.router, prefix="/api/admin/v1")
app.include_router(admin_exchange_rate.router, prefix="/api/admin/v1")
app.include_router(admin_coupons.router, prefix="/api/admin/v1")
app.include_router(admin_artists.router, prefix="/api/admin/v1")
app.include_router(ai_art_router, prefix="/api/admin/v1")
app.include_router(ai_artist_bio_router, prefix="/api/admin/v1")
app.include_router(media_router)
app.include_router(media_inbox_router)
