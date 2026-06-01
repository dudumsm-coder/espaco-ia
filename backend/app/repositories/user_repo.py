import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.user import User


class UserRepository:
    @staticmethod
    async def get_by_id(db: AsyncSession, user_id: int) -> User | None:
        result = await db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def get_by_clerk_id(db: AsyncSession, clerk_id: str) -> User | None:
        result = await db.execute(select(User).where(User.clerk_id == clerk_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def create_from_clerk(db: AsyncSession, clerk_id: str, clerk_secret_key: str) -> User:
        name = "Usuário"
        email = None
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    f"https://api.clerk.com/v1/users/{clerk_id}",
                    headers={"Authorization": f"Bearer {clerk_secret_key}"},
                    timeout=5,
                )
                if resp.status_code == 200:
                    data = resp.json()
                    first = data.get("first_name") or ""
                    last = data.get("last_name") or ""
                    name = f"{first} {last}".strip() or "Usuário"
                    emails = data.get("email_addresses", [])
                    if emails:
                        email = emails[0].get("email_address")
        except Exception:
            pass

        user = User(clerk_id=clerk_id, name=name, email=email)
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
