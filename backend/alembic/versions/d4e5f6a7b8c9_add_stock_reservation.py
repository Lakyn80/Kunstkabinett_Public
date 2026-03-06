"""add stock_reservation table

Revision ID: d4e5f6a7b8c9
Revises: c1a2b3d4e5f6
Create Date: 2025-01-11 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, Sequence[str], None] = 'c1a2b3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'stock_reservation',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('product_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('qty', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('session_id', sa.String(length=64), nullable=False),
        sa.Column('status', sa.String(length=16), nullable=False, server_default='active'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['product_id'], ['product.id'], name=op.f('fk_stock_reservation_product_id_product')),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], name=op.f('fk_stock_reservation_user_id_user')),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_stock_reservation'))
    )
    op.create_index(op.f('ix_stock_reservation_id'), 'stock_reservation', ['id'], unique=False)
    op.create_index(op.f('ix_stock_reservation_product_id'), 'stock_reservation', ['product_id'], unique=False)
    op.create_index(op.f('ix_stock_reservation_user_id'), 'stock_reservation', ['user_id'], unique=False)
    op.create_index(op.f('ix_stock_reservation_session_id'), 'stock_reservation', ['session_id'], unique=False)
    op.create_index('ix_reservation_active', 'stock_reservation', ['product_id', 'status', 'expires_at'], unique=False)
    op.create_index('ix_reservation_session', 'stock_reservation', ['session_id', 'status'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_reservation_session', table_name='stock_reservation')
    op.drop_index('ix_reservation_active', table_name='stock_reservation')
    op.drop_index(op.f('ix_stock_reservation_session_id'), table_name='stock_reservation')
    op.drop_index(op.f('ix_stock_reservation_user_id'), table_name='stock_reservation')
    op.drop_index(op.f('ix_stock_reservation_product_id'), table_name='stock_reservation')
    op.drop_index(op.f('ix_stock_reservation_id'), table_name='stock_reservation')
    op.drop_table('stock_reservation')

