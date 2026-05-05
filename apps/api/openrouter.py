"""Cliente mínimo de OpenRouter usado para generar el dossier de research
y los insights del diagnóstico.

Usamos `httpx` directamente (sin SDK) porque OpenRouter expone una API compatible
con OpenAI Chat Completions y solo necesitamos `response_format` con JSON Schema.
"""

import json
import logging
import os
from typing import Any

import httpx

OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"

# Modelos fijos — cambiarlos aquí cuando se quiera actualizar.
DOSSIER_MODEL = "openai/gpt-5.5:online"   # usa búsqueda web para investigar la empresa
ANALYSIS_MODEL = "openai/gpt-5.5"         # insights, roadmap y chat (sin búsqueda web)

log = logging.getLogger("ai-clinics-api")

# Schema obligatorio del dossier que devuelve el LLM. Lo usamos como
# `response_format.json_schema` para forzar salida estructurada.
DOSSIER_JSON_SCHEMA: dict[str, Any] = {
    "name": "company_dossier",
    "strict": True,
    "schema": {
        "type": "object",
        "additionalProperties": False,
        "required": ["summary"],
        "properties": {
            "summary": {
                "type": "string",
                "description": (
                    "Resumen factual de qué es la empresa: a qué se dedica, productos "
                    "o servicios, mercado, presencia, datos relevantes encontrables en "
                    "internet. Sin hipótesis sobre dolores, oportunidades ni "
                    "recomendaciones — eso se trabaja después en la sesión."
                ),
            },
        },
    },
}


SYSTEM_PROMPT = """Eres un analista de Lab10 investigando una empresa antes de una sesión \
de diagnóstico de IA de 30 minutos durante el AI Summit LATAM.

Tu tarea: escribir un resumen factual de la empresa que sirva como contexto para \
identificar cómo la IA puede resolver sus principales problemas de negocio.

Reglas:
- Solo información encontrable en internet (sitio, LinkedIn, prensa, etc.). Cuando \
  uses búsqueda web, úsala para encontrar datos reales y recientes.
- Cubre: a qué se dedica, productos/servicios principales, mercado/geografía, \
  tamaño aproximado si es público, modelo de negocio (cómo genera dinero), y \
  procesos operativos clave donde la IA podría tener impacto (ventas, operaciones, \
  atención al cliente, logística, datos, etc.).
- Si un dato no se puede confirmar, omítelo. No inventes.
- Formato: texto en prosa, 4–8 frases, denso y útil. Sin listas ni bullets.
- Idioma: español (LATAM).
"""


def build_user_prompt(
    *,
    company_name: str,
    website: str | None,
    linkedin: str | None,
    notes: str | None,
) -> str:
    lines = [f"Empresa: {company_name}"]
    if website:
        lines.append(f"Sitio web: {website}")
    if linkedin:
        lines.append(f"LinkedIn: {linkedin}")
    if notes:
        lines.append(f"Observaciones del facilitador: {notes}")
    lines.append(
        "\nInvestiga la empresa en internet y devuelve únicamente un `summary` de "
        "4–8 frases en prosa: qué hace, productos/servicios, mercado y datos "
        "relevantes. No incluyas hipótesis ni recomendaciones."
    )
    return "\n".join(lines)


async def generate_dossier(
    *,
    company_name: str,
    website: str | None = None,
    linkedin: str | None = None,
    notes: str | None = None,
) -> dict[str, Any]:
    """Llama a OpenRouter y devuelve el dossier ya parseado como dict."""
    api_key = os.environ["OPENROUTER_API_KEY"]
    model = DOSSIER_MODEL

    headers = _build_headers(api_key)
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": build_user_prompt(
                    company_name=company_name,
                    website=website,
                    linkedin=linkedin,
                    notes=notes,
                ),
            },
        ],
        "response_format": {
            "type": "json_schema",
            "json_schema": DOSSIER_JSON_SCHEMA,
        },
    }

    return await _call_openrouter(model=model, headers=headers, payload=payload)


# =====================================================================
# Insights (Etapa 4)
# =====================================================================

