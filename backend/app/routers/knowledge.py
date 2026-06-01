from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import get_current_user, get_current_admin
from app.models.knowledge import KnowledgeArticle
from pydantic import BaseModel

router = APIRouter(prefix="/knowledge", tags=["knowledge"])


class ArticleCreate(BaseModel):
    title: str
    slug: str
    content: str
    summary: str | None = None
    tags: str | None = None
    published: bool = False


class ArticleUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    summary: str | None = None
    tags: str | None = None
    published: bool | None = None


@router.get("")
async def list_articles(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(KnowledgeArticle).where(KnowledgeArticle.published == True).order_by(KnowledgeArticle.created_at.desc()))
    return list(result.scalars().all())


@router.get("/all")
async def list_all_articles(db: AsyncSession = Depends(get_db), _=Depends(get_current_admin)):
    result = await db.execute(select(KnowledgeArticle).order_by(KnowledgeArticle.created_at.desc()))
    return list(result.scalars().all())


@router.get("/{slug}")
async def get_article(slug: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(KnowledgeArticle).where(KnowledgeArticle.slug == slug))
    article = result.scalar_one_or_none()
    if not article:
        raise HTTPException(status_code=404, detail="Artigo não encontrado")
    return article


@router.post("", status_code=201)
async def create_article(body: ArticleCreate, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_admin)):
    existing = await db.execute(select(KnowledgeArticle).where(KnowledgeArticle.slug == body.slug))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Slug já existe")
    article = KnowledgeArticle(**body.model_dump(), author_id=current_user.id)
    db.add(article)
    await db.commit()
    await db.refresh(article)
    return article


@router.patch("/{article_id}")
async def update_article(article_id: int, body: ArticleUpdate, db: AsyncSession = Depends(get_db), _=Depends(get_current_admin)):
    result = await db.execute(select(KnowledgeArticle).where(KnowledgeArticle.id == article_id))
    article = result.scalar_one_or_none()
    if not article:
        raise HTTPException(status_code=404, detail="Artigo não encontrado")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(article, k, v)
    await db.commit()
    await db.refresh(article)
    return article


@router.delete("/{article_id}", status_code=204)
async def delete_article(article_id: int, db: AsyncSession = Depends(get_db), _=Depends(get_current_admin)):
    result = await db.execute(select(KnowledgeArticle).where(KnowledgeArticle.id == article_id))
    article = result.scalar_one_or_none()
    if not article:
        raise HTTPException(status_code=404, detail="Artigo não encontrado")
    await db.delete(article)
    await db.commit()
