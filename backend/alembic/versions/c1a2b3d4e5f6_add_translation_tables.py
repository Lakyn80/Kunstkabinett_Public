"""add translation tables

Revision ID: c1a2b3d4e5f6
Revises: 80fa7a8a4d0d
Create Date: 2025-10-26 14:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c1a2b3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '80fa7a8a4d0d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create CategoryTranslation table
    op.create_table(
        'category_translation',
        sa.Column('category_id', sa.Integer(), nullable=False),
        sa.Column('language_code', sa.String(length=5), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.ForeignKeyConstraint(['category_id'], ['category.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('category_id', 'language_code')
    )

    # Create ArtistTranslation table
    op.create_table(
        'artist_translation',
        sa.Column('artist_id', sa.Integer(), nullable=False),
        sa.Column('language_code', sa.String(length=5), nullable=False),
        sa.Column('bio', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['artist_id'], ['artist.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('artist_id', 'language_code')
    )

    # Create ProductTranslation table
    op.create_table(
        'product_translation',
        sa.Column('product_id', sa.Integer(), nullable=False),
        sa.Column('language_code', sa.String(length=5), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['product_id'], ['product.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('product_id', 'language_code')
    )

    # Create BlogPostTranslation table
    op.create_table(
        'blog_post_translation',
        sa.Column('blog_post_id', sa.Integer(), nullable=False),
        sa.Column('language_code', sa.String(length=5), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('content', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['blog_post_id'], ['blog_post.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('blog_post_id', 'language_code')
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('blog_post_translation')
    op.drop_table('product_translation')
    op.drop_table('artist_translation')
    op.drop_table('category_translation')
