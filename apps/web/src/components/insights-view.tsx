"use client";

import { Loader2, RotateCw } from "lucide-react";
import { useState } from "react";

import { generateInsight, useInsight } from "@/lib/api";
import {
  ADOPTION_LABELS,
  type AdoptionLevel,
  type Insight,
  type InsightPayload,
} from "@/lib/types";

import styles from "./insights-view.module.css";

export function InsightsView({ sessionId }: { sessionId: string }) {
  const { data: insight, error } = useInsight(sessionId);
  const [retrying, setRetrying] = useState(false);

  const notFound = isNotFound(error);

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
        <div>
          <strong>Generando insights…</strong>
          <p>
            Estamos sintetizando dolor, oportunidades y recomendaciones a partir
            del research y las respuestas. Suele tardar 20-40 segundos.
          </p>
        </div>
      </div>
    );
  }

  if (insight?.status === "failed") {
    async function retry() {
      if (retrying) return;
      setRetrying(true);
      try {
        await generateInsight(sessionId);
      } finally {
        setRetrying(false);
      }
    }
    return (
      <div className={styles.errorBox}>
        <strong>No pudimos generar los insights.</strong>
        {insight.error_text && <code>{insight.error_text}</code>}
        <button
          type="button"
          className={styles.retry}
          onClick={retry}
          disabled={retrying}
        >
          {retrying ? (
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
    return <InsightsContent insight={insight} payload={insight.payload} />;
  }

  return null;
}

function InsightsContent({
  insight,
  payload,
}: {
  insight: Insight;
  payload: InsightPayload;
}) {
  return (
    <div className={styles.wrapper}>
      <section className={styles.summary}>
        <span className={styles.eyebrow}>Resumen ejecutivo</span>
        <p>{payload.resumen_ejecutivo}</p>
      </section>

      <div className={styles.row}>
        <section className={styles.card}>
          <span className={styles.eyebrow}>Dolor principal</span>
          <p className={styles.cardBody}>{payload.dolor_principal}</p>
        </section>
        <section className={styles.card}>
          <span className={styles.eyebrow}>Adopción de IA</span>
          <AdoptionMeter nivel={clampLevel(payload.adopcion_ia.nivel)} />
        </section>
      </div>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Oportunidades detectadas</h3>
        <div className={styles.opportunities}>
          {payload.oportunidades.map((op, i) => (
            <article key={i} className={styles.opportunity}>
              <h4 className={styles.opportunityTitle}>{op.titulo}</h4>
              <p className={styles.opportunityDesc}>{op.descripcion}</p>
              <div className={styles.tags}>
                <span className={styles.tag}>
                  Impacto · <strong>{op.impacto}</strong>
                </span>
                <span className={styles.tag}>
                  Esfuerzo · <strong>{op.esfuerzo}</strong>
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Recomendaciones iniciales</h3>
        <ol className={styles.recsList}>
          {[...payload.recomendaciones_iniciales]
            .sort((a, b) => a.orden - b.orden)
            .map((rec) => (
              <li key={rec.orden} className={styles.recItem}>
                <span className={styles.recOrder}>
                  {rec.orden.toString().padStart(2, "0")}
                </span>
                <p className={styles.recText}>{rec.texto}</p>
              </li>
            ))}
        </ol>
      </section>

      {insight.generated_at && (
        <p
          style={{
            margin: 0,
            fontSize: 12,
            color: "var(--foreground-muted)",
            textAlign: "right",
          }}
        >
          Generado {new Date(insight.generated_at).toLocaleString("es-419")}
          {insight.model ? ` · ${insight.model}` : ""}
        </p>
      )}
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
