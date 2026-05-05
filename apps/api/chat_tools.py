"""Tools y system prompt del chat-agente que edita el roadmap (Etapa 7).

Las tools se declaran en formato OpenAI (`tools=[{type:"function", function:{...}}]`)
para enviar a OpenRouter. NO tienen `execute` en el server: el cliente las
aplica vía `onToolCall` del `useChat` y responde con `addToolOutput`. El
servidor solo es relay del wire format.
"""

from __future__ import annotations

import json
from typing import Any

# Tipo del payload del roadmap (espejo de apps/web/src/lib/roadmap-types.ts).
# Lo dejamos como dict[str, Any] aquí: el LLM ve el JSON crudo en el prompt y
# emite tool_calls que el cliente aplica. El backend no inspecciona el shape.

CHAT_TOOLS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "add_node",
            "description": (
                "Inserta un nuevo paso de implementación de IA (step) o el nodo "
                "de resultado final (result) después de `after_id` en la cadena "
                "lineal. Reconecta los edges para preservar la secuencia."
            ),
            "parameters": {
                "type": "object",
                "additionalProperties": False,
                "required": ["id", "type", "title", "description", "after_id"],
                "properties": {
                    "id": {
                        "type": "string",
                        "description": (
                            "Slug único corto, p. ej. 's4', 's5'. Debe no "
                            "existir aún en el roadmap."
                        ),
                    },
                    "type": {
                        "type": "string",
                        "enum": ["step", "result"],
                        "description": (
                            "'step' = paso de implementación de IA; "
                            "'result' = nodo final con el impacto medible logrado."
                        ),
                    },
                    "title": {
                        "type": "string",
                        "description": "Título corto en español (≤ 9 palabras).",
                    },
                    "description": {
                        "type": "string",
                        "description": "Una sola frase en español.",
                    },
                    "after_id": {
                        "type": "string",
                        "description": (
                            "ID del nodo después del cual se inserta. Puede "
                            "ser 'problem' o cualquier id existente."
                        ),
                    },
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_node",
            "description": (
                "Edita el título, descripción o tipo de un nodo existente "
                "(step o result). No permite cambiar el `id` ni editar "
                "el nodo 'problem' (usar `update_problem` para eso)."
            ),
            "parameters": {
                "type": "object",
                "additionalProperties": False,
                "required": ["id"],
                "properties": {
                    "id": {"type": "string"},
                    "title": {"type": "string"},
                    "description": {"type": "string"},
                    "type": {
                        "type": "string",
                        "enum": ["step", "result"],
                    },
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "remove_node",
            "description": (
                "Elimina un nodo (step o result) y reconecta sus "
                "vecinos para preservar la cadena lineal. Rechaza si el id "
                "es 'problem'."
            ),
            "parameters": {
                "type": "object",
                "additionalProperties": False,
                "required": ["id"],
                "properties": {"id": {"type": "string"}},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "reorder_nodes",
            "description": (
                "Reordena los pasos del roadmap según el array `order` "
                "(IDs sin incluir 'problem'). Reconstruye la cadena lineal "
                "problem → order[0] → order[1] → ..."
            ),
            "parameters": {
                "type": "object",
                "additionalProperties": False,
                "required": ["order"],
                "properties": {
                    "order": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": (
                            "IDs de los pasos en el orden deseado. Debe "
                            "contener exactamente los mismos IDs que ya "
                            "existen, excluyendo 'problem'."
                        ),
                    }
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_problem",
            "description": (
                "Edita el título y/o descripción del nodo 'problem' (el "
                "dolor inicial del negocio). No permite cambiar su id ni su tipo."
            ),
            "parameters": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "title": {"type": "string"},
                    "description": {"type": "string"},
                },
            },
        },
    },
]


CHAT_SYSTEM_PROMPT_TEMPLATE = """Eres asistente del facilitador de Lab10 refinando \
en vivo un roadmap de implementación de IA durante una sesión de 30 minutos del AI \
Summit LATAM. El facilitador y el ejecutivo están conversando contigo para \
ajustar el plan de acción.

El roadmap tiene esta estructura:
- UN nodo `problem`: el dolor de negocio a resolver.
- Nodos `step`: pasos de implementación de IA concretos y ejecutables.
- UN nodo `result` al final: el impacto medible que se logra al completar los pasos.

Tienes 5 tools para mutar el roadmap: `add_node`, `update_node`, `remove_node`, \
`reorder_nodes`, `update_problem`. Cuando el usuario pida cualquier cambio sobre \
el roadmap, USA SIEMPRE las tools — nunca describas el cambio en texto.

Si la pregunta es conceptual (qué significa un nodo, por qué se priorizó X, \
cómo funciona la solución de IA propuesta), responde en texto sin usar tools.

Después de aplicar tools, confirma en una sola frase qué cambió. No enumeres los \
pasos resultantes — el canvas ya los muestra.

Reglas duras:
- El roadmap mantiene la regla de cadena lineal: problem → s1 → s2 → ... → result.
- Exactamente UN nodo `problem` y UN nodo `result`. No los elimines.
- Todos los pasos intermedios son `step` — implementaciones concretas de IA.
- Cuando agregues nodos, usa IDs nuevos cortos (s4, s5, ...).
- Idioma: español (LATAM). Tono ejecutivo, sin jerga vacía. Verbos accionables.
- No inventes datos. Si el usuario pide algo no trazable al dossier o insights, pregunta.

Contexto de la sesión:

# Empresa
{company_name}

# Dossier
{dossier}

# Insights
{insights}

# Roadmap actual (snapshot — el cliente lo actualiza con cada tool call)
```json
{roadmap_payload}
```
"""


def build_chat_system_prompt(
    *,
    company_name: str,
    dossier: dict[str, Any] | None,
    insights: dict[str, Any] | None,
    roadmap_payload: dict[str, Any] | None,
) -> str:
    dossier_text = (
        dossier.get("summary", "(sin dossier)")
        if dossier
        else "(sin dossier)"
    )
    insights_text = (
        json.dumps(insights, ensure_ascii=False, indent=2)
        if insights
        else "(sin insights)"
    )
    roadmap_text = (
        json.dumps(roadmap_payload, ensure_ascii=False, indent=2)
        if roadmap_payload
        else '{"nodes": [], "edges": []}'
    )
    return CHAT_SYSTEM_PROMPT_TEMPLATE.format(
        company_name=company_name,
        dossier=dossier_text,
        insights=insights_text,
        roadmap_payload=roadmap_text,
    )
