from sqlalchemy import String, Integer, DateTime, func, Enum
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base
import enum


class UserRole(str, enum.Enum):
    user = "user"
    admin = "admin"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    clerk_id: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    email: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.user)
    credits: Mapped[int] = mapped_column(Integer, default=0)
    stripe_customer_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    last_free_credit_grant: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
