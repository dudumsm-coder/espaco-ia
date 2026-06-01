import logging
from datetime import datetime, timezone
from slugify import slugify
from duckduckgo_search import DDGS
from app.services.llm import invoke_llm
from app.core.database import AsyncSessionLocal
from app.models.knowledge import KnowledgeArticle
from sqlalchemy import select

logger = logging.getLogger(__name__)

SEARCH_QUERIES = [
    "AI artificial intelligence business applications 2025",
    "inteligência artificial empresas casos de uso 2025",
    "machine learning automation business productivity",
    "generative AI enterprise deployment ROI",
    "AI startup business transformation Brazil",
]

SYSTEM_BLOG = """Você é um jornalista de tecnologia especializado em inteligência artificial para negócios.
Escreva em português brasileiro, tom profissional mas acessível.
Seu público: gestores, empreendedores e executivos interessados em aplicar IA nos negócios — sem perfil técnico profundo.

A partir das notícias fornecidas, escreva um post de blog completo e original.

ESTRUTURA OBRIGATÓRIA (em Markdown):
# [Título atraente sobre tendência de IA nos negócios]

**Resumo:** [2-3 frases sobre o que o leitor vai aprender — para o campo summary]

## O que está acontecendo

[Contextualização das tendências identificadas nas notícias]

## Casos reais de aplicação

[2-4 exemplos concretos de empresas ou setores usando IA — tirados das notícias]

## O que isso significa para o seu negócio

[Análise prática: como essas tendências afetam PMEs e gestores brasileiros]

## Como começar

[3-5 ações concretas que um gestor pode tomar esta semana]

## Conclusão

[Fechamento motivacional e convite para o leitor agir]

---
*Post gerado com curadoria de notícias da semana por Espaço IA*

REGRAS:
- Título deve ter no máximo 80 caracteres
- Use dados e números sempre que disponível nas notícias
- Mencione empresas reais apenas se estiver nas notícias fornecidas
- Tom: consultivo, não sensacionalista
- Evite jargões técnicos sem explicação
- Tamanho: 800-1200 palavras"""


def _search_news(max_results: int = 15) -> list[dict]:
    results = []
    ddgs = DDGS()
    seen_urls = set()
    for query in SEARCH_QUERIES:
        try:
            items = ddgs.news(query, max_results=4, timelimit="w")
            for item in items:
                url = item.get("url", "")
                if url not in seen_urls:
                    seen_urls.add(url)
                    results.append(item)
        except Exception as e:
            logger.warning(f"DDG search error for '{query}': {e}")
    return results[:max_results]


def _format_news_for_prompt(news_items: list[dict]) -> str:
    lines = []
    for i, item in enumerate(news_items, 1):
        title = item.get("title", "")
        body = item.get("body", "")
        source = item.get("source", "")
        date = item.get("date", "")
        lines.append(f"{i}. [{source}] {date}\n   Título: {title}\n   Resumo: {body}\n")
    return "\n".join(lines)


def _extract_summary(markdown: str) -> str:
    for line in markdown.split("\n"):
        if line.startswith("**Resumo:**"):
            return line.replace("**Resumo:**", "").strip()
    for line in markdown.split("\n"):
        if line.strip() and not line.startswith("#") and len(line) > 50:
            return line.strip()[:300]
    return ""


def _generate_slug(title: str) -> str:
    base = slugify(title, allow_unicode=False, max_length=80)
    ts = datetime.now(timezone.utc).strftime("%Y%m%d")
    return f"{base}-{ts}"


async def run_blog_agent(published: bool = False) -> dict:
    logger.info("Blog agent started")

    news_items = _search_news(max_results=15)
    if not news_items:
        logger.warning("No news found — aborting blog agent")
        return {"status": "no_news", "article_id": None}

    news_text = _format_news_for_prompt(news_items)
    today = datetime.now(timezone.utc).strftime("%d/%m/%Y")

    messages = [{
        "role": "user",
        "content": (
            f"Data de hoje: {today}\n\n"
            f"Notícias coletadas esta semana sobre IA e negócios:\n\n"
            f"{news_text}\n\n"
            "Escreva o post de blog completo em Markdown conforme as instruções."
        ),
    }]

    content = await invoke_llm(messages=messages, system=SYSTEM_BLOG, max_tokens=4096)

    lines = content.strip().split("\n")
    title = ""
    for line in lines:
        if line.startswith("# "):
            title = line[2:].strip()
            break
    if not title:
        title = f"IA nos negócios: tendências da semana — {today}"

    summary = _extract_summary(content)
    slug = _generate_slug(title)
    tags = "inteligência artificial,negócios,tendências,IA"

    async with AsyncSessionLocal() as db:
        existing = await db.execute(select(KnowledgeArticle).where(KnowledgeArticle.slug == slug))
        if existing.scalar_one_or_none():
            slug = f"{slug}-2"

        article = KnowledgeArticle(
            title=title,
            slug=slug,
            content=content,
            summary=summary,
            tags=tags,
            published=published,
        )
        db.add(article)
        await db.commit()
        await db.refresh(article)

    logger.info(f"Blog agent created article id={article.id} title='{title}' published={published}")
    return {"status": "created", "article_id": article.id, "title": title, "slug": slug, "published": published}
