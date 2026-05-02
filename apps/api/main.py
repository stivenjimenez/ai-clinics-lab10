import logging
from datetime import datetime, timezone
from typing import Literal

from fastapi import BackgroundTasks, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from db import supabase
from openrouter import generate_dossier, generate_insights, generate_roadmap

logger = logging.getLogger("ai-clinics-api")
logging.basicConfig(level=logging.INFO)

app = FastAPI(title="AI Clinics API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- Schemas ----------

ResearchStatus = Literal["pending", "researching", "ready", "failed"]

# Espejo mínimo del catálogo del frontend (`apps/web/src/lib/diagnostic-questions.ts`).
# Lo usamos solo para humanizar los question_id al armar el prompt de insights;
# las preguntas siguen siendo la fuente de verdad en el frontend.
QUESTION_LABELS: dict[str, dict[str, str]] = {
    "pain_point": {
        "title": "Dolor principal",
        "prompt": "¿Cuál es el problema que más les está costando dinero o tiempo hoy?",
    },
    "ai_focus_area": {
        "title": "Área de exploración con IA",
        "prompt": "¿Dónde quieren empezar a aplicar IA primero?",
    },
    "success_metric": {
        "title": "Cómo se mide el éxito",
        "prompt": "¿Qué métrica concreta tendría que moverse para que esto valga la pena?",
    },
}


class ResearchCreate(BaseModel):
    company_name: str = Field(min_length=1)
    website: str | None = None
    linkedin: str | None = None
    notes: str | None = None


class AnswerInput(BaseModel):
    question_id: str = Field(min_length=1, max_length=80)
    answer_text: str = Field(min_length=1)


class AnswersUpsert(BaseModel):
    answers: list[AnswerInput]


# ---------- Background work ----------

async def _run_research(research_id: str, payload: ResearchCreate) -> None:
    """Llama al LLM y persiste el resultado. Corre en BackgroundTasks."""
    logger.info("research %s: starting LLM call", research_id)
    try:
        dossier = await generate_dossier(
            company_name=payload.company_name,
            website=payload.website,
            linkedin=payload.linkedin,
            notes=payload.notes,
        )
        logger.info(
            "research %s: LLM returned dossier with %d keys",
            research_id,
            len(dossier),
        )
        supabase.table("research").update(
            {"status": "ready", "dossier": dossier, "error_message": None}
        ).eq("id", research_id).execute()
        supabase.table("sessions").insert(
            {"research_id": research_id, "status": "draft"}
        ).execute()
        logger.info("research %s: persisted as ready + session created", research_id)
    except Exception as e:
        logger.exception("research %s failed", research_id)
        try:
            supabase.table("research").update(
                {"status": "failed", "error_message": str(e)[:500]}
            ).eq("id", research_id).execute()
        except Exception:
            logger.exception("research %s: also failed to record failure", research_id)


# ---------- Routes ----------

@app.get("/health")
def health():
    return {"status": "ok", "service": "ai-clinics-api"}


@app.get("/research")
def list_research(
    status: ResearchStatus | None = Query(default=None),
    search: str | None = Query(default=None),
):
    query = supabase.table("research").select("*").order("created_at", desc=True)
    if status:
        query = query.eq("status", status)
    if search:
        query = query.ilike("company_name", f"%{search}%")
    res = query.execute()
    return res.data


@app.get("/research/{research_id}")
def get_research(research_id: str):
    res = (
        supabase.table("research")
        .select("*")
        .eq("id", research_id)
        .maybe_single()
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="research not found")
    return res.data


@app.post("/research", status_code=202)
async def create_research(payload: ResearchCreate, background: BackgroundTasks):
    insert = supabase.table("research").insert(
        {
            "company_name": payload.company_name,
            "website": payload.website,
            "linkedin": payload.linkedin,
            "notes": payload.notes,
            "status": "researching",
        }
    ).execute()
    row = insert.data[0]
    background.add_task(_run_research, row["id"], payload)
    return row


# ---------- Sessions ----------

def _session_for_research(research_id: str) -> dict:
    res = (
        supabase.table("sessions")
        .select("*")
        .eq("research_id", research_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="session not found for research")
    return res.data[0]


@app.get("/research/{research_id}/session")
def get_session_for_research(research_id: str):
    return _session_for_research(research_id)


@app.get("/sessions/{session_id}/answers")
def list_answers(session_id: str):
    res = (
        supabase.table("form_answers")
        .select("question_id, answer_text, updated_at")
        .eq("session_id", session_id)
        .execute()
    )
    return res.data


@app.put("/sessions/{session_id}/answers")
def upsert_answers(session_id: str, payload: AnswersUpsert):
    session_res = (
        supabase.table("sessions")
        .select("id, status, started_at")
        .eq("id", session_id)
        .maybe_single()
        .execute()
    )
    if not session_res.data:
        raise HTTPException(status_code=404, detail="session not found")
    session = session_res.data

    if not payload.answers:
        return {"answers": [], "session": session}

    rows = [
        {
            "session_id": session_id,
            "question_id": a.question_id,
            "answer_text": a.answer_text,
        }
        for a in payload.answers
    ]
    upserted = (
        supabase.table("form_answers")
        .upsert(rows, on_conflict="session_id,question_id")
        .execute()
    )

    if session["status"] == "draft":
        update = {"status": "in_progress"}
        if not session.get("started_at"):
            update["started_at"] = datetime.now(timezone.utc).isoformat()
        updated = (
            supabase.table("sessions")
            .update(update)
            .eq("id", session_id)
            .execute()
        )
        if updated.data:
            session = updated.data[0]

    return {"answers": upserted.data, "session": session}


# ---------- Insights ----------

async def _run_insights(session_id: str) -> None:
    """Carga research + answers, llama al LLM y persiste el insight."""
    logger.info("insights %s: starting LLM call", session_id)
    try:
        session_res = (
            supabase.table("sessions")
            .select("id, research_id")
            .eq("id", session_id)
            .maybe_single()
            .execute()
        )
        if not session_res.data:
            raise RuntimeError(f"session {session_id} not found")
        research_id = session_res.data["research_id"]

        research_res = (
            supabase.table("research")
            .select("company_name, dossier")
            .eq("id", research_id)
            .maybe_single()
            .execute()
        )
        if not research_res.data:
            raise RuntimeError(f"research {research_id} not found")
        company_name = research_res.data["company_name"]
        dossier = research_res.data.get("dossier")

        answers_res = (
            supabase.table("form_answers")
            .select("question_id, answer_text")
            .eq("session_id", session_id)
            .execute()
        )
        decorated_answers = [
            {
                "question_id": a["question_id"],
                "title": QUESTION_LABELS.get(a["question_id"], {}).get(
                    "title", a["question_id"]
                ),
                "prompt": QUESTION_LABELS.get(a["question_id"], {}).get("prompt", ""),
                "answer_text": a["answer_text"],
            }
            for a in (answers_res.data or [])
        ]

        payload, model = await generate_insights(
            company_name=company_name,
            dossier=dossier,
            answers=decorated_answers,
        )

        supabase.table("insights").upsert(
            {
                "session_id": session_id,
                "status": "ready",
                "payload": payload,
                "model": model,
                "error_text": None,
                "generated_at": datetime.now(timezone.utc).isoformat(),
            },
            on_conflict="session_id",
        ).execute()
        logger.info("insights %s: persisted as ready (model=%s)", session_id, model)
    except Exception as e:
        logger.exception("insights %s failed", session_id)
        try:
            supabase.table("insights").upsert(
                {
                    "session_id": session_id,
                    "status": "failed",
                    "error_text": str(e)[:500],
                },
                on_conflict="session_id",
            ).execute()
        except Exception:
            logger.exception(
                "insights %s: also failed to record failure", session_id
            )


@app.get("/sessions/{session_id}/insights")
def get_insights(session_id: str):
    res = (
        supabase.table("insights")
        .select("*")
        .eq("session_id", session_id)
        .limit(1)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="insights not found")
    return res.data[0]


@app.post("/sessions/{session_id}/insights/generate", status_code=202)
async def generate_insights_endpoint(
    session_id: str, background: BackgroundTasks
):
    session_res = (
        supabase.table("sessions")
        .select("id")
        .eq("id", session_id)
        .maybe_single()
        .execute()
    )
    if not session_res.data:
        raise HTTPException(status_code=404, detail="session not found")

    upserted = (
        supabase.table("insights")
        .upsert(
            {
                "session_id": session_id,
                "status": "generating",
                "error_text": None,
            },
            on_conflict="session_id",
        )
        .execute()
    )
    background.add_task(_run_insights, session_id)
    return upserted.data[0] if upserted.data else {"session_id": session_id, "status": "generating"}


# ---------- Roadmap ----------

class RoadmapPayloadIn(BaseModel):
    payload: dict


async def _run_roadmap(session_id: str) -> None:
    """Carga research + answers + insights, llama al LLM y persiste el roadmap."""
    logger.info("roadmap %s: starting LLM call", session_id)
    try:
        session_res = (
            supabase.table("sessions")
            .select("id, research_id")
            .eq("id", session_id)
            .maybe_single()
            .execute()
        )
        if not session_res.data:
            raise RuntimeError(f"session {session_id} not found")
        research_id = session_res.data["research_id"]

        research_res = (
            supabase.table("research")
            .select("company_name, dossier")
            .eq("id", research_id)
            .maybe_single()
            .execute()
        )
        if not research_res.data:
            raise RuntimeError(f"research {research_id} not found")
        company_name = research_res.data["company_name"]
        dossier = research_res.data.get("dossier")

        answers_res = (
            supabase.table("form_answers")
            .select("question_id, answer_text")
            .eq("session_id", session_id)
            .execute()
        )
        decorated_answers = [
            {
                "question_id": a["question_id"],
                "title": QUESTION_LABELS.get(a["question_id"], {}).get(
                    "title", a["question_id"]
                ),
                "prompt": QUESTION_LABELS.get(a["question_id"], {}).get("prompt", ""),
                "answer_text": a["answer_text"],
            }
            for a in (answers_res.data or [])
        ]

        insights_res = (
            supabase.table("insights")
            .select("payload, status")
            .eq("session_id", session_id)
            .limit(1)
            .execute()
        )
        insights_payload = None
        if insights_res.data:
            row = insights_res.data[0]
            if row.get("status") == "ready":
                insights_payload = row.get("payload")

        payload, model = await generate_roadmap(
            company_name=company_name,
            dossier=dossier,
            answers=decorated_answers,
            insights=insights_payload,
        )

        supabase.table("roadmaps").upsert(
            {
                "session_id": session_id,
                "status": "ready",
                "payload": payload,
                "model": model,
                "error_text": None,
                "generated_at": datetime.now(timezone.utc).isoformat(),
            },
            on_conflict="session_id",
        ).execute()
        logger.info("roadmap %s: persisted as ready (model=%s)", session_id, model)
    except Exception as e:
        logger.exception("roadmap %s failed", session_id)
        try:
            supabase.table("roadmaps").upsert(
                {
                    "session_id": session_id,
                    "status": "failed",
                    "error_text": str(e)[:500],
                },
                on_conflict="session_id",
            ).execute()
        except Exception:
            logger.exception(
                "roadmap %s: also failed to record failure", session_id
            )


@app.get("/sessions/{session_id}/roadmap")
def get_roadmap(session_id: str):
    res = (
        supabase.table("roadmaps")
        .select("*")
        .eq("session_id", session_id)
        .limit(1)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="roadmap not found")
    return res.data[0]


@app.post("/sessions/{session_id}/roadmap/generate", status_code=202)
async def generate_roadmap_endpoint(
    session_id: str, background: BackgroundTasks
):
    session_res = (
        supabase.table("sessions")
        .select("id")
        .eq("id", session_id)
        .maybe_single()
        .execute()
    )
    if not session_res.data:
        raise HTTPException(status_code=404, detail="session not found")

    upserted = (
        supabase.table("roadmaps")
        .upsert(
            {
                "session_id": session_id,
                "status": "generating",
                "error_text": None,
            },
            on_conflict="session_id",
        )
        .execute()
    )
    background.add_task(_run_roadmap, session_id)
    return (
        upserted.data[0]
        if upserted.data
        else {"session_id": session_id, "status": "generating"}
    )


@app.put("/sessions/{session_id}/roadmap")
def update_roadmap(session_id: str, body: RoadmapPayloadIn):
    """Persiste cambios manuales del payload (drag-to-reposition por ahora)."""
    existing = (
        supabase.table("roadmaps")
        .select("id, status")
        .eq("session_id", session_id)
        .limit(1)
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="roadmap not found")

    updated = (
        supabase.table("roadmaps")
        .update({"payload": body.payload})
        .eq("session_id", session_id)
        .execute()
    )
    return updated.data[0] if updated.data else existing.data[0]
