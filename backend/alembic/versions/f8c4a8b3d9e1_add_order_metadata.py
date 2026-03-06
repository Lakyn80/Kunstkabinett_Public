"""Add order metadata columns.

Revision ID: f8c4a8b3d9e1
Revises: b2905e278b68
Create Date: 2026-01-22 21:45:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "f8c4a8b3d9e1"
down_revision = "2763b70acd67"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "order",
        sa.Column("order_number", sa.String(length=64), nullable=True),
    )
    op.create_unique_constraint(
        op.f("uq_order_order_number"),
        "order",
        ["order_number"],
    )
    op.add_column(
        "order",
        sa.Column("amount", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "order",
        sa.Column("payment_trans_id", sa.String(length=128), nullable=True),
    )
    op.add_column(
        "order",
        sa.Column("payment_ref_id", sa.String(length=128), nullable=True),
    )
    op.add_column(
        "order",
        sa.Column("is_test", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )
    op.add_column(
        "order",
        sa.Column("language", sa.String(length=5), nullable=True, server_default="cs"),
    )
    op.add_column(
        "order",
        sa.Column("paid_at", sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("order", "paid_at")
    op.drop_column("order", "language")
    op.drop_column("order", "is_test")
    op.drop_column("order", "payment_ref_id")
    op.drop_column("order", "payment_trans_id")
    op.drop_column("order", "amount")
    op.drop_constraint(op.f("uq_order_order_number"), "order", type_="unique")
    op.drop_column("order", "order_number")
