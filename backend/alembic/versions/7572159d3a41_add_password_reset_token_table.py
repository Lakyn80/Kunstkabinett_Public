"""add_password_reset_token_table

Revision ID: 7572159d3a41
Revises: e5f6a7b8c9d0
Create Date: 2025-11-14 17:59:28.074842

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7572159d3a41'
down_revision: Union[str, Sequence[str], None] = 'e5f6a7b8c9d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create email_verification_token table
    op.create_table('email_verification_token',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('token', sa.String(length=128), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('used', sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], name=op.f('fk_email_verification_token_user_id_user')),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_email_verification_token'))
    )
    op.create_index(op.f('ix_email_verification_token_token'), 'email_verification_token', ['token'], unique=True)
    op.create_index(op.f('ix_email_verification_token_user_id'), 'email_verification_token', ['user_id'], unique=False)

    # Create password_reset_token table
    op.create_table('password_reset_token',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('token', sa.String(length=128), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('used', sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], name=op.f('fk_password_reset_token_user_id_user')),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_password_reset_token'))
    )
    op.create_index(op.f('ix_password_reset_token_token'), 'password_reset_token', ['token'], unique=True)
    op.create_index(op.f('ix_password_reset_token_user_id'), 'password_reset_token', ['user_id'], unique=False)

    # SAFE DROP: contact_settings (only if exists)
    op.execute("DROP TABLE IF EXISTS contact_settings CASCADE")

    # Alter stock_reservation columns
    op.alter_column(
        'stock_reservation', 'qty',
        existing_type=sa.INTEGER(),
        server_default=None,
        existing_nullable=False
    )
    op.alter_column(
        'stock_reservation', 'status',
        existing_type=sa.VARCHAR(length=16),
        server_default=None,
        existing_nullable=False
    )


def downgrade() -> None:
    """Downgrade schema."""
    # Restore stock_reservation defaults
    op.alter_column(
        'stock_reservation', 'status',
        existing_type=sa.VARCHAR(length=16),
        server_default=sa.text("'active'::character varying"),
        existing_nullable=False
    )
    op.alter_column(
        'stock_reservation', 'qty',
        existing_type=sa.INTEGER(),
        server_default=sa.text('1'),
        existing_nullable=False
    )

    # Recreate contact_settings table
    op.create_table(
        'contact_settings',
        sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False),
        sa.Column('company_name', sa.VARCHAR(length=255), nullable=True),
        sa.Column('company_id', sa.VARCHAR(length=50), nullable=True),
        sa.Column('email', sa.VARCHAR(length=255), nullable=True),
        sa.Column('phone', sa.VARCHAR(length=50), nullable=True),
        sa.Column('website', sa.VARCHAR(length=255), nullable=True),
        sa.Column('address_street', sa.VARCHAR(length=255), nullable=True),
        sa.Column('address_city', sa.VARCHAR(length=100), nullable=True),
        sa.Column('address_zip', sa.VARCHAR(length=20), nullable=True),
        sa.Column('address_country', sa.VARCHAR(length=100), nullable=True),
        sa.Column('address_note', sa.TEXT(), nullable=True),
        sa.Column('maps_url', sa.TEXT(), nullable=True),
        sa.Column('maps_embed', sa.TEXT(), nullable=True),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_contact_settings'))
    )

    # Drop password_reset_token table
    op.drop_index(op.f('ix_password_reset_token_user_id'), table_name='password_reset_token')
    op.drop_index(op.f('ix_password_reset_token_token'), table_name='password_reset_token')
    op.drop_table('password_reset_token')

    # Drop email_verification_token table
    op.drop_index(op.f('ix_email_verification_token_user_id'), table_name='email_verification_token')
    op.drop_index(op.f('ix_email_verification_token_token'), table_name='email_verification_token')
    op.drop_table('email_verification_token')
