from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from db import supabase

app = FastAPI(title="AI Clinics API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- Schemas ----------

class CompanyCreate(BaseModel):
    name: str
    website: str | None = None
    industry: str | None = None


# ---------- Routes ----------

@app.get("/health")
def health():
    return {"status": "ok", "service": "ai-clinics-api"}


@app.get("/companies")
def list_companies():
    res = supabase.table("companies").select("*").order("created_at", desc=True).execute()
    return res.data


@app.post("/companies", status_code=201)
def create_company(payload: CompanyCreate):
    try:
        res = supabase.table("companies").insert(payload.model_dump()).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return res.data[0]
