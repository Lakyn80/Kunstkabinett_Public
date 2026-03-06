"""add_is_active_to_products

Revision ID: 4fb4f0b1d255
Revises: 7572159d3a41
Create Date: 2025-11-17 20:21:32.729323

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4fb4f0b1d255'
down_revision: Union[str, Sequence[str], None] = '7572159d3a41'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('product', sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('product', 'is_active')
