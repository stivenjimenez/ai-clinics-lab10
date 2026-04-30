import styles from "./status-badge.module.css";
import type { ResearchStatus } from "@/lib/types";

type DerivedStatus =
  | "pending"
  | "researching"
  | "ready"
  | "failed"
  | "session_draft"
  | "session_in_progress"
  | "roadmap_done";

const LABELS: Record<DerivedStatus, string> = {
  pending: "Pendiente",
  researching: "Investigando…",
  ready: "Research completado",
  failed: "Falló",
  session_draft: "Sesión en draft",
  session_in_progress: "Sesión en progreso",
  roadmap_done: "Roadmap generado",
};

const VARIANT: Record<DerivedStatus, string> = {
  pending: styles.neutral,
  researching: styles.warning,
  ready: styles.info,
  failed: styles.danger,
  session_draft: styles.outline,
  session_in_progress: styles.success,
  roadmap_done: styles.black,
};

export function StatusBadge({ status }: { status: ResearchStatus | DerivedStatus }) {
  const key = status as DerivedStatus;
  const label = LABELS[key] ?? status;
  const variant = VARIANT[key] ?? styles.neutral;
  return (
    <span className={`${styles.badge} ${variant}`}>
      {key === "session_in_progress" && <span className={styles.dot} aria-hidden />}
      {label}
    </span>
  );
}