ADOPTION_RUBRIC = """Rúbrica de adopción de IA (escala 1 a 5):
1 = SIN ADOPCIÓN. No usan IA en ningún proceso. Operación 100% manual o con \
herramientas tradicionales.
2 = INICIAL. Uso esporádico de IA por individuos (ej. ChatGPT puntual). Sin \
procesos formales, sin métricas, sin governance.
3 = EN DESARROLLO. Uno o dos casos de uso productivos con resultados medibles. \
Equipo identificado, primeros KPIs, integración parcial con sistemas internos.
4 = CONSOLIDADO. Múltiples casos de uso en producción con ROI demostrado. \
Governance, MLOps básico, datos integrados, equipo dedicado.
5 = IA-NATIVO. La IA es parte del producto/operación core. Cultura data/AI-first, \
plataforma propia, mejora continua basada en datos."""

INSIGHTS_JSON_SCHEMA: dict[str, Any] = {
    "name": "session_insights",
    "strict": True,
    "schema": {
        "type": "object",
        "additionalProperties": False,
        "required": [
            "executive_summary",
            "pain_point",
            "ai_adoption",
            "opportunities",
        ],
        "properties": {
            "executive_summary": {
                "type": "string",
                "description": (
                    "2-3 frases que sinteticen el momento de la empresa frente a IA: "
                    "qué tienen, qué les falta y qué tipo de solución de IA es más "
                    "adecuada para su problema. Tono ejecutivo, sin jerga, en español (LATAM)."
                ),
            },
            "pain_point": {
                "type": "string",
                "description": (
                    "1-2 frases nombrando con precisión el dolor más costoso o "
                    "frecuente. Si hay una métrica concreta en las respuestas, úsala."
                ),
            },
            "ai_adoption": {
                "type": "object",
                "additionalProperties": False,
                "required": ["level"],
                "properties": {
                    "level": {
                        "type": "integer",
                        "description": (
                            "Nivel de madurez en adopción de IA, entero de 1 a 5 "
                            "según la rúbrica del system prompt. 1 = sin adopción; "
                            "5 = IA-nativo."
                        ),
                    },
                },
            },
            "opportunities": {
                "type": "array",
                "description": (
                    "Exactamente 3 oportunidades de aplicación de IA, en cualquier "
                    "formato o categoría que mejor resuelva el dolor de la empresa."
                ),
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["title", "description"],
                    "properties": {
                        "title": {
                            "type": "string",
                            "description": "Nombre corto de la solución (≤ 8 palabras), en español.",
                        },
                        "description": {
                            "type": "string",
                            "description": (
                                "1-2 frases concretas: qué sistema de IA resuelve qué "
                                "parte del proceso, usando los datos y herramientas que "
                                "la empresa ya tiene. En español."
                            ),
                        },
                    },
                },
            },
        },
    },
}


INSIGHTS_SYSTEM_PROMPT = """Eres un consultor senior de Lab10 cerrando una sesión de diagnóstico \
de IA de 30 minutos durante el AI Summit LATAM.

Tienes:
1. El dossier factual de la empresa (qué hace, mercado, productos, procesos clave).
2. Las respuestas del ejecutivo: cuánto cuesta el dolor, cómo lo resuelven hoy paso a paso, \
   qué datos tienen disponibles, qué herramientas de IA ya tienen acceso, intentos previos \
   y la métrica que tendría que moverse en 30 días.

Tu tarea: identificar exactamente 3 oportunidades concretas de aplicación de IA \
que resuelvan el dolor de esta empresa, usando los datos y herramientas que YA tienen.

# Tipos de oportunidad que puedes usar (referencia, NO obligatorio):
- **Contenido**: IA que genera u optimiza texto, imágenes, copy, fichas, reportes \
  (ej. optimizar fichas en Rappi con ChatGPT, guiones de venta personalizados).
- **Agentes**: bots o automatizaciones que ejecutan tareas repetitivas o responden a \
  eventos (ej. flujo en Make que detecta clientes inactivos, bot que califica leads).
- **Software con IA**: modelos predictivos, recomendadores, clasificadores integrados al \
  producto core (ej. predictor de churn, recomendador de upsell en el POS).

No estás obligado a cubrir las 3 categorías ni a un orden específico. Elige las 3 \
oportunidades que mejor resuelvan el dolor concreto que mencionó el ejecutivo.

# Qué oportunidad se convierte en el roadmap de 30 días:
El roadmap que se genera después usará la oportunidad más factible en 30 días \
(idealmente algo tipo agente o contenido) como base del plan de implementación.

Reglas duras:
- Exactamente 3 oportunidades.
- Cada oportunidad nombra la tecnología concreta (LLM, Make, clasificador, etc.) y \
  el proceso específico que resuelve, usando los datos y herramientas que la empresa YA tiene.
- Si una respuesta menciona una métrica concreta, úsala en `pain_point` o `executive_summary`.
- No inventes datos que no estén en el dossier o las respuestas.
- Idioma de los VALORES: español (LATAM). Tono ejecutivo, denso, sin jerga vacía.

{rubric}
""".replace("{rubric}", ADOPTION_RUBRIC)


