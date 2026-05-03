"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Loader2, RotateCw, Send, Sparkles, Square } from "lucide-react";

import { API_URL } from "@/lib/api";
import type { ToolResult } from "@/lib/roadmap-mutations";

import styles from "./chat-panel.module.css";

type ChatHistoryResponse = { messages: UIMessage[] };

async function fetchHistory(path: string): Promise<ChatHistoryResponse> {
  const res = await fetch(`${API_URL}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`history ${res.status}`);
  return res.json();
}

const TOOL_LABELS: Record<string, string> = {
  add_node: "Agregar paso",
  update_node: "Editar paso",
  remove_node: "Eliminar paso",
  reorder_nodes: "Reordenar pasos",
  update_problem: "Editar problema",
};

function isToolPart(type: string): boolean {
  return (
    type.startsWith("tool-") &&
    Object.prototype.hasOwnProperty.call(TOOL_LABELS, type.slice(5))
  );
}

export function ChatPanel({
  sessionId,
  enabled,
  onToolCall,
}: {
  sessionId: string;
  enabled: boolean;
  onToolCall: (toolName: string, input: unknown) => ToolResult;
}) {
  const { data: history, mutate: refetchHistory } = useSWR<ChatHistoryResponse>(
    enabled ? `/sessions/${sessionId}/chat` : null,
    fetchHistory,
  );

  const hydratedRef = useRef(false);
  const [input, setInput] = useState("");

  const chat = useChat({
    id: sessionId,
    messages: history?.messages,
    transport: new DefaultChatTransport({
      api: `${API_URL}/sessions/${sessionId}/chat`,
    }),
    // Auto-trigger SOLO si el último assistant termina en un tool call sin
    // texto pos-tool. Si después del tool ya emitió texto, el turno está
    // cerrado: no re-postear (eso causaba el bucle de tool calls iguales).
    sendAutomaticallyWhen: ({ messages }) => {
      const last = messages[messages.length - 1];
      if (!last || last.role !== "assistant") return false;
      const parts = last.parts;
      // Buscamos el último part "real" (ignoramos step-start y similares).
      let lastIdx = -1;
      for (let i = parts.length - 1; i >= 0; i--) {
        const t = (parts[i] as { type: string }).type;
        if (t === "step-start" || t === "step-end") continue;
        lastIdx = i;
        break;
      }
      if (lastIdx === -1) return false;
      const lastPart = parts[lastIdx] as {
        type: string;
        state?: string;
      };
      // Solo auto-send si el último part es una tool con output ya disponible.
      // Si el último part es texto → el modelo ya cerró el turn con confirmación.
      return (
        typeof lastPart.type === "string" &&
        lastPart.type.startsWith("tool-") &&
        (lastPart.state === "output-available" ||
          lastPart.state === "output-error")
      );
    },
    onToolCall: ({ toolCall }) => {
      const toolName = (toolCall as { toolName: string }).toolName;
      const input = (toolCall as { input: unknown }).input;
      const result = onToolCall(toolName, input);
      // No await — evita deadlocks (per docs)
      chat.addToolOutput({
        tool: toolName,
        toolCallId: toolCall.toolCallId,
        output: result,
      });
    },
  });

  // Hidratar mensajes desde server al montar (una vez).
  useEffect(() => {
    if (hydratedRef.current || !history?.messages) return;
    hydratedRef.current = true;
    if (history.messages.length > 0) {
      chat.setMessages(history.messages);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history]);

  const isStreaming = chat.status === "streaming" || chat.status === "submitted";

  function send() {
    const text = input.trim();
    if (!text || isStreaming || !enabled) return;
    chat.sendMessage({ text });
    setInput("");
  }

  function stop() {
    chat.stop();
  }

  async function reset() {
    if (isStreaming) return;
    try {
      await fetch(`${API_URL}/sessions/${sessionId}/chat`, { method: "DELETE" });
      chat.setMessages([]);
      refetchHistory();
    } catch (e) {
      console.error("reset chat failed", e);
    }
  }

  return (
    <div className={styles.panel}>
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <Sparkles size={14} strokeWidth={2.25} className={styles.titleIcon} />
          <h3 className={styles.title}>Asistente del roadmap</h3>
        </div>
        <button
          type="button"
          className={styles.resetBtn}
          onClick={reset}
          disabled={isStreaming || chat.messages.length === 0}
          title="Reiniciar conversación"
        >
          <RotateCw size={12} strokeWidth={2.25} />
          Reiniciar
        </button>
      </header>

      <div className={styles.messages}>
        {chat.messages.length === 0 && (
          <div className={styles.empty}>
            <p>
              Pedile al asistente que ajuste el roadmap. Por ejemplo:
            </p>
            <ul>
              <li>“Agregá un paso de capacitación al equipo después del primer milestone.”</li>
              <li>“El problema está mal redactado, hablá del NPS en vez del costo.”</li>
              <li>“Eliminá el paso s3 y reordená los demás.”</li>
            </ul>
          </div>
        )}

        {chat.messages.map((m) => (
          <article key={m.id} className={styles.message} data-role={m.role}>
            {m.parts.map((part, i) => {
              if (part.type === "text") {
                return (
                  <p key={i} className={styles.text}>
                    {(part as { text: string }).text}
                  </p>
                );
              }
              if (typeof part.type === "string" && isToolPart(part.type)) {
                const toolName = part.type.slice(5);
                const label = TOOL_LABELS[toolName] ?? toolName;
                const state = (part as { state?: string }).state;
                const output = (part as { output?: ToolResult }).output;
                const ok =
                  state === "output-available"
                    ? output && output.ok
                    : true;
                return (
                  <div
                    key={i}
                    className={styles.toolCard}
                    data-state={ok ? "ok" : "error"}
                  >
                    <span className={styles.toolLabel}>{label}</span>
                    {state === "input-streaming" && (
                      <span className={styles.toolStatus}>preparando…</span>
                    )}
                    {state === "input-available" && (
                      <span className={styles.toolStatus}>aplicando…</span>
                    )}
                    {state === "output-available" && output && !output.ok && (
                      <span className={styles.toolError}>
                        {output.error}
                      </span>
                    )}
                    {state === "output-available" && output && output.ok && (
                      <span className={styles.toolStatus}>aplicado</span>
                    )}
                  </div>
                );
              }
              return null;
            })}
          </article>
        ))}

        {isStreaming && (
          <div className={styles.thinking}>
            <Loader2 size={14} strokeWidth={2.25} className={styles.spinner} />
            Pensando…
          </div>
        )}
      </div>

      <form
        className={styles.composer}
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <textarea
          className={styles.input}
          placeholder={
            enabled
              ? "Pedí un cambio al roadmap…"
              : "Esperando que cargue el roadmap…"
          }
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={2}
          disabled={!enabled || isStreaming}
        />
        {isStreaming ? (
          <button
            type="button"
            className={`${styles.sendBtn} ${styles.stopBtn}`}
            onClick={stop}
            aria-label="Detener"
            title="Detener conversación"
          >
            <Square size={14} strokeWidth={2.25} fill="currentColor" />
          </button>
        ) : (
          <button
            type="submit"
            className={styles.sendBtn}
            disabled={!enabled || input.trim() === ""}
            aria-label="Enviar"
          >
            <Send size={14} strokeWidth={2.25} />
          </button>
        )}
      </form>
    </div>
  );
}
