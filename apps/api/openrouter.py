"""Cliente mínimo de OpenRouter usado para generar el dossier de research.

Usamos `httpx` directamente (sin SDK) porque OpenRouter expone una API compatible
con OpenAI Chat Completions y solo necesitamos `response_format` con JSON Schema.
"""

import os
from typing import Any

import httpx

OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"

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

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    # OpenRouter recomienda estos headers para identificar la app.
    # HTTP headers son latin-1: forzamos ASCII para evitar errores con em-dashes, etc.
    if app_url := os.environ.get("OPENROUTER_APP_URL"):
        headers["HTTP-Referer"] = app_url.encode("ascii", "ignore").decode("ascii")
    if app_name := os.environ.get("OPENROUTER_APP_NAME"):
        headers["X-Title"] = app_name.encode("ascii", "ignore").decode("ascii")

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

    timeout = httpx.Timeout(120.0, connect=10.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        res = await client.post(OPENROUTER_API_URL, headers=headers, json=payload)
        res.raise_for_status()
        data = res.json()

    import json
    import logging

    log = logging.getLogger("ai-clinics-api")
    try:
        content = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError) as e:
        log.error("openrouter: unexpected response shape: %s", data)
        raise RuntimeError(f"unexpected OpenRouter response: {e}") from e

    try:
        return json.loads(content)
    except json.JSONDecodeError as e:
        log.error("openrouter: content is not valid JSON. content=%r", content[:500])
        raise RuntimeError(f"OpenRouter returned non-JSON content: {e}") from e
