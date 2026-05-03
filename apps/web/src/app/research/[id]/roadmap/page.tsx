"use client";

import Link from "next/link";
import { use } from "react";
import { ArrowLeft } from "lucide-react";

import { RoadmapWorkspace } from "@/components/roadmap-workspace";
import { SiteHeader } from "@/components/site-header";
import { useResearch, useSessionForResearch } from "@/lib/api";

import styles from "./page.module.css";

export default function RoadmapPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: research } = useResearch(id);
  const { data: session } = useSessionForResearch(id);

  const company = research?.company_name ?? "";

  return (
    <>
      <SiteHeader />
      <main className={styles.main}>
        <div className={styles.topBar}>
          <Link href={`/research/${id}`} className={styles.backLink}>
            <ArrowLeft size={16} strokeWidth={2} />
            <span>Volver a {company || "research"}</span>
          </Link>
        </div>

        <header className={styles.header}>
          <span className={styles.eyebrow}>Roadmap</span>
          <h1 className={styles.title}>{company}</h1>
        </header>

        {session ? (
          <RoadmapWorkspace sessionId={session.id} />
        ) : (
          <div className={styles.errorBox}>
            No encontramos la sesión asociada a este research.
          </div>
        )}
      </main>
    </>
  );
}
