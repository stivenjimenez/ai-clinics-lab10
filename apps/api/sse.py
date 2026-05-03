"""Adapter SSE: chunks de OpenRouter (formato OpenAI delta) -> Vercel AI SDK
Data Stream Protocol v1 (https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol).

Headers que el cliente espera:
    Content-Type: text/event-stream
    x-vercel-ai-ui-message-stream: v1

El stream emite eventos JSON con `type` ∈ {start, text-start, text-delta,
text-end, tool-input-start, tool-input-delta, tool-input-available,
tool-output-available, finish, error} y termina con `data: [DONE]`.
"""

from __future__ import annotations

import json
import uuid
from typing import Any

UI_STREAM_HEADERS = {
    "Content-Type": "text/event-stream",
    "x-vercel-ai-ui-message-stream": "v1",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
}


def _line(obj: dict[str, Any]) -> str:
    return f"data: {json.dumps(obj, ensure_ascii=False)}\n\n"


def event_start(message_id: str) -> str:
    return _line({"type": "start", "messageId": message_id})


def event_text_start(part_id: str) -> str:
    return _line({"type": "text-start", "id": part_id})


def event_text_delta(part_id: str, delta: str) -> str:
    return _line({"type": "text-delta", "id": part_id, "delta": delta})


def event_text_end(part_id: str) -> str:
    return _line({"type": "text-end", "id": part_id})


def event_tool_input_start(tool_call_id: str, tool_name: str) -> str:
    return _line(
        {
            "type": "tool-input-start",
            "toolCallId": tool_call_id,
            "toolName": tool_name,
        }
    )


def event_tool_input_delta(tool_call_id: str, delta: str) -> str:
    return _line(
        {
            "type": "tool-input-delta",
            "toolCallId": tool_call_id,
            "inputTextDelta": delta,
        }
    )


def event_tool_input_available(
    tool_call_id: str, tool_name: str, parsed_input: dict[str, Any]
) -> str:
    return _line(
        {
            "type": "tool-input-available",
            "toolCallId": tool_call_id,
            "toolName": tool_name,
            "input": parsed_input,
        }
    )


def event_finish() -> str:
    return _line({"type": "finish"})


def event_error(error_text: str) -> str:
    return _line({"type": "error", "errorText": error_text})


def event_done() -> str:
    return "data: [DONE]\n\n"


def make_message_id() -> str:
    return f"msg_{uuid.uuid4().hex}"


def make_text_part_id() -> str:
    return f"txt_{uuid.uuid4().hex[:16]}"
