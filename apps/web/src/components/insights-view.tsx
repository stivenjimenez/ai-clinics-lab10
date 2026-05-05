"use client";

import { Loader2, RotateCw } from "lucide-react";
import { useState } from "react";

import { generateInsight, useInsight } from "@/lib/api";
import {
  ADOPTION_LABELS,
  OPPORTUNITY_CATEGORY_LABELS,
  type AdoptionLevel,
  type InsightPayload,
} from "@/lib/types";

import styles from "./insights-view.module.css";

export function InsightsView({ sessionId }: { sessionId: string }) {
  const { data: insight, error } = useInsight(sessionId);
  const [busy, setBusy] = useState(false);

  const notFound = isNotFound(error);

  async function handleRegenerate() {
    if (busy) return;
    setBusy(true);
    try {
      await generateInsight(sessionId);
    } finally {
      setBusy(false);
    }
  }

  if (!insight && !notFound && !error) {
    return <InsightsSkeleton />;
  }

  if (notFound) {
    return (
      <div className={styles.empty}>
        Aún no hay insights para esta sesión.
        <br />
        Termina el diagnóstico y usa <strong>Guardar y generar insights</strong>.
      </div>
    );
  }

  if (insight?.status === "generating") {
    return (
      <div className={styles.statusBlock}>
        <Loader2 className={styles.spinner} size={22} strokeWidth={2.25} aria-hidden />
        <strong>Generando insights…</strong>
      </div>
    );
  }

  if (insight?.status === "failed") {
    return (
      <div className={styles.errorBox}>
        <strong>No pudimos generar los insights.</strong>
        {insight.error_text && <code>{insight.error_text}</code>}
        <button
          type="button"
          className={styles.retry}
          onClick={handleRegenerate}
          disabled={busy}
        >
          {busy ? (
            <Loader2 size={14} strokeWidth={2.25} className={styles.spinner} />
          ) : (
            <RotateCw size={14} strokeWidth={2.25} />
          )}
          Reintentar
        </button>
      </div>
    );
  }

  if (insight?.status === "ready" && insight.payload) {
    return (
      <InsightsContent
        payload={insight.payload}
        onRegenerate={handleRegenerate}
        regenerating={busy}
      />
    );
  }

  return null;
}

function InsightsContent({
  payload,
  onRegenerate,
  regenerating,
}: {
  payload: InsightPayload;
  onRegenerate: () => void;
  regenerating: boolean;
}) {
  return (
    <div className={styles.wrapper}>
      <section className={styles.summary}>
        <span className={styles.eyebrow}>Resumen ejecutivo</span>
        <p>{payload.executive_summary}</p>
      </section>

      <div className={styles.row}>
        <section className={styles.card}>
          <span className={styles.eyebrow}>Dolor principal</span>
          <p className={styles.cardBody}>{payload.pain_point}</p>
        </section>
        <section className={styles.card}>
          <span className={styles.eyebrow}>Adopción de IA</span>
          <AdoptionMeter nivel={clampLevel(payload.ai_adoption.level)} />
        </section>
      </div>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Oportunidades con IA</h3>
        <div className={styles.opportunities}>
          {payload.opportunities.slice(0, 3).map((op, i) => (
            <article key={i} className={styles.opportunity}>
              {op.category && (
                <span className={styles.opportunityCategory}>
                  {OPPORTUNITY_CATEGORY_LABELS[op.category] ?? op.category}
                </span>
              )}
              <h4 className={styles.opportunityTitle}>{op.title}</h4>
              <p className={styles.opportunityDesc}>{op.description}</p>
            </article>
          ))}
        </div>
      </section>

      <div className={styles.regenRow}>
        <button
          type="button"
          className={styles.regenBtn}
          onClick={onRegenerate}
          disabled={regenerating}
        >
          {regenerating ? (
            <Loader2 size={14} strokeWidth={2.25} className={styles.spinner} />
          ) : (
            <RotateCw size={14} strokeWidth={2.25} />
          )}
          {regenerating ? "Regenerando…" : "Regenerar insights"}
        </button>
      </div>
    </div>
  );
}

function InsightsSkeleton() {
  return (
    <div className={styles.wrapper} aria-hidden>
      <div className={`${styles.skel} ${styles.skelSummary}`} />
      <div className={styles.row}>
        <div className={`${styles.skel} ${styles.skelCard}`} />
        <div className={`${styles.skel} ${styles.skelCard}`} />
      </div>
      <div className={`${styles.skel} ${styles.skelSection}`} />
      <div className={`${styles.skel} ${styles.skelSection}`} />
    </div>
  );
}

function isNotFound(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const status = (err as { status?: unknown }).status;
  return status === 404;
}

function clampLevel(n: unknown): AdoptionLevel {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return 1;
  const r = Math.round(v);
  if (r <= 1) return 1;
  if (r >= 5) return 5;
  return r as AdoptionLevel;
}

function AdoptionMeter({ nivel }: { nivel: AdoptionLevel }) {
  return (
    <div className={styles.adoption}>
      <div className={styles.adoptionHeader}>
        <span className={styles.adoptionLevel}>{nivel}</span>
        <span className={styles.adoptionMax}>/ 5</span>
      </div>
      <div className={styles.scale} role="img" aria-label={`Nivel ${nivel} de 5`}>
        {[1, 2, 3, 4, 5].map((i) => (
          <span
            key={i}
            className={styles.segment}
            data-filled={i <= nivel}
          />
        ))}
      </div>
      <span className={styles.adoptionLabel}>{ADOPTION_LABELS[nivel]}</span>
    </div>
  );
}
