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

Tu tarea en este paso es ÚNICA: escribir un resumen factual de la empresa que sirva \
como insumo para preguntas posteriores. NO propongas dolores, oportunidades, ni \
recomendaciones — eso lo descubrimos en la sesión con el ejecutivo.

Reglas:
- Solo información encontrable en internet (sitio, LinkedIn, prensa, etc.). Cuando \
  uses búsqueda web, úsala para encontrar datos reales y recientes.
- Cubre: a qué se dedica, productos/servicios principales, mercado/geografía, \
  tamaño aproximado si es público, datos diferenciales o de contexto que ayuden a \
  conectar la conversación.
- Si un dato no se puede confirmar, omítelo. No inventes. No supongas dolores.
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
    model = os.environ.get("OPENROUTER_MODEL", "openai/gpt-5:online")

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
            "resumen_ejecutivo",
            "dolor_principal",
            "adopcion_ia",
            "oportunidades",
            "recomendaciones_iniciales",
        ],
        "properties": {
            "resumen_ejecutivo": {
                "type": "string",
                "description": (
                    "2-3 frases que sinteticen el momento de la empresa frente a IA: "
                    "qué tienen, qué les falta y qué primer paso es razonable. Tono "
                    "ejecutivo, sin jerga, en español (LATAM)."
                ),
            },
            "dolor_principal": {
                "type": "string",
                "description": (
                    "1-2 frases nombrando con precisión el dolor más costoso o "
                    "frecuente. Si hay una métrica concreta en las respuestas, úsala."
                ),
            },
            "adopcion_ia": {
                "type": "object",
                "additionalProperties": False,
                "required": ["nivel"],
                "properties": {
                    "nivel": {
                        "type": "integer",
                        "description": (
                            "Nivel de madurez en adopción de IA, entero de 1 a 5 "
                            "según la rúbrica del system prompt. 1 = sin adopción; "
                            "5 = IA-nativo."
                        ),
                    },
                },
            },
            "oportunidades": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["titulo", "descripcion", "impacto", "esfuerzo"],
                    "properties": {
                        "titulo": {
                            "type": "string",
                            "description": "Nombre corto de la oportunidad (≤ 8 palabras).",
                        },
                        "descripcion": {
                            "type": "string",
                            "description": (
                                "1-2 frases que conecten la oportunidad con el dolor "
                                "y/o el contexto de la empresa."
                            ),
                        },
                        "impacto": {
                            "type": "string",
                            "enum": ["alto", "medio", "bajo"],
                        },
                        "esfuerzo": {
                            "type": "string",
                            "enum": ["alto", "medio", "bajo"],
                        },
                    },
                },
            },
            "recomendaciones_iniciales": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["orden", "texto"],
                    "properties": {
                        "orden": {
                            "type": "integer",
                            "description": "Posición 1..N en la secuencia de recomendaciones.",
                        },
                        "texto": {
                            "type": "string",
                            "description": (
                                "Recomendación accionable, en una frase. Sin verbos "
                                "vagos ('explorar', 'considerar'); preferir 'definir', "
                                "'medir', 'piloto de'."
                            ),
                        },
                    },
                },
            },
        },
    },
}


INSIGHTS_SYSTEM_PROMPT = """Eres un consultor senior de Lab10 cerrando una sesión de diagnóstico de IA \
de 30 minutos durante el AI Summit LATAM. Acabas de leer:

1. El dossier factual de la empresa (qué hace, mercado, productos).
2. Las respuestas del ejecutivo a 3 preguntas: dolor principal, área donde quieren \
   empezar con IA, y métrica de éxito.

Tu tarea: producir un objeto JSON con insights iniciales que el facilitador validará \
con el ejecutivo en vivo. NO es el entregable final; es insumo para una conversación.

Reglas duras:
- Conecta SIEMPRE las oportunidades y recomendaciones con el dolor y/o las respuestas. \
  Nada genérico tipo "implementar IA para mejorar procesos".
- Si una respuesta menciona una métrica concreta (NPS, tickets, costo, tiempo), úsala \
  textualmente en `dolor_principal` o `resumen_ejecutivo`.
- No inventes datos que no estén en el dossier o las respuestas. Si algo no está, no \
  lo afirmes.
- Idioma: español (LATAM). Tono ejecutivo, denso, sin jerga vacía.
- Recomendaciones: verbos accionables ("definir KPIs", "lanzar piloto de…", "medir…"). \
  Evita "explorar", "considerar", "evaluar la posibilidad de".
- Cantidades: 3 a 5 oportunidades, 3 a 5 recomendaciones. Numera las recomendaciones \
  desde 1 en `orden`, sin saltos.

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
    # Para insights no necesitamos `:online`: trabajamos sobre el dossier y las
    # respuestas, no con búsqueda web. Si no se setea, caemos a un default sin sufijo.
    model = os.environ.get(
        "OPENROUTER_INSIGHTS_MODEL",
        os.environ.get("OPENROUTER_MODEL", "openai/gpt-5").replace(":online", ""),
    )

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
