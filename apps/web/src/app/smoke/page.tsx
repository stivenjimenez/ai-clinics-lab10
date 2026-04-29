"use client";

import { useEffect, useState } from "react";
import styles from "./smoke.module.css";

type Company = {
  id: string;
  name: string;
  website: string | null;
  industry: string | null;
  created_at: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function SmokePage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [industry, setIndustry] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadCompanies() {
    try {
      const res = await fetch(`${API_URL}/companies`, { cache: "no-store" });
      if (!res.ok) throw new Error(`GET /companies → ${res.status}`);
      setCompanies(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando empresas");
    }
  }

  useEffect(() => {
    loadCompanies();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/companies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          website: website.trim() || null,
          industry: industry.trim() || null,
        }),
      });
      if (!res.ok) throw new Error(`POST /companies → ${res.status}`);
      setName("");
      setWebsite("");
      setIndustry("");
      await loadCompanies();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error creando empresa");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      <header>
        <span className={styles.tag}>Smoke Test</span>
        <h1 className={styles.title}>Next.js → FastAPI → Supabase</h1>
        <p className={styles.subtitle}>
          Verificación end-to-end de la Etapa 1. Crea una empresa y debe aparecer en la lista.
        </p>
      </header>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Crear empresa</h2>
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="name">
              Nombre *
            </label>
            <input
              id="name"
              className={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Coca-Cola"
              required
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="website">
              Website
            </label>
            <input
              id="website"
              className={styles.input}
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://coca-cola.com"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="industry">
              Industria
            </label>
            <input
              id="industry"
              className={styles.input}
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="Bebidas"
            />
          </div>
          <button className={styles.button} type="submit" disabled={submitting}>
            {submitting ? "Guardando..." : "Crear"}
          </button>
          {error && <p className={styles.error}>{error}</p>}
        </form>
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Empresas en la base ({companies.length})</h2>
        {companies.length === 0 ? (
          <p className={styles.empty}>Aún no hay empresas. Crea la primera arriba.</p>
        ) : (
          <ul className={styles.list}>
            {companies.map((c) => (
              <li key={c.id} className={styles.item}>
                <span className={styles.itemName}>{c.name}</span>
                <span className={styles.itemMeta}>
                  {c.industry ?? "sin industria"} · {c.website ?? "sin website"} ·{" "}
                  {new Date(c.created_at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
