"""add ai attempt tracking fields

Revision ID: c7d8e9f0a1b2
Revises: b2c3d4e5f6a7
Create Date: 2026-05-21 23:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c7d8e9f0a1b2'
down_revision: Union[str, Sequence[str], None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('applications', sa.Column('last_ai_error', sa.Text(), nullable=True))
    op.add_column('applications', sa.Column('last_ai_rerun_at', sa.DateTime(), nullable=True))
    op.add_column('applications', sa.Column('last_ai_attempt_status', sa.String(length=50), nullable=True))


def downgrade() -> None:
    op.drop_column('applications', 'last_ai_attempt_status')
    op.drop_column('applications', 'last_ai_rerun_at')
    op.drop_column('applications', 'last_ai_error')
