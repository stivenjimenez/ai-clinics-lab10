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

  const dirty = useMemo(() => {
    if (!hydrated) return false;
    const persistedMap = new Map(
      (persisted ?? []).map((a) => [a.question_id, a.answer_text]),
    );
    return DIAGNOSTIC_QUESTIONS.some((q) => {
      const draft = (drafts[q.id] ?? "").trim();
      const prev = (persistedMap.get(q.id) ?? "").trim();
      return draft !== prev;
    });
  }, [drafts, persisted, hydrated]);

  const onAnsweredCountChangeRef = useRef(onAnsweredCountChange);
  onAnsweredCountChangeRef.current = onAnsweredCountChange;
  useEffect(() => {
    onAnsweredCountChangeRef.current?.(answeredCount);
  }, [answeredCount]);

  const hasAtLeastOne = answeredCount > 0;
  const allAnswered = answeredCount === TOTAL_DIAGNOSTIC_QUESTIONS;
  const busy = saveState === "saving" || saveState === "generating";
  const hasInsight = insight?.status === "ready";

  function buildPayload() {
    return DIAGNOSTIC_QUESTIONS.flatMap((q) => {
      const text = (drafts[q.id] ?? "").trim();
      return text ? [{ question_id: q.id, answer_text: text }] : [];
    });
  }

  async function handleGenerate() {
    if (!allAnswered || busy) return;
    setErrorMsg(null);
    try {
      if (dirty) {
        setSaveState("saving");
        await saveAnswers(sessionId, buildPayload());
      }
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
            <span className={styles.eyebrow}>Pregunta {num}</span>
            <h3 className={styles.questionTitle}>{q.title}</h3>
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
    </form>
  );
}
