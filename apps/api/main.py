import logging
from typing import Literal

from fastapi import BackgroundTasks, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from db import supabase
from openrouter import generate_dossier

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


class ResearchCreate(BaseModel):
    company_name: str = Field(min_length=1)
    website: str | None = None
    linkedin: str | None = None
    notes: str | None = None


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
