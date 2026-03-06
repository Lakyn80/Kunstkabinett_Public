"""Add product media and product media ai tables.

Revision ID: a91d5e3b6c2f
Revises: f8c4a8b3d9e1
Create Date: 2026-03-05 19:10:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "a91d5e3b6c2f"
down_revision = "f8c4a8b3d9e1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "product_media",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("mime", sa.String(length=128), nullable=True),
        sa.Column("size", sa.Integer(), nullable=True),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=False), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["product_id"], ["product.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("product_id", "filename", name="uq_product_media_product_id_filename"),
    )
    op.create_index(op.f("ix_product_media_id"), "product_media", ["id"], unique=False)
    op.create_index(op.f("ix_product_media_product_id"), "product_media", ["product_id"], unique=False)

    op.create_table(
        "product_media_ai",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("media_id", sa.Integer(), nullable=False),
        sa.Column("image_hash", sa.String(length=128), nullable=False),
        sa.Column("model", sa.String(length=128), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("vision_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=False), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=False), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["media_id"], ["product_media.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("media_id", "image_hash", "model", name="uq_product_media_ai_media_id_image_hash_model"),
    )
    op.create_index(op.f("ix_product_media_ai_id"), "product_media_ai", ["id"], unique=False)
    op.create_index(op.f("ix_product_media_ai_media_id"), "product_media_ai", ["media_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_product_media_ai_media_id"), table_name="product_media_ai")
    op.drop_index(op.f("ix_product_media_ai_id"), table_name="product_media_ai")
    op.drop_table("product_media_ai")

    op.drop_index(op.f("ix_product_media_product_id"), table_name="product_media")
    op.drop_index(op.f("ix_product_media_id"), table_name="product_media")
    op.drop_table("product_media")
