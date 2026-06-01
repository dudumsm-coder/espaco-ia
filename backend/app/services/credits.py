from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.credit import CreditTransaction, TransactionType
from app.models.user import User


async def deduct_credits(db: AsyncSession, user: User, amount: int, description: str) -> None:
    if user.credits < amount:
        raise HTTPException(
            status_code=402,
            detail=f"Créditos insuficientes. Necessário: {amount}. Disponível: {user.credits}.",
        )
    user.credits -= amount
    db.add(CreditTransaction(
        user_id=user.id,
        type=TransactionType.debit,
        amount=-amount,
        balance_after=user.credits,
        description=description,
    ))
