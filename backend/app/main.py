import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from app.core.config import settings
from app.routers import auth, chat, credits, admin, knowledge, appointments, cron
from app.routers.agentes import orchestrator, elicitador, analisador, validador, documentador

logger = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()


async def _weekly_blog_job():
    from app.services.blog_agent import run_blog_agent
    logger.info("Weekly blog agent triggered by scheduler")
    await run_blog_agent(published=False)


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.add_job(
        _weekly_blog_job,
        CronTrigger(day_of_week="mon", hour=8, minute=0, timezone="America/Sao_Paulo"),
        id="weekly_blog",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("Scheduler started — weekly blog job every Monday 08:00 BRT")
    yield
    scheduler.shutdown()


app = FastAPI(
    title="Espaço IA API",
    version="1.0.0",
    docs_url="/docs" if settings.APP_ENV != "production" else None,
    lifespan=lifespan,
)

_cors_origins = [settings.FRONTEND_URL]
if settings.APP_ENV == "development":
    _cors_origins += ["http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000", "http://127.0.0.1:3001"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(chat.router, prefix="/api/v1")
app.include_router(credits.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
app.include_router(knowledge.router, prefix="/api/v1")
app.include_router(appointments.router, prefix="/api/v1")
app.include_router(cron.router, prefix="/api/v1")
app.include_router(orchestrator.router, prefix="/api/v1")
app.include_router(elicitador.router, prefix="/api/v1/agentes")
app.include_router(analisador.router, prefix="/api/v1/agentes")
app.include_router(validador.router, prefix="/api/v1/agentes")
app.include_router(documentador.router, prefix="/api/v1/agentes")


@app.get("/ping")
async def ping():
    return {"status": "ok", "service": "espaco-ia-api"}
