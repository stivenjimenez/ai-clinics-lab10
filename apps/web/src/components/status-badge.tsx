import { Circle } from "lucide-react";

import styles from "./status-badge.module.css";
import type { Research, ResearchStatus } from "@/lib/types";

type FlowStatus =
  | "pending"
  | "researching"
  | "failed"
  | "brief_ready"
  | "in_diagnostic"
  | "insight_ready"
  | "roadmap_ready";

const LABELS: Record<FlowStatus, string> = {
  pending:       "Pendiente",
  researching:   "Investigando…",
  failed:        "Falló",
  brief_ready:   "Brief listo",
  in_diagnostic: "En diagnóstico",
  insight_ready: "Insights listos",
  roadmap_ready: "Roadmap listo",
};

const VARIANT: Record<FlowStatus, string> = {
  pending:       styles.neutral,
  researching:   styles.warning,
  failed:        styles.danger,
  brief_ready:   styles.info,
  in_diagnostic: styles.outline,
  insight_ready: styles.success,
  roadmap_ready: styles.black,
};

function deriveFlow(
  status: ResearchStatus,
  has_answers: boolean,
  has_insight: boolean,
  has_roadmap: boolean,
): FlowStatus {
  if (status === "pending")     return "pending";
  if (status === "researching") return "researching";
  if (status === "failed")      return "failed";
  // status === "ready"
  if (has_roadmap) return "roadmap_ready";
  if (has_insight) return "insight_ready";
  if (has_answers) return "in_diagnostic";
  return "brief_ready";
}

type Props =
  | { research: Pick<Research, "status" | "has_answers" | "has_insight" | "has_roadmap"> }
  | { status: ResearchStatus };

export function StatusBadge(props: Props) {
  let flow: FlowStatus;

  if ("research" in props) {
    const { status, has_answers, has_insight, has_roadmap } = props.research;
    flow = deriveFlow(status, has_answers, has_insight, has_roadmap);
  } else {
    flow = deriveFlow(props.status, false, false, false);
  }

  const label = LABELS[flow];
  const variant = VARIANT[flow];

  return (
    <span className={`${styles.badge} ${variant}`}>
      {flow === "researching" && (
        <Circle className={styles.dot} size={8} strokeWidth={0} fill="currentColor" aria-hidden />
      )}
      {label}
    </span>
  );
}
