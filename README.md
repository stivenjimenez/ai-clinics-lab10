# AI Clinics — Lab10

Web app asistida por IA para que Lab10 ofrezca diagnósticos de adopción de IA en sesiones cortas durante el AI Summit. El facilitador guía la conversación, el sistema construye un roadmap personalizado en vivo, y el ejecutivo se va con un entregable accionable.

## Stack

- **Frontend** (`apps/web`): Next.js 16 + TypeScript + CSS Modules
- **Backend** (`apps/api`): FastAPI + Python 3
- **DB**: Supabase Postgres + pgvector
- **Deploy**: Vercel (web) + Railway (api)

## Estructura

```
ai-clinics-lab10/
├── apps/
│   ├── web/        # Next.js (App Router)
│   └── api/        # FastAPI
└── README.md
```

## Desarrollo local

### Frontend

```bash
cd apps/web
pnpm install
pnpm dev
```

Disponible en `http://localhost:3000`.

### Backend

```bash
cd apps/api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Disponible en `http://localhost:8000`. Healthcheck en `/health`.

## Variables de entorno

Copiar `apps/api/.env.example` a `apps/api/.env` y completar las credenciales de Supabase.
