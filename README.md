# Espaço IA

Plataforma SaaS de IA para transformação digital.

## Stack

| Camada | Tech |
|--------|------|
| Frontend | Next.js 14 + TypeScript + Tailwind |
| Backend | FastAPI + Python 3.11 |
| Banco | PostgreSQL (Railway em prod, Docker em dev) |
| IA | Claude API (Anthropic) |
| Pagamentos | Stripe |
| Frontend deploy | Vercel |
| Backend deploy | Railway |

---

## Dev local (Docker Compose)

```bash
# 1. Clone e configure env
cp .env.example .env
# edite .env com suas chaves

# 2. Sobe tudo
docker compose up

# Frontend:  http://localhost:3000
# Backend:   http://localhost:8000
# API Docs:  http://localhost:8000/docs
```

### Sem Docker

**Backend:**
```bash
cd backend
python -m venv .venv && .venv/Scripts/activate  # Windows
pip install -r requirements.txt
cp .env.example .env  # editar
alembic upgrade head
uvicorn app.main:app --reload
```

**Frontend:**
```bash
cd frontend
npm install
cp .env.local.example .env.local  # editar
npm run dev
```

---

## Deploy

### Backend → Railway

1. railway.app → New Project → Deploy from GitHub
2. Root Directory: `backend`
3. Railway detecta Dockerfile automaticamente
4. Add Service → Database → PostgreSQL
5. Variáveis de ambiente:

```
DATABASE_URL=postgresql+asyncpg://...   ← gerado pelo Railway Postgres
SECRET_KEY=<openssl rand -hex 32>
APP_ENV=production
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-6
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
FRONTEND_URL=https://[seu-projeto].vercel.app
```

6. Start command (migrations automáticas):
```
alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Frontend → Vercel

1. vercel.com → New Project → Import from GitHub
2. Root Directory: `frontend`
3. Variáveis de ambiente:

```
NEXT_PUBLIC_API_URL=https://[seu-projeto].railway.app/api/v1
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

4. Deploy

### Health check

```bash
curl https://[seu-projeto].railway.app/ping
# {"status":"ok","service":"espaco-ia-api"}
```

---

## Estrutura

```
espaco-ia/
├── backend/           # FastAPI + SQLAlchemy + Alembic
│   ├── app/
│   │   ├── core/      # config, database, security
│   │   ├── models/    # SQLAlchemy models
│   │   ├── routers/   # endpoints por domínio
│   │   │   └── agentes/  # elicitador, orchestrator
│   │   ├── schemas/   # Pydantic schemas
│   │   ├── services/  # lógica (llm.py = Claude API)
│   │   └── repositories/
│   ├── alembic/       # migrations
│   └── Dockerfile
├── frontend/          # Next.js 14 App Router
│   └── src/
│       ├── app/       # páginas (auth + dashboard)
│       ├── components/
│       ├── services/  # chamadas à API
│       ├── store/     # Zustand (auth)
│       └── types/
├── docker-compose.yml
└── .env.example
```

---

## Módulos

- **Chat IA** — Claude Sonnet via streaming SSE (10 créditos/msg)
- **Engenharia de Requisitos** — 4 agentes: Elicitador → Analisador → Validador → Documentador
- **Créditos** — sistema pay-as-you-go com Stripe Checkout
- **Admin** — gestão de usuários e ajuste de créditos
