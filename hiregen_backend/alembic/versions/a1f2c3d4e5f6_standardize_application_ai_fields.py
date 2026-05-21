"""standardize application ai fields

Revision ID: a1f2c3d4e5f6
Revises: 55a9352fefce
Create Date: 2026-05-20 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'a1f2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '55a9352fefce'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('applications', sa.Column('embedding_match_score', sa.Numeric(precision=5, scale=2), nullable=True))
    op.add_column('applications', sa.Column('llm_match_score', sa.Numeric(precision=5, scale=2), nullable=True))
    op.add_column('applications', sa.Column('final_match_score', sa.Numeric(precision=5, scale=2), nullable=True))
    op.add_column('applications', sa.Column('scoring_method', sa.String(length=100), nullable=True))
    op.add_column('applications', sa.Column('ai_status', sa.String(length=50), nullable=True))
    op.add_column('applications', sa.Column('ai_error', sa.Text(), nullable=True))
    op.add_column('applications', sa.Column('ai_processed_at', sa.DateTime(), nullable=True))
    op.add_column('applications', sa.Column('report_source', sa.String(length=50), nullable=True))
    op.add_column('applications', sa.Column('evaluation_result', postgresql.JSONB(astext_type=sa.Text()), nullable=True))

    op.execute("UPDATE applications SET ai_status = CASE WHEN extracted_data IS NOT NULL OR match_score IS NOT NULL THEN 'processed' ELSE 'queued' END WHERE ai_status IS NULL")
    op.execute("UPDATE applications SET report_source = CASE WHEN extracted_data ? 'ai_report' THEN 'gemini' ELSE 'none' END WHERE report_source IS NULL")
    op.execute("UPDATE applications SET embedding_match_score = match_score, final_match_score = match_score, scoring_method = 'embedding_cosine_v1' WHERE match_score IS NOT NULL")


def downgrade() -> None:
    op.drop_column('applications', 'evaluation_result')
    op.drop_column('applications', 'report_source')
    op.drop_column('applications', 'ai_processed_at')
    op.drop_column('applications', 'ai_error')
    op.drop_column('applications', 'ai_status')
    op.drop_column('applications', 'scoring_method')
    op.drop_column('applications', 'final_match_score')
    op.drop_column('applications', 'llm_match_score')
    op.drop_column('applications', 'embedding_match_score')
