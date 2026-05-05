"use client";

import { useMemo } from "react";
import { jsPDF } from "jspdf";

import {
  NODE_TYPE_LABEL,
  type RoadmapNode,
  type RoadmapPayload,
} from "@/lib/roadmap-types";

import styles from "./roadmap-text-modal.module.css";

type Props = {
  payload: RoadmapPayload;
  companyName?: string;
};

export function orderRoadmapNodes(payload: RoadmapPayload): RoadmapNode[] {
  const byId = new Map<string, RoadmapNode>();
  for (const n of payload.nodes) byId.set(n.id, n);

  const start = payload.nodes.find((n) => n.type === "problem");
  if (start && payload.edges.length > 0) {
    const adj = new Map<string, string[]>();
    for (const e of payload.edges) {
      const arr = adj.get(e.source) ?? [];
      arr.push(e.target);
      adj.set(e.source, arr);
    }
    const visited = new Set<string>();
    const ordered: RoadmapNode[] = [];
    let cursor: string | undefined = start.id;
    while (cursor && !visited.has(cursor)) {
      visited.add(cursor);
      const node = byId.get(cursor);
      if (node) ordered.push(node);
      const next = adj.get(cursor);
      cursor = next && next.length > 0 ? next[0] : undefined;
    }
    if (ordered.length === payload.nodes.length) return ordered;
    for (const n of payload.nodes) {
      if (!visited.has(n.id)) ordered.push(n);
    }
    return ordered;
  }

  const problem = payload.nodes.filter((n) => n.type === "problem");
  const steps = payload.nodes
    .filter((n) => n.type === "step")
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  const result = payload.nodes.filter((n) => n.type === "result");
  return [...problem, ...steps, ...result];
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    || "roadmap";
}

export function downloadRoadmapPdf(
  payload: RoadmapPayload,
  companyName?: string,
) {
  const ordered = orderRoadmapNodes(payload);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 48;
  const marginTop = 56;
  const marginBottom = 56;
  const contentW = pageW - marginX * 2;

  let y = marginTop;

  function ensureSpace(needed: number) {
    if (y + needed > pageH - marginBottom) {
      doc.addPage();
      y = marginTop;
    }
  }

  function writeLines(text: string, lineHeight: number) {
    const lines = doc.splitTextToSize(text, contentW) as string[];
    for (const line of lines) {
      ensureSpace(lineHeight);
      doc.text(line, marginX, y);
      y += lineHeight;
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text("ROADMAP", marginX, y);
  y += 16;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(20);
  writeLines(companyName ?? "Roadmap", 24);
  y += 14;

  doc.setDrawColor(220);
  doc.line(marginX, y, pageW - marginX, y);
  y += 22;

  ordered.forEach((node, idx) => {
    if (idx > 0) {
      ensureSpace(28);
      doc.setDrawColor(235);
      doc.line(marginX, y, pageW - marginX, y);
      y += 18;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(120);
    ensureSpace(14);
    doc.text(NODE_TYPE_LABEL[node.type].toUpperCase(), marginX, y);
    y += 16;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(20);
    writeLines(node.data.title, 18);
    y += 4;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(40);
    writeLines(node.data.description, 16);
    y += 4;
  });

  const filename = `roadmap-${slugify(companyName ?? "roadmap")}.pdf`;
  doc.save(filename);
}

export function RoadmapTextView({ payload }: Props) {
  const ordered = useMemo(() => orderRoadmapNodes(payload), [payload]);

  return (
    <div className={styles.body}>
      {ordered.map((node) => (
        <section key={node.id} className={styles.section}>
          <span className={styles.kind}>{NODE_TYPE_LABEL[node.type]}</span>
          <h3 className={styles.nodeTitle}>{node.data.title}</h3>
          <p className={styles.nodeDesc}>{node.data.description}</p>
        </section>
      ))}
    </div>
  );
}