def _build_insights_user_prompt(
    *,
    company_name: str,
    dossier: dict[str, Any] | None,
    answers: list[dict[str, str]],
) -> str:
    lines = [f"Empresa: {company_name}", ""]
    if dossier and dossier.get("summary"):
        lines.append("# Dossier (research previo)")
        lines.append(dossier["summary"])
        lines.append("")

    lines.append("# Respuestas del ejecutivo")
    if not answers:
        lines.append("(sin respuestas registradas)")
    else:
        for a in answers:
            title = a.get("title") or a.get("question_id")
            prompt = a.get("prompt")
            text = a.get("answer_text", "").strip()
            lines.append(f"- **{title}**")
            if prompt:
                lines.append(f"  Pregunta: {prompt}")
            lines.append(f"  Respuesta: {text or '(en blanco)'}")
    lines.append("")
    lines.append(
        "Devuelve únicamente el JSON con la estructura del esquema. Sin texto extra."
    )
    return "\n".join(lines)


async def generate_insights(
    *,
    company_name: str,
    dossier: dict[str, Any] | None,
    answers: list[dict[str, str]],
) -> tuple[dict[str, Any], str]:
    """Llama al LLM y devuelve (payload, model_id) listos para persistir."""
    api_key = os.environ["OPENROUTER_API_KEY"]
    model = ANALYSIS_MODEL

    headers = _build_headers(api_key)
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": INSIGHTS_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": _build_insights_user_prompt(
                    company_name=company_name,
                    dossier=dossier,
                    answers=answers,
                ),
            },
        ],
        "response_format": {
            "type": "json_schema",
            "json_schema": INSIGHTS_JSON_SCHEMA,
        },
    }

    parsed = await _call_openrouter(model=model, headers=headers, payload=payload)
    return parsed, model


# =====================================================================
# Roadmap (Etapa 5)
# =====================================================================

ROADMAP_JSON_SCHEMA: dict[str, Any] = {
    "name": "session_roadmap",
    "strict": True,
    "schema": {
        "type": "object",
        "additionalProperties": False,
        "required": ["nodes", "edges"],
        "properties": {
            "nodes": {
                "type": "array",
                "description": (
                    "Secuencia lineal del plan de implementación de IA. "
                    "Exactamente UN nodo type='problem' al inicio. "
                    "Luego entre 3 y 6 nodos type='step'. "
                    "Exactamente UN nodo type='result' al final."
                ),
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["id", "type", "data", "position"],
                    "properties": {
                        "id": {
                            "type": "string",
                            "description": (
                                "Slug corto y único dentro del roadmap: "
                                "'problem' para el problema, 's1', 's2', ... "
                                "para los pasos, 'result' para el nodo final."
                            ),
                        },
                        "type": {
                            "type": "string",
                            "enum": ["problem", "step", "result"],
                            "description": (
                                "'problem': el dolor de negocio a resolver, 1 solo. "
                                "'step': paso de implementación de IA concreto y ejecutable. "
                                "'result': nodo final único con el impacto medible logrado."
                            ),
                        },
                        "data": {
                            "type": "object",
                            "additionalProperties": False,
                            "required": ["title", "description"],
                            "properties": {
                                "title": {
                                    "type": "string",
                                    "description": (
                                        "Título corto en español (≤ 9 palabras). "
                                        "Específico, accionable, sin jerga vacía."
                                    ),
                                },
                                "description": {
                                    "type": "string",
                                    "description": (
                                        "Una sola frase en español que explique "
                                        "qué se hace o se logra. Sin enumerar pasos "
                                        "internos."
                                    ),
                                },
                            },
                        },
                        "position": {
                            "type": "object",
                            "additionalProperties": False,
                            "required": ["x", "y"],
                            "properties": {
                                "x": {"type": "number"},
                                "y": {"type": "number"},
                            },
                            "description": (
                                "Posición inicial; el frontend recalcula el "
                                "layout. Usa {x: 0, y: 0} para todos."
                            ),
                        },
                    },
                },
            },
            "edges": {
                "type": "array",
                "description": (
                    "Cadena lineal: el nodo problem conecta al primer paso, "
                    "luego cada paso conecta al siguiente. Sin ramas, sin ciclos."
                ),
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["id", "source", "target"],
                    "properties": {
                        "id": {"type": "string"},
                        "source": {"type": "string"},
                        "target": {"type": "string"},
                    },
                },
            },
        },
    },
}


