import styles from "./kpi-card.module.css";

type KpiCardProps = {
  value: number | string;
  label: string;
  hint?: string;
  accent?: boolean;
};

export function KpiCard({ value, label, hint, accent }: KpiCardProps) {
  return (
    <div className={styles.card}>
      <span className={accent ? styles.valueAccent : styles.value}>{value}</span>
      <span className={styles.label}>{label}</span>
      {hint && <span className={accent ? styles.hintAccent : styles.hint}>{hint}</span>}
    </div>
  );
}
