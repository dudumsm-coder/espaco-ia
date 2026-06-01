from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.user import User


class UserRepository:
    @staticmethod
    async def get_by_id(db: AsyncSession, user_id: int) -> User | None:
        result = await db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def get_by_email(db: AsyncSession, email: str) -> User | None:
        result = await db.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    @staticmethod
    async def create(db: AsyncSession, name: str, email: str, password_hash: str) -> User:
        user = User(name=name, email=email, password_hash=password_hash)
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user

    @staticmethod
    async def update_credits(db: AsyncSession, user_id: int, delta: int) -> User:
        user = await UserRepository.get_by_id(db, user_id)
        user.credits += delta
        await db.commit()
        await db.refresh(user)
        return user

    @staticmethod
    async def list_all(db: AsyncSession, skip: int = 0, limit: int = 50) -> list[User]:
        result = await db.execute(select(User).offset(skip).limit(limit))
        return list(result.scalars().all())
