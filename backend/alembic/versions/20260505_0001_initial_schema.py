"""initial schema

Revision ID: 20260505_0001
Revises:
Create Date: 2026-05-05 18:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "20260505_0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=20), server_default=sa.text("'user'"), nullable=False),
        sa.Column("language", sa.String(length=10), server_default=sa.text("'ru'"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_users"),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )

    op.create_table(
        "words",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source_key", sa.String(length=100), nullable=True),
        sa.Column("lemma", sa.String(length=100), nullable=False),
        sa.Column("translation", sa.String(length=255), nullable=False),
        sa.Column("pos", sa.String(length=20), nullable=True),
        sa.Column("difficulty_level", sa.String(length=5), server_default=sa.text("'A1'"), nullable=False),
        sa.Column("frequency", sa.Float(), server_default=sa.text("1.0"), nullable=False),
        sa.Column("example_sentence", sa.Text(), nullable=True),
        sa.Column("last_imported_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("version", sa.Integer(), server_default=sa.text("1"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_words"),
        sa.UniqueConstraint("source_key", name="uq_words_source_key"),
    )
    op.create_index("idx_words_source_key", "words", ["source_key"], unique=False)
    op.create_index("idx_words_lemma", "words", ["lemma"], unique=False)
    op.create_index("idx_words_frequency", "words", ["frequency"], unique=False)

    op.create_table(
        "categories",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name_ru", sa.String(length=50), nullable=False),
        sa.Column("name_lak", sa.String(length=50), nullable=True),
        sa.Column("icon", sa.String(length=10), nullable=True),
        sa.Column("order_index", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_categories"),
    )

    op.create_table(
        "tags",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=30), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_tags"),
        sa.UniqueConstraint("name", name="uq_tags_name"),
    )

    op.create_table(
        "word_category",
        sa.Column("word_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("category_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("is_primary", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"], name="fk_word_category_category_id_categories", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["word_id"], ["words.id"], name="fk_word_category_word_id_words", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("word_id", "category_id", name="pk_word_category"),
    )

    op.create_table(
        "word_tag",
        sa.Column("word_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tag_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(["tag_id"], ["tags.id"], name="fk_word_tag_tag_id_tags", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["word_id"], ["words.id"], name="fk_word_tag_word_id_words", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("word_id", "tag_id", name="pk_word_tag"),
    )

    op.create_table(
        "user_word_progress",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("word_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("ease_factor", sa.Float(), server_default=sa.text("2.5"), nullable=False),
        sa.Column("interval", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("repetitions", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("status", sa.String(length=10), server_default=sa.text("'new'"), nullable=False),
        sa.Column("last_review", sa.DateTime(timezone=True), nullable=True),
        sa.Column("next_review", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_user_word_progress_user_id_users", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["word_id"], ["words.id"], name="fk_user_word_progress_word_id_words", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name="pk_user_word_progress"),
        sa.UniqueConstraint("user_id", "word_id", name="uq_user_word_progress_user_id_word_id"),
    )
    op.create_index("idx_progress_user_next_review", "user_word_progress", ["user_id", "next_review"], unique=False)
    op.create_index("idx_progress_status", "user_word_progress", ["status"], unique=False)

    op.create_table(
        "import_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("filename", sa.String(length=255), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("diff_summary", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_import_logs_user_id_users", ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id", name="pk_import_logs"),
    )


def downgrade() -> None:
    op.drop_table("import_logs")
    op.drop_index("idx_progress_status", table_name="user_word_progress")
    op.drop_index("idx_progress_user_next_review", table_name="user_word_progress")
    op.drop_table("user_word_progress")
    op.drop_table("word_tag")
    op.drop_table("word_category")
    op.drop_table("tags")
    op.drop_table("categories")
    op.drop_index("idx_words_frequency", table_name="words")
    op.drop_index("idx_words_lemma", table_name="words")
    op.drop_index("idx_words_source_key", table_name="words")
    op.drop_table("words")
    op.drop_table("users")

