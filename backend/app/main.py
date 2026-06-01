from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.routers import auth, chat, credits, admin
from app.routers.agentes import orchestrator, elicitador

app = FastAPI(
    title="Espaço IA API",
    version="1.0.0",
    docs_url="/docs" if settings.APP_ENV != "production" else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(chat.router, prefix="/api/v1")
app.include_router(credits.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
app.include_router(orchestrator.router, prefix="/api/v1")
app.include_router(elicitador.router, prefix="/api/v1/agentes")


@app.get("/ping")
async def ping():
    return {"status": "ok", "service": "espaco-ia-api"}
