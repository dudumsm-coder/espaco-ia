from sqlalchemy import String, Integer, DateTime, ForeignKey, Text, func, Enum, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
import enum


class TransactionType(str, enum.Enum):
    debit = "debit"
    credit = "credit"
    refund = "refund"
    free_grant = "free_grant"
    admin_adjust = "admin_adjust"


class CreditTransaction(Base):
    __tablename__ = "credit_transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    type: Mapped[TransactionType] = mapped_column(Enum(TransactionType))
    amount: Mapped[int] = mapped_column(Integer)
    balance_after: Mapped[int] = mapped_column(Integer)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    stripe_payment_intent_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship("User")  # type: ignore


class CreditPackage(Base):
    __tablename__ = "credit_packages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    credits: Mapped[int] = mapped_column(Integer)
    price_brl: Mapped[float] = mapped_column(Numeric(10, 2))
    stripe_price_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_popular: Mapped[bool] = mapped_column(default=False)
    active: Mapped[bool] = mapped_column(default=True)