ROADMAP_SYSTEM_PROMPT = """Eres un consultor senior de Lab10 que acaba de cerrar \
una sesión de diagnóstico con un ejecutivo. Tu trabajo es diseñar un plan de \
implementación de IA de 30 días para resolver su problema.

Tienes:
1. El dossier de la empresa (operaciones, mercado, modelo de negocio).
2. Las respuestas del ejecutivo (dolor cuantificado, proceso actual, datos disponibles, \
   herramientas de IA que ya tienen, intentos previos, métrica en 30 días).
3. Los insights con: dolor principal, nivel de adopción, y 3 oportunidades concretas \
   de aplicación de IA.

El roadmap debe implementar la oportunidad más factible en 30 días \
(la que se pueda construir con agentes, automatización o contenido — no con software a medida).

ESTRUCTURA OBLIGATORIA del JSON (`nodes` y `edges`):
- 1 nodo `problem`: el dolor con el número concreto del diagnóstico.
- 4 nodos `step`: uno por semana del mes. Cada uno lleva el prefijo "Semana N —" en el título.
- 1 nodo `result`: la solución sintetizada — describe el proceso YA transformado con IA.

LOS 4 STEPS — una semana por paso:
- **Semana 1 —** preparación: exportar datos, limpiar, estructurar, acceder a las APIs.
- **Semana 2 —** construcción: crear el prompt, configurar el flujo en Make/n8n, \
  conectar la herramienta de IA a los datos.
- **Semana 3 —** prueba: piloto controlado con datos reales, validar salida, ajustar.
- **Semana 4 —** despliegue: activar en el proceso real, conectar al POS/CRM/WhatsApp, \
  instrumentar la métrica.

EL NODO `result`:
Sintetiza la solución implementada en 1-2 frases. No es un paso más — es el estado final:
el proceso transformado con IA funcionando y la métrica del ejecutivo en movimiento.
Ejemplo: "Agente de sugerencias activo en el POS — upsell pasa del 12% al 20%."

REGLAS DURAS:
- Títulos de `step`: empiezan con "Semana 1 —", "Semana 2 —", etc. ≤ 9 palabras total.
- Cada `step` nombra la herramienta concreta que el ejecutivo ya tiene. \
  PROHIBIDO: explorar, evaluar, considerar.
- `result` sintetiza la solución + la métrica cumplida. Tono de logro, no de tarea.
- Cadena lineal: problem → s1 → s2 → s3 → s4 → result. Sin ramas. Sin ciclos.
- IDs: 'problem', 's1', 's2', 's3', 's4', 'result'. \
  Edges: 'e0' (problem→s1), 'e1' (s1→s2), 'e2' (s2→s3), 'e3' (s3→s4), 'e4' (s4→result).
- Posiciones: `{x: 0, y: 0}` en todos. El frontend recalcula el layout.
- Idioma de los VALORES: español (LATAM). Las CLAVES están fijadas por el schema.
- No inventes datos que no estén en el dossier, respuestas o insights.

Devuelve únicamente el JSON con la estructura del schema. Sin texto extra.
"""


def _build_roadmap_user_prompt(
    *,
    company_name: str,
    dossier: dict[str, Any] | None,
    answers: list[dict[str, str]],
    insights: dict[str, Any] | None,
) -> str:
    lines = [f"Empresa: {company_name}", ""]

    if dossier and dossier.get("summary"):
        lines.append("# Dossier")
        lines.append(dossier["summary"])
        lines.append("")

    lines.append("# Respuestas del ejecutivo")
    if not answers:
        lines.append("(sin respuestas registradas)")
    else:
        for a in answers:
            title = a.get("title") or a.get("question_id")
            text = (a.get("answer_text") or "").strip()
            lines.append(f"- **{title}**: {text or '(en blanco)'}")
    lines.append("")

    lines.append("# Insights ya generados")
    if insights:
        lines.append(json.dumps(insights, ensure_ascii=False, indent=2))
    else:
        lines.append("(sin insights — produce el roadmap solo con dossier + respuestas)")
    lines.append("")

    lines.append(
        "Devuelve únicamente el JSON con la estructura del schema. Sin texto extra."
    )
    return "\n".join(lines)


