import ELK from "elkjs/lib/elk.bundled.js";

import type { RoadmapEdge, RoadmapNode, RoadmapNodeData } from "./roadmap-types";

const elk = new ELK();

const NODE_WIDTH = 260;
// Espacio que el contenido del nodo ocupa además del texto (kind + paddings).
const NODE_VERTICAL_CHROME = 70;
// Anchos típicos en píxeles dentro del nodo para estimar saltos de línea.
const TITLE_CHARS_PER_LINE = 28;
const DESC_CHARS_PER_LINE = 38;
const TITLE_LINE_HEIGHT = 20;
const DESC_LINE_HEIGHT = 18;

function estimateLines(text: string, charsPerLine: number): number {
  if (!text) return 1;
  // Cuenta líneas explícitas más wrap aproximado por longitud.
  const explicit = text.split("\n");
  let total = 0;
  for (const line of explicit) {
    const len = Math.max(line.length, 1);
    total += Math.ceil(len / charsPerLine);
  }
  return Math.max(total, 1);
}

function estimateNodeHeight(data: RoadmapNodeData): number {
  const titleLines = estimateLines(data.title || "", TITLE_CHARS_PER_LINE);
  const descLines = estimateLines(data.description || "", DESC_CHARS_PER_LINE);
  return (
    NODE_VERTICAL_CHROME +
    titleLines * TITLE_LINE_HEIGHT +
    descLines * DESC_LINE_HEIGHT
  );
}

export async function layoutRoadmap(
  nodes: RoadmapNode[],
  edges: RoadmapEdge[],
): Promise<RoadmapNode[]> {
  if (nodes.length === 0) return nodes;

  const graph = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "DOWN",
      // Separación vertical entre niveles. Generosa para que descripciones
      // largas no se solapen y los edges sean visibles.
      "elk.layered.spacing.nodeNodeBetweenLayers": "80",
      // Separación horizontal entre nodos del mismo nivel.
      "elk.spacing.nodeNode": "48",
      "elk.padding": "[top=24,left=24,bottom=24,right=24]",
    },
    children: nodes.map((n) => ({
      id: n.id,
      width: NODE_WIDTH,
      // Alto estimado a partir del contenido — ELK sumará la separación
      // sobre el alto real de cada nodo, evitando pegamento entre cards.
      height: estimateNodeHeight(n.data),
    })),
    edges: edges.map((e) => ({
      id: e.id,
      sources: [e.source],
      targets: [e.target],
    })),
  };

  const result = await elk.layout(graph);
  const positionById = new Map<string, { x: number; y: number }>();
  for (const child of result.children ?? []) {
    if (typeof child.x === "number" && typeof child.y === "number") {
      positionById.set(child.id, { x: child.x, y: child.y });
    }
  }

  return nodes.map((n) => ({
    ...n,
    position: positionById.get(n.id) ?? n.position,
  }));
}
