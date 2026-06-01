from sqlalchemy import String, Integer, DateTime, ForeignKey, Text, func, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class KnowledgeArticle(Base):
    __tablename__ = "knowledge_articles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(500))
    slug: Mapped[str] = mapped_column(String(500), unique=True, index=True)
    content: Mapped[str] = mapped_column(Text)
    summary: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    tags: Mapped[str | None] = mapped_column(String(500), nullable=True)
    published: Mapped[bool] = mapped_column(Boolean, default=False)
    author_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
