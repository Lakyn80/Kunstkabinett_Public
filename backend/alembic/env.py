from __future__ import annotations

import os
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

# --- Alembic config ---
config = context.config

# Načti logging z alembic.ini (sekce [loggers]/[handlers]/[formatters])
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# --- DŮLEŽITÉ: import Base + modelů, aby autogenerate vidělo schéma ---
# prepend_sys_path = . je nastavené v alembic.ini, takže importy "app.*" projdou.
from app.db.base import Base  # type: ignore
from app.db import models  # noqa: F401  # důležité pro autogenerate (side-effect import)
from app.db.models_profile import Profile  # noqa: F401  # důležité pro autogenerate
from app.db.models_reservations import StockReservation  # noqa: F401  # důležité pro autogenerate
from app.db.models_tokens import PasswordResetToken, EmailVerificationToken  # noqa: F401  # důležité pro autogenerate

# metadata všech modelů:
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Spuštění migrací v offline režimu (bez DB připojení)."""
    url = config.get_main_option("sqlalchemy.url")
    
    # Fallback na DATABASE_URL z environment, pokud není v config
    if not url or url.startswith("driver://"):
        url = os.environ.get("DATABASE_URL", "")
    
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        compare_type=True,
        compare_server_default=True,
        render_as_batch=False,  # pro Postgres netřeba batch
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Spuštění migrací v online režimu (s DB připojením)."""
    
    # Získej configuration z alembic.ini
    configuration = config.get_section(config.config_ini_section) or {}
    
    # DŮLEŽITÉ: Přepis DATABASE_URL ze .env (má prioritu)
    database_url = os.environ.get("DATABASE_URL")
    if database_url:
        configuration["sqlalchemy.url"] = database_url
    
    # Vytvořit engine
    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
            render_as_batch=False,
        )

        with context.begin_transaction():
            context.run_migrations()


# --- Entry point ---
if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()