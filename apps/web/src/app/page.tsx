"use client";

import { useMemo, useState } from "react";
import { Search, Plus } from "lucide-react";

import { SiteHeader } from "@/components/site-header";
import { KpiCard } from "@/components/kpi-card";
import { ResearchTable } from "@/components/research-table";
import { NewResearchModal } from "@/components/new-research-modal";
import { useResearchList } from "@/lib/api";
import type { Research } from "@/lib/types";

import styles from "./page.module.css";

type FilterKey =
  | "all"
  | "pending"
  | "ready"
  | "draft"
  | "in_session"
  | "with_roadmap";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "pending", label: "Pendientes" },
  { key: "ready", label: "Completados" },
  { key: "draft", label: "Draft" },
  { key: "in_session", label: "En sesión" },
  { key: "with_roadmap", label: "Con roadmap" },
];

function applyFilter(rows: Research[], key: FilterKey, search: string) {
  let out = rows;
  if (key === "pending") {
    out = out.filter((r) => r.status === "pending" || r.status === "researching");
  } else if (key === "ready") {
    out = out.filter((r) => r.status === "ready");
  } else if (key === "draft") {
    // En esta etapa, todos los ready tienen una sesión en draft. Cuando exista
    // estado real de sesión, ajustamos esta lógica.
    out = out.filter((r) => r.status === "ready");
  } else if (key === "in_session" || key === "with_roadmap") {
    out = []; // por ahora sin datos reales — etapas posteriores
  }

  const q = search.trim().toLowerCase();
  if (q) {
    out = out.filter((r) => {
      const haystack = [
        r.company_name,
        r.website,
        r.linkedin,
        r.notes,
        r.dossier?.summary,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }
  return out;
}

export default function HomePage() {
  const { data: rows, error, isLoading } = useResearchList();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const all = rows ?? [];
  const filtered = useMemo(() => applyFilter(all, filter, search), [all, filter, search]);

  const counts = useMemo(() => {
    return {
      all: all.length,
      pending: all.filter((r) => r.status === "pending" || r.status === "researching").length,
      ready: all.filter((r) => r.status === "ready").length,
      draft: all.filter((r) => r.status === "ready").length,
      in_session: 0,
      with_roadmap: 0,
    } satisfies Record<FilterKey, number>;
  }, [all]);

  const newToday = all.filter((r) => {
    const d = new Date(r.created_at);
    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  }).length;

  return (
    <>
      <SiteHeader />
      <main className={styles.main}>
        <h1 className={styles.title}>Research</h1>

        <section className={styles.kpis}>
          <KpiCard value={counts.all} label="Research totales" hint={`+${newToday} hoy`} />
          <KpiCard value={counts.draft} label="Sesiones en draft" hint="Listas para arrancar" />
          <KpiCard value={counts.with_roadmap} label="Roadmaps generados" hint="Hoy" />
        </section>

        <section className={styles.controls}>
          <div className={styles.searchWrap}>
            <Search className={styles.searchIcon} size={18} strokeWidth={2} aria-hidden />
            <input
              className={styles.search}
              placeholder="Buscar empresa, observaciones…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button className={styles.cta} onClick={() => setModalOpen(true)}>
            <Plus size={16} strokeWidth={2.25} />
            Nuevo research
          </button>
        </section>

        <section className={styles.filters}>
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className={`${styles.pill} ${filter === f.key ? styles.pillActive : ""}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label} · {counts[f.key]}
            </button>
          ))}
        </section>

        {error && (
          <div className={styles.errorBox}>
            No pudimos cargar los research. ¿El backend está corriendo en {" "}
            <code>localhost:8000</code>?
          </div>
        )}

        {isLoading ? (
          <div className={styles.skeleton}>Cargando research…</div>
        ) : filtered.length === 0 ? (
          <div className={styles.empty}>
            {all.length === 0
              ? "Aún no hay research. Crea el primero arriba."
              : "Ningún research coincide con los filtros actuales."}
          </div>
        ) : (
          <ResearchTable data={filtered} />
        )}
      </main>

      <NewResearchModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
