"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, RotateCw } from "lucide-react";

import { ChatPanel } from "@/components/chat-panel";
import { RoadmapCanvas } from "@/components/roadmap-canvas";
import {
  ApiError,
  generateRoadmap,
  updateRoadmap,
  useRoadmap,
} from "@/lib/api";
import { applyMutation } from "@/lib/roadmap-mutations";
import type { RoadmapPayload } from "@/lib/roadmap-types";

import styles from "./roadmap-workspace.module.css";

export function RoadmapWorkspace({ sessionId }: { sessionId: string }) {
  const { data: roadmap, error, mutate } = useRoadmap(sessionId);
  const notFound = error instanceof ApiError && error.status === 404;
  const [busy, setBusy] = useState(false);

  // Estado lifted del payload — fuente de verdad mientras se está editando.
  // Se hidrata desde el roadmap del server cuando llega y luego solo lo
  // empuja drag manual o tool calls del chat.
  const [payload, setPayload] = useState<RoadmapPayload | null>(null);
  const lastHydratedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!roadmap?.payload) return;
    if (roadmap.status !== "ready") return;
    // Re-hidratamos solo cuando cambia la fila (updated_at) y no estamos
    // editando localmente — para no pisar cambios pendientes.
    const stamp = roadmap.updated_at;
    if (lastHydratedRef.current === stamp) return;
    lastHydratedRef.current = stamp;
    setPayload(roadmap.payload);
  }, [roadmap]);

  // Si no hay roadmap aún, dispara generate una vez al entrar.
  useEffect(() => {
    if (!notFound || busy) return;
    setBusy(true);
    generateRoadmap(sessionId)
      .catch((e) => console.error("generateRoadmap failed", e))
      .finally(() => setBusy(false));
  }, [sessionId, notFound, busy]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function persistPayload(next: RoadmapPayload) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        await updateRoadmap(sessionId, next);
        // Marcamos el snapshot como "ya hidratado" para no re-tirarlo.
        lastHydratedRef.current = new Date().toISOString();
      } catch (e) {
        console.error("updateRoadmap failed", e);
      }
    }, 400);
  }

  function handlePayloadChange(next: RoadmapPayload) {
    setPayload(next);
    persistPayload(next);
  }

  function applyToolCall(toolName: string, input: unknown) {
    if (!payload) {
      return { ok: false, error: "roadmap aún no está listo" } as const;
    }
    const { next, result } = applyMutation(payload, toolName, input);
    if (result.ok) {
      setPayload(next);
      persistPayload(next);
    }
    return result;
  }

  async function regenerate() {
    if (busy) return;
    setBusy(true);
    try {
      await generateRoadmap(sessionId);
      lastHydratedRef.current = null; // forzar re-hidratación
      mutate();
    } catch (e) {
      console.error("regenerate failed", e);
    } finally {
      setBusy(false);
    }
  }

  const isGenerating = busy || roadmap?.status === "generating";

  const canvasNode = useMemo(() => {
    if (isGenerating || (notFound && !roadmap)) {
      return (
        <div className={styles.statusBlock}>
          <Loader2
            className={styles.spinner}
            size={22}
            strokeWidth={2.25}
            aria-hidden
          />
          <div>
            <strong>Generando roadmap…</strong>
            <p>
              Estamos armando los pasos a partir del dossier, las respuestas y
              los insights. Suele tardar 30-60 segundos.
            </p>
          </div>
        </div>
      );
    }
    if (roadmap?.status === "failed") {
      return (
        <div className={styles.errorBox}>
          <strong>No pudimos generar el roadmap.</strong>
          {roadmap.error_text && <code>{roadmap.error_text}</code>}
          <button type="button" className={styles.retry} onClick={regenerate}>
            <RotateCw size={14} strokeWidth={2.25} />
            Reintentar
          </button>
        </div>
      );
    }
    if (payload) {
      return (
        <RoadmapCanvas payload={payload} onPayloadChange={handlePayloadChange} />
      );
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGenerating, notFound, roadmap, payload]);

  const chatReady = !!payload && !isGenerating;

  return (
    <div className={styles.workspace}>
      <aside className={styles.chatColumn}>
        <ChatPanel
          sessionId={sessionId}
          enabled={chatReady}
          onToolCall={applyToolCall}
        />
      </aside>
      <section className={styles.canvasColumn}>
        <div className={styles.toolbar}>
          <button
            type="button"
            className={styles.regen}
            onClick={regenerate}
            disabled={isGenerating}
            title={
              isGenerating ? "Generación en curso" : "Volver a generar el roadmap"
            }
          >
            {isGenerating ? (
              <Loader2 size={14} strokeWidth={2.25} className={styles.spinner} />
            ) : (
              <RotateCw size={14} strokeWidth={2.25} />
            )}
            Regenerar
          </button>
        </div>
        <div className={styles.canvasWrap}>{canvasNode}</div>
      </section>
    </div>
  );
}
