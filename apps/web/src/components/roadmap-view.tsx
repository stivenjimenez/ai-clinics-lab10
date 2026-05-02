"use client";

import { useEffect, useState } from "react";
import { Loader2, RotateCw } from "lucide-react";

import { RoadmapCanvas } from "@/components/roadmap-canvas";
import {
  ApiError,
  generateRoadmap,
  updateRoadmap,
  useRoadmap,
} from "@/lib/api";
import type { RoadmapPayload } from "@/lib/roadmap-types";

import styles from "./roadmap-view.module.css";

export function RoadmapView({ sessionId }: { sessionId: string }) {
  const { data: roadmap, error } = useRoadmap(sessionId);
  const notFound = error instanceof ApiError && error.status === 404;
  const [busy, setBusy] = useState(false);

  // Si no hay roadmap aún, dispara generate una vez al entrar.
  useEffect(() => {
    if (!notFound || busy) return;
    setBusy(true);
    generateRoadmap(sessionId)
      .catch((e) => console.error("generateRoadmap failed", e))
      .finally(() => setBusy(false));
  }, [sessionId, notFound, busy]);

  async function regenerate() {
    if (busy) return;
    setBusy(true);
    try {
      await generateRoadmap(sessionId);
    } catch (e) {
      console.error("regenerate failed", e);
    } finally {
      setBusy(false);
    }
  }

  async function handlePayloadChange(payload: RoadmapPayload) {
    try {
      await updateRoadmap(sessionId, payload);
    } catch (e) {
      console.error("updateRoadmap failed", e);
    }
  }

  const isGenerating = busy || roadmap?.status === "generating";

  return (
    <div className={styles.wrapper}>
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

      <div className={styles.canvasWrap}>
        <RoadmapBody
          roadmap={roadmap}
          isGenerating={isGenerating}
          notFound={notFound}
          onRetry={regenerate}
          onPayloadChange={handlePayloadChange}
        />
      </div>
    </div>
  );
}

function RoadmapBody({
  roadmap,
  isGenerating,
  notFound,
  onRetry,
  onPayloadChange,
}: {
  roadmap: ReturnType<typeof useRoadmap>["data"];
  isGenerating: boolean;
  notFound: boolean;
  onRetry: () => void;
  onPayloadChange: (payload: RoadmapPayload) => void;
}) {
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
            Estamos armando los pasos a partir del dossier, las respuestas y los
            insights. Suele tardar 30-60 segundos.
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
        <button type="button" className={styles.retry} onClick={onRetry}>
          <RotateCw size={14} strokeWidth={2.25} />
          Reintentar
        </button>
      </div>
    );
  }

  if (roadmap?.status === "ready" && roadmap.payload) {
    return (
      <RoadmapCanvas
        payload={roadmap.payload}
        onPayloadChange={onPayloadChange}
      />
    );
  }

  return null;
}