async def generate_roadmap(
    *,
    company_name: str,
    dossier: dict[str, Any] | None,
    answers: list[dict[str, str]],
    insights: dict[str, Any] | None,
) -> tuple[dict[str, Any], str]:
    """Llama al LLM y devuelve (payload, model_id) listos para persistir."""
    api_key = os.environ["OPENROUTER_API_KEY"]
    model = ANALYSIS_MODEL

    headers = _build_headers(api_key)
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": ROADMAP_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": _build_roadmap_user_prompt(
                    company_name=company_name,
                    dossier=dossier,
                    answers=answers,
                    insights=insights,
                ),
            },
        ],
        "response_format": {
            "type": "json_schema",
            "json_schema": ROADMAP_JSON_SCHEMA,
        },
    }

    parsed = await _call_openrouter(model=model, headers=headers, payload=payload)
    return parsed, model


# =====================================================================
# Chat streaming (Etapa 7) — emite Vercel Data Stream Protocol v1
# =====================================================================

import sse  # noqa: E402

# Iteraciones máximas del loop tool-calling antes de cortar (defensa).
MAX_TOOL_ROUNDS = 5


async def stream_chat_completion(
    *,
    messages: list[dict[str, Any]],
    tools: list[dict[str, Any]],
    model: str | None = None,
):
    """Itera el loop de chat con OpenRouter (stream + tools) y emite eventos
    del Vercel AI SDK Data Stream Protocol v1 como strings listos para SSE.

    Args:
        messages: historial OpenAI-style ya completo (incluye system + user
            + assistants previos + tool results).
        tools: array de tools en formato OpenAI (`{type:"function", ...}`).
        model: id del modelo. Default `ANALYSIS_MODEL`.

    Yields:
        Strings con eventos SSE listos para escribir en la respuesta. Cada
        string ya termina con `\\n\\n`. NO incluye el `[DONE]` final — eso
        lo emite el endpoint para tener control sobre la persistencia.

    Si el modelo emite tool_calls, se interrumpe el stream y se devuelven
    los `tool_calls` pendientes en una excepción especial. El cliente
    (vía `useChat.onToolCall` + `addToolOutput`) los ejecuta y vuelve a
    POSTear con el tool_result; ese siguiente request entra acá con un
    historial extendido y el modelo puede seguir.
    """
    api_key = os.environ["OPENROUTER_API_KEY"]
    chosen_model = model or ANALYSIS_MODEL

    headers = _build_headers(api_key)
    payload: dict[str, Any] = {
        "model": chosen_model,
        "messages": messages,
        "tools": tools,
        "stream": True,
    }

    message_id = sse.make_message_id()
    yield sse.event_start(message_id)

    # Estado para reensamblar tool_calls fragmentados (vienen por `index`).
    text_part_id: str | None = None
    tool_calls_buf: dict[int, dict[str, Any]] = {}
    tool_input_started: dict[int, bool] = {}

    timeout = httpx.Timeout(120.0, connect=10.0)
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            async with client.stream(
                "POST", OPENROUTER_API_URL, headers=headers, json=payload
            ) as res:
                if res.status_code >= 400:
                    body = await res.aread()
                    log.error(
                        "openrouter chat (%s) %s: %s",
                        chosen_model,
                        res.status_code,
                        body[:500],
                    )
                    yield sse.event_error(
                        f"openrouter {res.status_code}"
                    )
                    return

                async for raw_line in res.aiter_lines():
                    if not raw_line:
                        continue
                    if not raw_line.startswith("data:"):
                        continue
                    data_str = raw_line[5:].strip()
                    if not data_str:
                        continue
                    if data_str == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data_str)
                    except json.JSONDecodeError:
                        log.warning("openrouter chunk not JSON: %r", data_str[:200])
                        continue

                    choice = (chunk.get("choices") or [{}])[0]
                    delta = choice.get("delta") or {}

                    # 1) Texto plano
                    text_delta = delta.get("content")
                    if text_delta:
                        if text_part_id is None:
                            text_part_id = sse.make_text_part_id()
                            yield sse.event_text_start(text_part_id)
                        yield sse.event_text_delta(text_part_id, text_delta)

                    # 2) Tool calls fragmentados
                    for tc in delta.get("tool_calls") or []:
                        idx = tc.get("index", 0)
                        buf = tool_calls_buf.setdefault(
                            idx,
                            {
                                "id": None,
                                "name": None,
                                "args": "",
                            },
                        )
                        if tc.get("id"):
                            buf["id"] = tc["id"]
                        fn = tc.get("function") or {}
                        if fn.get("name"):
                            buf["name"] = fn["name"]
                        if fn.get("arguments"):
                            buf["args"] += fn["arguments"]

                        # Empezar el part en cuanto sepamos id+name
                        if (
                            buf["id"]
                            and buf["name"]
                            and not tool_input_started.get(idx)
                        ):
                            tool_input_started[idx] = True
                            yield sse.event_tool_input_start(
                                buf["id"], buf["name"]
                            )

                        if (
                            tool_input_started.get(idx)
                            and fn.get("arguments")
                        ):
                            yield sse.event_tool_input_delta(
                                buf["id"], fn["arguments"]
                            )

                    finish_reason = choice.get("finish_reason")
                    if finish_reason == "tool_calls":
                        # Cerrar text part si quedó abierto.
                        if text_part_id is not None:
                            yield sse.event_text_end(text_part_id)
                            text_part_id = None
                        # Emitir `tool-input-available` con el JSON parseado
                        # para que el cliente arranque `onToolCall`.
                        for idx, buf in sorted(tool_calls_buf.items()):
                            try:
                                parsed = json.loads(buf["args"] or "{}")
                            except json.JSONDecodeError as e:
                                log.error(
                                    "tool args not JSON for %s: %r",
                                    buf.get("name"),
                                    buf.get("args"),
                                )
                                yield sse.event_error(
                                    f"tool args parse error: {e}"
                                )
                                continue
                            yield sse.event_tool_input_available(
                                buf["id"], buf["name"], parsed
                            )
                        # No emitimos `finish` acá: el turno cierra cuando
                        # el cliente reenvíe el tool_result en otro POST.
                        # Solo cerramos este HTTP stream.
                        return

                    if finish_reason in ("stop", "length", "content_filter"):
                        if text_part_id is not None:
                            yield sse.event_text_end(text_part_id)
                            text_part_id = None
                        yield sse.event_finish()
                        return

        # Stream terminó sin finish_reason explícito.
        if text_part_id is not None:
            yield sse.event_text_end(text_part_id)
        yield sse.event_finish()
    except Exception as e:  # pragma: no cover
        log.exception("stream_chat_completion failed")
        yield sse.event_error(str(e)[:300])


