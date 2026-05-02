import ELK from "elkjs/lib/elk.bundled.js";

import type { RoadmapEdge, RoadmapNode } from "./roadmap-types";

const elk = new ELK();

const NODE_WIDTH = 260;
const NODE_HEIGHT = 130;

// Layout en línea horizontal: cada paso a la derecha del anterior.
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
      "elk.layered.spacing.nodeNodeBetweenLayers": "60",
      "elk.spacing.nodeNode": "32",
    },
    children: nodes.map((n) => ({
      id: n.id,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
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
