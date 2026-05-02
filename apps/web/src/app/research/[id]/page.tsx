"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink, Loader2 } from "lucide-react";

import { DiagnosticForm } from "@/components/diagnostic-form";
import { InsightsView } from "@/components/insights-view";
import { SiteHeader } from "@/components/site-header";
import { StatusBadge } from "@/components/status-badge";
import { Tabs, type TabItem } from "@/components/tabs";
import {
  useAnswers,
  useInsight,
  useResearch,
  useSessionForResearch,
} from "@/lib/api";
import {
  DIAGNOSTIC_QUESTIONS,
  TOTAL_DIAGNOSTIC_QUESTIONS,
} from "@/lib/diagnostic-questions";

import styles from "./detail.module.css";

type TabId = "brief" | "diagnostic" | "insights" | "roadmap";

type DetailTabId = Exclude<TabId, "roadmap">;

export default function ResearchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data, error, isLoading } = useResearch(id);
  const isReady = data?.status === "ready";
  const { data: session } = useSessionForResearch(isReady ? id : null);
  const { data: answers } = useAnswers(session?.id);
  const { data: insight } = useInsight(session?.id);

  const [tab, setTab] = useState<DetailTabId>("brief");
  const hasInsight = Boolean(insight);

  function handleTabChange(next: TabId) {
    if (next === "roadmap") {
      router.push(`/research/${id}/roadmap`);
      return;
    }
    setTab(next);
  }

  const answeredCount = (answers ?? []).filter((a) =>
    DIAGNOSTIC_QUESTIONS.some((q) => q.id === a.question_id && a.answer_text.trim()),
  ).length;

  const tabs: TabItem<TabId>[] = [
    { id: "brief", label: "Brief" },
    {
      id: "diagnostic",
      label: "Diagnóstico",
      count: `${answeredCount}/${TOTAL_DIAGNOSTIC_QUESTIONS}`,
      disabled: !isReady,
      disabledReason: "Disponible cuando termine el research",
    },
    {
      id: "insights",
      label: "Insights",
      disabled: !hasInsight,
      disabledReason: "Genera insights al terminar el diagnóstico",
    },
  ];

  return (
    <>
      <SiteHeader />
      <main className={styles.main}>
        <div className={styles.topBar}>
          <Link href="/" className={styles.backLink}>
            <ArrowLeft size={16} strokeWidth={2} />
            <span>Volver a research</span>
          </Link>
          {data && <StatusBadge status={data.status} />}
        </div>

        {error && (
          <div className={styles.errorBox}>
            No pudimos cargar este research. ¿Existe el id <code>{id}</code>?
          </div>
        )}

        {isLoading && !data && <DetailSkeleton />}

        {data && (
          <>
            <header className={styles.header}>
              <span className={styles.eyebrow}>RESEARCH</span>
              <h1 className={styles.title}>{data.company_name}</h1>
              <div className={styles.meta}>
                {data.website && (
                  <a
                    className={styles.metaLink}
                    href={normalizeUrl(data.website)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink size={14} strokeWidth={2} />
                    {data.website}
                  </a>
                )}
                {data.linkedin && (
                  <a
                    className={styles.metaLink}
                    href={normalizeUrl(data.linkedin)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink size={14} strokeWidth={2} />
                    LinkedIn
                  </a>
                )}
              </div>
            </header>

            <Tabs items={tabs} active={tab} onChange={handleTabChange} ariaLabel="Secciones del research" />

            {tab === "brief" && (
              <>
                {data.notes && (
                  <section className={styles.notesCard}>
                    <h2 className={styles.cardTitle}>Observaciones del facilitador</h2>
                    <p className={styles.notesText}>{data.notes}</p>
                  </section>
                )}

                {data.status === "researching" && (
                  <div className={styles.researching}>
                    <Loader2 className={styles.spinner} size={22} strokeWidth={2.25} aria-hidden />
                    <div>
                      <strong>El agente está investigando…</strong>
                      <p>
                        Estamos consultando fuentes web. Esto puede tardar 2–4 minutos.
                        La página se actualiza sola.
                      </p>
                    </div>
                  </div>
                )}

                {data.status === "researching" && <SummarySkeleton />}

                {data.status === "failed" && (
                  <div className={styles.errorBox}>
                    <strong>El research falló.</strong>
                    <p className={styles.errorMessage}>{data.error_message}</p>
                  </div>
                )}

                {data.status === "ready" && data.dossier && (
                  <section className={styles.summaryCard}>
                    <h2 className={styles.cardTitle}>Resumen de la empresa</h2>
                    <p className={styles.summary}>{data.dossier.summary}</p>
                  </section>
                )}
              </>
            )}

            {tab === "diagnostic" && session && (
              <DiagnosticForm
                sessionId={session.id}
                onInsightStarted={() => setTab("insights")}
              />
            )}

            {tab === "diagnostic" && !session && (
              <div className={styles.researching}>
                <Loader2 className={styles.spinner} size={22} strokeWidth={2.25} aria-hidden />
                <div>
                  <strong>Cargando sesión…</strong>
                </div>
              </div>
            )}

            {tab === "insights" && session && (
              <InsightsView
                sessionId={session.id}
                onOpenRoadmap={() => router.push(`/research/${id}/roadmap`)}
              />
            )}
          </>
        )}
      </main>
    </>
  );
}

function normalizeUrl(raw: string) {
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

function DetailSkeleton() {
  return (
    <div className={styles.skeletonStack}>
      <div className={styles.skelEyebrow} />
      <div className={styles.skelTitle} />
      <div className={styles.skelMeta} />
      <div className={styles.skelBlock} />
      <div className={styles.skelBlockTall} />
    </div>
  );
}

function SummarySkeleton() {
  return (
    <section className={styles.summaryCard} aria-hidden>
      <div className={styles.skelLine} style={{ width: "40%" }} />
      <div className={styles.skelLine} />
      <div className={styles.skelLine} />
      <div className={styles.skelLine} style={{ width: "85%" }} />
      <div className={styles.skelLine} style={{ width: "70%" }} />
    </section>
  );
}
