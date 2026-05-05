export type RoadmapNodeType = "problem" | "step" | "result";

export type RoadmapNodeData = {
  title: string;
  description: string;
};

export type RoadmapNode = {
  id: string;
  type: RoadmapNodeType;
  data: RoadmapNodeData;
  position: { x: number; y: number };
};

export const NODE_TYPE_LABEL: Record<RoadmapNodeType, string> = {
  problem: "Problema",
  step: "Paso",
  result: "Resultado",
};

export type RoadmapEdge = {
  id: string;
  source: string;
  target: string;
};

export type RoadmapPayload = {
  nodes: RoadmapNode[];
  edges: RoadmapEdge[];
};
