from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import get_current_admin
from app.models.user import User
from app.models.credit import CreditTransaction, TransactionType
from app.repositories.user_repo import UserRepository
from app.schemas.user import AdminUserUpdate, UserResponse

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/users", response_model=list[UserResponse])
async def list_users(
    skip: int = 0, limit: int = 50,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    return await UserRepository.list_all(db, skip, limit)


@router.patch("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    body: AdminUserUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    user = await UserRepository.get_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    if body.name:
        user.name = body.name
    if body.role:
        user.role = body.role
    if body.credits_adjust is not None:
        user.credits += body.credits_adjust
        tx = CreditTransaction(
            user_id=user_id,
            type=TransactionType.admin_adjust,
            amount=body.credits_adjust,
            balance_after=user.credits,
            description=body.adjust_reason or "Ajuste admin",
        )
        db.add(tx)

    await db.commit()
    await db.refresh(user)
    return user
