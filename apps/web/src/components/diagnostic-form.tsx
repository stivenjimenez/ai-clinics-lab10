"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import { saveAnswers, useAnswers } from "@/lib/api";
import {
  DIAGNOSTIC_QUESTIONS,
  TOTAL_DIAGNOSTIC_QUESTIONS,
} from "@/lib/diagnostic-questions";

import styles from "./diagnostic-form.module.css";

type SaveState = "idle" | "saving" | "saved" | "error";

export function DiagnosticForm({ sessionId }: { sessionId: string }) {
  const { data: persisted, isLoading } = useAnswers(sessionId);
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

  const hasAtLeastOne = answeredCount > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!hasAtLeastOne || saveState === "saving") return;
    setSaveState("saving");
    setErrorMsg(null);
    try {
      const payload = DIAGNOSTIC_QUESTIONS.flatMap((q) => {
        const text = (drafts[q.id] ?? "").trim();
        return text ? [{ question_id: q.id, answer_text: text }] : [];
      });
      await saveAnswers(sessionId, payload);
      setSaveState("saved");
    } catch (err) {
      setSaveState("error");
      setErrorMsg(
        err instanceof Error ? err.message : "No pudimos guardar las respuestas.",
      );
    }
  }

  return (
    <form className={styles.wrapper} onSubmit={handleSubmit}>
      <div className={styles.progress}>
        <span className={styles.progressLabel}>
          <strong>
            {answeredCount}/{TOTAL_DIAGNOSTIC_QUESTIONS}
          </strong>{" "}
          preguntas completadas
        </span>
        <div className={styles.progressBar} aria-hidden>
          <div
            className={styles.progressFill}
            style={{
              width: `${(answeredCount / TOTAL_DIAGNOSTIC_QUESTIONS) * 100}%`,
            }}
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

      <div className={styles.actions}>
        <span
          className={`${styles.status} ${
            saveState === "error" ? styles.statusError : ""
          }`}
        >
          {saveState === "saved" && !dirty && "Cambios guardados"}
          {saveState === "error" && (errorMsg ?? "Error al guardar")}
        </span>
        <button
          type="submit"
          className={styles.submit}
          disabled={!hasAtLeastOne || saveState === "saving" || (!dirty && saveState !== "error")}
        >
          {saveState === "saving" && (
            <Loader2 size={16} strokeWidth={2.25} className={styles.spinner} />
          )}
          {saveState === "saving" ? "Guardando…" : "Guardar respuestas"}
        </button>
      </div>
    </form>
  );
}