# =====================================================================
# Internals
# =====================================================================

def _build_headers(api_key: str) -> dict[str, str]:
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    if app_url := os.environ.get("OPENROUTER_APP_URL"):
        headers["HTTP-Referer"] = app_url.encode("ascii", "ignore").decode("ascii")
    if app_name := os.environ.get("OPENROUTER_APP_NAME"):
        headers["X-Title"] = app_name.encode("ascii", "ignore").decode("ascii")
    return headers


async def _call_openrouter(
    *,
    model: str,
    headers: dict[str, str],
    payload: dict[str, Any],
) -> dict[str, Any]:
    timeout = httpx.Timeout(120.0, connect=10.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        res = await client.post(OPENROUTER_API_URL, headers=headers, json=payload)
        if res.status_code >= 400:
            log.error(
                "openrouter (%s) %s: %s",
                model,
                res.status_code,
                res.text[:1000],
            )
            raise RuntimeError(
                f"openrouter {res.status_code}: {res.text[:300]}"
            )
        data = res.json()

    try:
        content = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError) as e:
        log.error("openrouter (%s): unexpected response shape: %s", model, data)
        raise RuntimeError(f"unexpected OpenRouter response: {e}") from e

    try:
        return json.loads(content)
    except json.JSONDecodeError as e:
        log.error(
            "openrouter (%s): content is not valid JSON. content=%r",
            model,
            content[:500],
        )
        raise RuntimeError(f"OpenRouter returned non-JSON content: {e}") from e
