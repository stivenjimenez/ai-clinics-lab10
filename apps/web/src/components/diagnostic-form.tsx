"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { generateInsight, saveAnswers, useAnswers, useInsight } from "@/lib/api";
import {
  DIAGNOSTIC_QUESTIONS,
  TOTAL_DIAGNOSTIC_QUESTIONS,
} from "@/lib/diagnostic-questions";

import styles from "./diagnostic-form.module.css";

type SaveState = "idle" | "saving" | "generating" | "saved" | "error";

export type DiagnosticFormProps = {
  sessionId: string;
  onInsightStarted?: () => void;
  onAnsweredCountChange?: (count: number) => void;
};

export function DiagnosticForm({
  sessionId,
  onInsightStarted,
  onAnsweredCountChange,
}: DiagnosticFormProps) {
  const { data: persisted, isLoading } = useAnswers(sessionId);
  const { data: insight } = useInsight(sessionId);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [hydrated, setHydrated] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!persisted || hydrated) return;
    const next: Record<string, string> = {};
    for (const a of persisted) next[a.question_id] = a.answer_text;
    setDrafts(next);
    setHydrated(true);
  }, [persisted, hydrated]);

  const answeredCount = useMemo(
    () =>
      DIAGNOSTIC_QUESTIONS.reduce(
        (n, q) => n + (drafts[q.id]?.trim() ? 1 : 0),
        0,
      ),
    [drafts],
  );

  const onAnsweredCountChangeRef = useRef(onAnsweredCountChange);
  onAnsweredCountChangeRef.current = onAnsweredCountChange;
  useEffect(() => {
    onAnsweredCountChangeRef.current?.(answeredCount);
  }, [answeredCount]);

  const requiredMissing = useMemo(
    () =>
      DIAGNOSTIC_QUESTIONS.some(
        (q) => q.required && !drafts[q.id]?.trim(),
      ),
    [drafts],
  );

  const canGenerate = answeredCount > 0 && !requiredMissing;
  const busy = saveState === "saving" || saveState === "generating";
  const hasInsight = insight?.status === "ready";

  function buildPayload() {
    return DIAGNOSTIC_QUESTIONS.flatMap((q) => {
      const text = (drafts[q.id] ?? "").trim();
      return text ? [{ question_id: q.id, answer_text: text }] : [];
    });
  }

  async function handleGenerate() {
    if (!canGenerate || busy) return;
    setErrorMsg(null);
    try {
      setSaveState("saving");
      await saveAnswers(sessionId, buildPayload());
      setSaveState("generating");
      await generateInsight(sessionId);
      onInsightStarted?.();
      setSaveState("saved");
    } catch (err) {
      setSaveState("error");
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "No pudimos generar los insights.",
      );
    }
  }

  return (
    <form className={styles.wrapper} onSubmit={(e) => e.preventDefault()}>
      <div className={styles.progress}>
        <span className={styles.progressLabel}>
          <strong>{answeredCount}/{TOTAL_DIAGNOSTIC_QUESTIONS}</strong>{" "}
          preguntas completadas
        </span>
        <div className={styles.progressBar} aria-hidden>
          <div
            className={styles.progressFill}
            style={{ width: `${(answeredCount / TOTAL_DIAGNOSTIC_QUESTIONS) * 100}%` }}
          />
        </div>
        <span className={styles.progressTag}>
          {answeredCount === TOTAL_DIAGNOSTIC_QUESTIONS ? "LISTO" : "EN CURSO"}
        </span>
      </div>

      {DIAGNOSTIC_QUESTIONS.map((q) => {
        const num = q.order.toString().padStart(2, "0");
        return (
          <div key={q.id} className={styles.questionCard}>
            <span className={styles.eyebrow}>
              Pregunta {num}
              {q.required && <span className={styles.requiredTag}> · OBLIGATORIA</span>}
            </span>
            <h3 className={styles.questionTitle}>
              {q.title}
              {q.required && <span className={styles.requiredMark} aria-hidden> *</span>}
            </h3>
            <p className={styles.prompt}>{q.prompt}</p>
            <textarea
              className={styles.textarea}
              value={drafts[q.id] ?? ""}
              onChange={(e) =>
                setDrafts((prev) => ({ ...prev, [q.id]: e.target.value }))
              }
              placeholder={isLoading ? "Cargando…" : "Escribe la respuesta del ejecutivo…"}
              disabled={isLoading}
            />
          </div>
        );
      })}

      <div className={styles.actions}>
        {errorMsg && (
          <span className={`${styles.status} ${styles.statusError}`}>
            {errorMsg}
          </span>
        )}
        {!errorMsg && requiredMissing && !busy && (
          <span className={styles.status}>
            Completa las preguntas obligatorias para continuar.
          </span>
        )}
        {!errorMsg && saveState === "saving" && (
          <span className={styles.status}>Guardando respuestas…</span>
        )}
        {!errorMsg && saveState === "generating" && (
          <span className={styles.status}>Generando insights…</span>
        )}
        <button
          type="button"
          className={styles.submit}
          onClick={handleGenerate}
          disabled={!canGenerate || busy}
        >
          {busy
            ? saveState === "saving"
              ? "Guardando…"
              : "Generando…"
            : hasInsight
              ? "Regenerar insights"
              : "Generar insights"}
        </button>
      </div>
    </form>
  );
}
