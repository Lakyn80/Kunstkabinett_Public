"""add_name_to_artist_translation

Revision ID: 2763b70acd67
Revises: 4fb4f0b1d255
Create Date: 2025-11-18 12:15:42.970816

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2763b70acd67'
down_revision: Union[str, Sequence[str], None] = '4fb4f0b1d255'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('artist_translation', sa.Column('name', sa.String(length=200), nullable=False, server_default=''))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('artist_translation', 'name')
