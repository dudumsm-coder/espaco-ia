from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.core.database import get_db
from app.core.security import get_current_admin
from app.models.user import User, UserRole
from app.models.credit import CreditTransaction, CreditPackage, TransactionType
from app.models.requisito import ProjetoRequisito
from app.repositories.user_repo import UserRepository
from app.schemas.user import AdminUserUpdate, UserResponse
from pydantic import BaseModel

router = APIRouter(prefix="/admin", tags=["admin"])


# ── Métricas ──────────────────────────────────────────────────────────────────

@router.get("/stats")
async def get_stats(db: AsyncSession = Depends(get_db), _=Depends(get_current_admin)):
    total_users = (await db.execute(select(func.count()).select_from(User))).scalar()
    total_admins = (await db.execute(select(func.count()).select_from(User).where(User.role == UserRole.admin))).scalar()
    total_projetos = (await db.execute(select(func.count()).select_from(ProjetoRequisito))).scalar()
    total_credits_distributed = (await db.execute(
        select(func.sum(CreditTransaction.amount)).where(CreditTransaction.type == TransactionType.admin_adjust)
    )).scalar() or 0
    total_credits_purchased = (await db.execute(
        select(func.sum(CreditTransaction.amount)).where(CreditTransaction.type == TransactionType.credit)
    )).scalar() or 0
    return {
        "total_users": total_users,
        "total_admins": total_admins,
        "total_projetos": total_projetos,
        "total_credits_distributed": total_credits_distributed,
        "total_credits_purchased": total_credits_purchased,
    }


# ── Usuários ──────────────────────────────────────────────────────────────────

@router.get("/users", response_model=list[UserResponse])
async def list_users(
    skip: int = 0, limit: int = 100,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_admin),
):
    return await UserRepository.list_all(db, skip, limit)


@router.patch("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    body: AdminUserUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin=Depends(get_current_admin),
):
    user = await UserRepository.get_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    if body.name is not None:
        user.name = body.name

    if body.role is not None:
        user.role = body.role

    if body.credits_adjust is not None:
        user.credits = max(0, user.credits + body.credits_adjust)
        tx = CreditTransaction(
            user_id=user_id,
            type=TransactionType.admin_adjust,
            amount=body.credits_adjust,
            balance_after=user.credits,
            description=body.adjust_reason or f"Ajuste manual por admin #{current_admin.id}",
        )
        db.add(tx)

    await db.commit()
    await db.refresh(user)
    return user


@router.post("/users/{user_id}/credits")
async def set_credits(
    user_id: int,
    body: "CreditsSetRequest",
    db: AsyncSession = Depends(get_db),
    current_admin=Depends(get_current_admin),
):
    user = await UserRepository.get_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    delta = body.credits - user.credits
    user.credits = body.credits
    tx = CreditTransaction(
        user_id=user_id,
        type=TransactionType.admin_adjust,
        amount=delta,
        balance_after=user.credits,
        description=body.reason or f"Créditos definidos por admin #{current_admin.id}",
    )
    db.add(tx)
    await db.commit()
    await db.refresh(user)
    return {"id": user.id, "credits": user.credits}


@router.get("/users/{user_id}/transactions")
async def get_user_transactions(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_admin),
):
    user = await UserRepository.get_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    result = await db.execute(
        select(CreditTransaction)
        .where(CreditTransaction.user_id == user_id)
        .order_by(CreditTransaction.created_at.desc())
        .limit(50)
    )
    return list(result.scalars().all())


# ── Pacotes de Crédito ────────────────────────────────────────────────────────

@router.get("/packages")
async def list_packages(db: AsyncSession = Depends(get_db), _=Depends(get_current_admin)):
    result = await db.execute(select(CreditPackage).order_by(CreditPackage.id))
    return list(result.scalars().all())


@router.post("/packages", status_code=201)
async def create_package(body: "PackageRequest", db: AsyncSession = Depends(get_db), _=Depends(get_current_admin)):
    pkg = CreditPackage(**body.model_dump())
    db.add(pkg)
    await db.commit()
    await db.refresh(pkg)
    return pkg


@router.patch("/packages/{pkg_id}")
async def update_package(pkg_id: int, body: "PackageUpdate", db: AsyncSession = Depends(get_db), _=Depends(get_current_admin)):
    result = await db.execute(select(CreditPackage).where(CreditPackage.id == pkg_id))
    pkg = result.scalar_one_or_none()
    if not pkg:
        raise HTTPException(status_code=404, detail="Pacote não encontrado")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(pkg, k, v)
    await db.commit()
    await db.refresh(pkg)
    return pkg


@router.delete("/packages/{pkg_id}", status_code=204)
async def delete_package(pkg_id: int, db: AsyncSession = Depends(get_db), _=Depends(get_current_admin)):
    result = await db.execute(select(CreditPackage).where(CreditPackage.id == pkg_id))
    pkg = result.scalar_one_or_none()
    if not pkg:
        raise HTTPException(status_code=404, detail="Pacote não encontrado")
    await db.delete(pkg)
    await db.commit()


# ── Schemas inline ────────────────────────────────────────────────────────────

class CreditsSetRequest(BaseModel):
    credits: int
    reason: str | None = None


class PackageRequest(BaseModel):
    name: str
    credits: int
    price_brl: float
    stripe_price_id: str | None = None
    is_popular: bool = False
    active: bool = True


class PackageUpdate(BaseModel):
    name: str | None = None
    credits: int | None = None
    price_brl: float | None = None
    is_popular: bool | None = None
    active: bool | None = None
