"use client";

import Link from "next/link";
import { use } from "react";
import { ArrowLeft } from "lucide-react";

import { RoadmapWorkspace } from "@/components/roadmap-workspace";
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
      <main className={styles.main}>
        <div className={styles.topBar}>
          <Link href={`/research/${id}`} className={styles.backLink}>
            <ArrowLeft size={16} strokeWidth={2} />
            <span>Volver a {company || "research"}</span>
          </Link>
        </div>

        {session ? (
          <RoadmapWorkspace sessionId={session.id} companyName={company} />
        ) : (
          <>
            <header style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ letterSpacing: "0.18em", fontSize: 11, color: "var(--foreground-muted)", textTransform: "uppercase", fontWeight: 700 }}>Roadmap</span>
              <h1 style={{ margin: 0, fontSize: 26, letterSpacing: "-0.01em" }}>{company}</h1>
            </header>
            <div className={styles.errorBox}>
              No encontramos la sesión asociada a este research.
            </div>
          </>
        )}
      </main>
  );
}
