import json
import logging
import os
from datetime import datetime, timezone
from typing import Any, Literal

from fastapi import BackgroundTasks, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

import sse
from chat_tools import CHAT_TOOLS, build_chat_system_prompt
from db import supabase
from openrouter import (
    generate_dossier,
    generate_insights,
    generate_roadmap,
    stream_chat_completion,
)

logger = logging.getLogger("ai-clinics-api")
logging.basicConfig(level=logging.INFO)

app = FastAPI(title="AI Clinics API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["x-vercel-ai-ui-message-stream"],
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


# ---------- Chat (Etapa 7) ----------

class ChatPostBody(BaseModel):
    """Body que envía `DefaultChatTransport` por defecto.

    Campos: `id` (chatId; usamos session_id), `messages` (UIMessage[] del SDK),
    `trigger` (qué disparó el envío), `messageId` (id del mensaje del LLM).
    """

    id: str | None = None
    messages: list[dict[str, Any]] = Field(default_factory=list)
    trigger: str | None = None
    messageId: str | None = None


def _ui_messages_to_openai(ui_messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Convierte UIMessage[] del Vercel SDK a formato OpenAI Chat Completions
    respetando el contrato estricto del tool calling multi-turn:

        [assistant {tool_calls: [..]}]    ← un assistant separado por cada
        [tool      {tool_call_id, ...}]   ← grupo contiguo de tool parts
        [assistant {content: "ok"}]       ← el texto pos-tools va en su
                                            propio assistant separado.

    Si junto texto y tool_calls en el mismo assistant, el modelo lo lee
    como "tool todavía pendiente" y vuelve a re-emitir el call → bucle.
    """
    out: list[dict[str, Any]] = []
    for msg in ui_messages:
        role = msg.get("role")
        parts = msg.get("parts") or []

        if role == "user":
            text = "".join(
                p.get("text", "")
                for p in parts
                if p.get("type") == "text"
            )
            if text:
                out.append({"role": "user", "content": text})
            continue

        if role != "assistant":
            continue

        # Recorremos parts en orden. Acumulamos texto hasta encontrar tool
        # parts; cuando aparece un grupo de tool parts contiguos, primero
        # cerramos el texto acumulado como assistant, luego emitimos el
        # assistant con tool_calls + los tool messages, y reiniciamos.
        pending_text: list[str] = []
        pending_tool_calls: list[dict[str, Any]] = []
        pending_tool_outputs: list[dict[str, Any]] = []

        def _flush_text() -> None:
            if pending_text:
                txt = "".join(pending_text).strip()
                if txt:
                    out.append({"role": "assistant", "content": txt})
                pending_text.clear()

        def _flush_tools() -> None:
            if pending_tool_calls:
                out.append(
                    {
                        "role": "assistant",
                        "content": None,
                        "tool_calls": pending_tool_calls.copy(),
                    }
                )
                out.extend(pending_tool_outputs)
                pending_tool_calls.clear()
                pending_tool_outputs.clear()

        for p in parts:
            t = p.get("type", "")
            if t == "text":
                # Si veníamos acumulando tools, ciérralas antes del texto.
                _flush_tools()
                pending_text.append(p.get("text", ""))
                continue

            if t.startswith("tool-"):
                # Si veníamos acumulando texto, ciérralo antes de las tools.
                _flush_text()
                tool_name = t[len("tool-"):]
                tool_call_id = p.get("toolCallId")
                state = p.get("state")
                # Solo incluimos tools que ya tienen output (completas). Si
                # quedó alguna en input-available sin output, la omitimos:
                # el modelo no debe verla como "pendiente" porque entonces
                # vuelve a llamarla.
                if state == "output-available":
                    pending_tool_calls.append(
                        {
                            "id": tool_call_id,
                            "type": "function",
                            "function": {
                                "name": tool_name,
                                "arguments": json.dumps(
                                    p.get("input") or {},
                                    ensure_ascii=False,
                                ),
                            },
                        }
                    )
                    pending_tool_outputs.append(
                        {
                            "role": "tool",
                            "tool_call_id": tool_call_id,
                            "content": json.dumps(
                                p.get("output"), ensure_ascii=False
                            ),
                        }
                    )
                # ignoramos input-streaming / input-available / output-error
                # (no son turnos consolidados)

        # Cierre final.
        _flush_text()
        _flush_tools()

    return out


def _load_chat_context(session_id: str) -> dict[str, Any]:
    """Carga el contexto que el system prompt necesita: empresa, dossier,
    insights (si están) y payload del roadmap."""
    session_res = (
        supabase.table("sessions")
        .select("id, research_id")
        .eq("id", session_id)
        .maybe_single()
        .execute()
    )
    if not session_res.data:
        raise HTTPException(status_code=404, detail="session not found")
    research_id = session_res.data["research_id"]

    research_res = (
        supabase.table("research")
        .select("company_name, dossier")
        .eq("id", research_id)
        .maybe_single()
        .execute()
    )
    if not research_res.data:
        raise HTTPException(status_code=404, detail="research not found")

    insights_res = (
        supabase.table("insights")
        .select("payload, status")
        .eq("session_id", session_id)
        .limit(1)
        .execute()
    )
    insights_payload = None
    if insights_res.data and insights_res.data[0].get("status") == "ready":
        insights_payload = insights_res.data[0].get("payload")

    roadmap_res = (
        supabase.table("roadmaps")
        .select("payload, status")
        .eq("session_id", session_id)
        .limit(1)
        .execute()
    )
    roadmap_payload = None
    if roadmap_res.data and roadmap_res.data[0].get("status") == "ready":
        roadmap_payload = roadmap_res.data[0].get("payload")

    return {
        "company_name": research_res.data["company_name"],
        "dossier": research_res.data.get("dossier"),
        "insights": insights_payload,
        "roadmap_payload": roadmap_payload,
    }


def _persist_chat_messages(session_id: str, ui_messages: list[dict[str, Any]]) -> None:
    """Borra el historial de la sesión y reescribe con `ui_messages`. Es
    simple y consistente: el cliente envía el historial completo en cada
    turno, así que la última versión siempre es la verdad. Para volúmenes
    grandes pasaríamos a un upsert por id."""
    if not ui_messages:
        return
    try:
        supabase.table("chat_messages").delete().eq(
            "session_id", session_id
        ).execute()
        rows = [
            {
                "session_id": session_id,
                "role": m.get("role"),
                "parts": m.get("parts") or [],
            }
            for m in ui_messages
        ]
        supabase.table("chat_messages").insert(rows).execute()
    except Exception:
        logger.exception("chat persist failed for session %s", session_id)


@app.get("/sessions/{session_id}/chat")
def get_chat(session_id: str):
    """Devuelve `{ messages: UIMessage[] }` para hidratar `useChat`."""
    res = (
        supabase.table("chat_messages")
        .select("id, role, parts, created_at")
        .eq("session_id", session_id)
        .order("created_at", desc=False)
        .execute()
    )
    messages = [
        {"id": row["id"], "role": row["role"], "parts": row["parts"]}
        for row in (res.data or [])
    ]
    return {"messages": messages}


@app.delete("/sessions/{session_id}/chat", status_code=204)
def reset_chat(session_id: str):
    supabase.table("chat_messages").delete().eq(
        "session_id", session_id
    ).execute()
    return None


@app.post("/sessions/{session_id}/chat")
async def post_chat(session_id: str, body: ChatPostBody):
    """Recibe el último mensaje del usuario, hidrata historial + contexto,
    streamea la respuesta del LLM en formato Vercel Data Stream Protocol v1
    y persiste los mensajes al cerrar el stream."""

    ctx = _load_chat_context(session_id)
    system_prompt = build_chat_system_prompt(
        company_name=ctx["company_name"],
        dossier=ctx["dossier"],
        insights=ctx["insights"],
        roadmap_payload=ctx["roadmap_payload"],
    )

    ui_messages = body.messages or []
    openai_history = _ui_messages_to_openai(ui_messages)
    openai_messages: list[dict[str, Any]] = [
        {"role": "system", "content": system_prompt},
        *openai_history,
    ]

    # Defensa contra bucle: si el último assistant del historial ya tiene
    # tool_calls completos (output disponible), agregamos una nudge muy
    # explícita en system para que el modelo no vuelva a re-llamar la misma
    # tool en este turno y solo responda con texto.
    last_was_tool_round = False
    last_user_idx = -1
    for i in range(len(ui_messages) - 1, -1, -1):
        if ui_messages[i].get("role") == "user":
            last_user_idx = i
            break
    # ¿Hay alguna tool resuelta entre el último user y el final?
    for m in ui_messages[last_user_idx + 1 :]:
        if m.get("role") != "assistant":
            continue
        for p in m.get("parts") or []:
            t = p.get("type", "")
            if (
                isinstance(t, str)
                and t.startswith("tool-")
                and p.get("state") == "output-available"
            ):
                last_was_tool_round = True
                break
        if last_was_tool_round:
            break

    if last_was_tool_round:
        openai_messages.append(
            {
                "role": "system",
                "content": (
                    "Ya aplicaste las tool calls necesarias para el último "
                    "pedido del usuario y los resultados están arriba. NO "
                    "vuelvas a llamar tools en este turno. Responde SOLO con "
                    "una sola frase de confirmación en español, sin describir "
                    "los pasos del roadmap (el canvas ya los muestra)."
                ),
            }
        )

    # Pre-construimos el assistant UIMessage que vamos a reensamblar a
    # medida que emitimos parts. Lo persistimos en `onFinish` (cierre).
    assistant_msg_id = sse.make_message_id()
    assistant_parts: list[dict[str, Any]] = []

    accum_state: dict[str, Any] = {
        "text_buf": "",
        "parts": assistant_parts,
    }

    async def gen():
        try:
            async for chunk in stream_chat_completion(
                messages=openai_messages,
                tools=CHAT_TOOLS,
                model=os.environ.get("OPENROUTER_CHAT_MODEL"),
            ):
                yield chunk
                _accumulate_assistant(chunk, accum_state)

            # Stream cerró. Persistimos historial + nuevo assistant.
            new_assistant: dict[str, Any] = {
                "id": assistant_msg_id,
                "role": "assistant",
                "parts": assistant_parts,
            }
            full = list(ui_messages)
            if assistant_parts:
                full.append(new_assistant)
            _persist_chat_messages(session_id, full)
            yield sse.event_done()
        except Exception as e:
            logger.exception("chat stream failed")
            yield sse.event_error(str(e)[:300])
            yield sse.event_done()

    return StreamingResponse(gen(), headers=sse.UI_STREAM_HEADERS)


def _accumulate_assistant(chunk: str, state: dict[str, Any]) -> None:
    """Parsea cada evento SSE emitido y va construyendo el UIMessage del
    assistant en `state['parts']` para persistirlo al cerrar el stream."""
    if not chunk.startswith("data:"):
        return
    payload = chunk[5:].strip()
    if not payload or payload == "[DONE]":
        return
    try:
        ev = json.loads(payload)
    except json.JSONDecodeError:
        return

    t = ev.get("type")
    parts: list[dict[str, Any]] = state["parts"]

    if t == "text-start":
        state["text_buf"] = ""
    elif t == "text-delta":
        state["text_buf"] = state["text_buf"] + ev.get("delta", "")
    elif t == "text-end":
        if state["text_buf"]:
            parts.append({"type": "text", "text": state["text_buf"]})
        state["text_buf"] = ""
    elif t == "tool-input-available":
        parts.append(
            {
                "type": f"tool-{ev['toolName']}",
                "toolCallId": ev["toolCallId"],
                "state": "input-available",
                "input": ev.get("input") or {},
            }
        )
