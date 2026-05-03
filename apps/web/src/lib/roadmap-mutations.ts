import type {
  RoadmapEdge,
  RoadmapNode,
  RoadmapNodeType,
  RoadmapPayload,
} from "./roadmap-types";

export class RoadmapMutationError extends Error {}

// Encuentra la cadena lineal del roadmap empezando por `problem`. Si la
// estructura no es lineal, devuelve la mejor reconstrucción posible.
function getChain(payload: RoadmapPayload): string[] {
  const bySource = new Map<string, string>();
  for (const e of payload.edges) bySource.set(e.source, e.target);

  const chain: string[] = ["problem"];
  const seen = new Set<string>(["problem"]);
  let cur = "problem";
  while (bySource.has(cur)) {
    const next = bySource.get(cur)!;
    if (seen.has(next)) break;
    chain.push(next);
    seen.add(next);
    cur = next;
  }
  return chain;
}

function rebuildEdges(chain: string[]): RoadmapEdge[] {
  const edges: RoadmapEdge[] = [];
  for (let i = 0; i < chain.length - 1; i++) {
    edges.push({ id: `e${i}`, source: chain[i], target: chain[i + 1] });
  }
  return edges;
}

export type AddNodeArgs = {
  id: string;
  type: "action" | "milestone";
  title: string;
  description: string;
  after_id: string;
};

export function addNode(
  payload: RoadmapPayload,
  args: AddNodeArgs,
): RoadmapPayload {
  if (payload.nodes.some((n) => n.id === args.id)) {
    throw new RoadmapMutationError(`node id "${args.id}" ya existe`);
  }
  const chain = getChain(payload);
  const idx = chain.indexOf(args.after_id);
  if (idx === -1) {
    throw new RoadmapMutationError(
      `after_id "${args.after_id}" no existe en la cadena`,
    );
  }
  const newNode: RoadmapNode = {
    id: args.id,
    type: args.type,
    data: { title: args.title, description: args.description },
    position: { x: 0, y: 0 },
  };
  const newChain = [...chain.slice(0, idx + 1), args.id, ...chain.slice(idx + 1)];
  return {
    nodes: [...payload.nodes, newNode],
    edges: rebuildEdges(newChain),
  };
}

export type UpdateNodeArgs = {
  id: string;
  title?: string;
  description?: string;
  type?: "action" | "milestone";
};

export function updateNode(
  payload: RoadmapPayload,
  args: UpdateNodeArgs,
): RoadmapPayload {
  if (args.id === "problem") {
    throw new RoadmapMutationError(
      "no se puede editar el nodo problem con update_node — usa update_problem",
    );
  }
  const idx = payload.nodes.findIndex((n) => n.id === args.id);
  if (idx === -1) {
    throw new RoadmapMutationError(`node id "${args.id}" no existe`);
  }
  const cur = payload.nodes[idx];
  const next: RoadmapNode = {
    ...cur,
    type: (args.type ?? cur.type) as RoadmapNodeType,
    data: {
      title: args.title ?? cur.data.title,
      description: args.description ?? cur.data.description,
    },
  };
  return {
    nodes: payload.nodes.map((n, i) => (i === idx ? next : n)),
    edges: payload.edges,
  };
}

export type RemoveNodeArgs = { id: string };

export function removeNode(
  payload: RoadmapPayload,
  args: RemoveNodeArgs,
): RoadmapPayload {
  if (args.id === "problem") {
    throw new RoadmapMutationError("no se puede eliminar el nodo problem");
  }
  if (!payload.nodes.some((n) => n.id === args.id)) {
    throw new RoadmapMutationError(`node id "${args.id}" no existe`);
  }
  const chain = getChain(payload).filter((id) => id !== args.id);
  return {
    nodes: payload.nodes.filter((n) => n.id !== args.id),
    edges: rebuildEdges(chain),
  };
}

export type ReorderNodesArgs = { order: string[] };

export function reorderNodes(
  payload: RoadmapPayload,
  args: ReorderNodesArgs,
): RoadmapPayload {
  const existing = payload.nodes.filter((n) => n.id !== "problem").map((n) => n.id);
  if (args.order.length !== existing.length) {
    throw new RoadmapMutationError(
      `order debe tener ${existing.length} elementos, recibió ${args.order.length}`,
    );
  }
  const set = new Set(args.order);
  if (set.size !== args.order.length) {
    throw new RoadmapMutationError("order tiene IDs duplicados");
  }
  for (const id of args.order) {
    if (!existing.includes(id)) {
      throw new RoadmapMutationError(`order contiene id desconocido: "${id}"`);
    }
  }
  const newChain = ["problem", ...args.order];
  return {
    nodes: payload.nodes,
    edges: rebuildEdges(newChain),
  };
}

export type UpdateProblemArgs = {
  title?: string;
  description?: string;
};

export function updateProblem(
  payload: RoadmapPayload,
  args: UpdateProblemArgs,
): RoadmapPayload {
  const idx = payload.nodes.findIndex((n) => n.id === "problem");
  if (idx === -1) {
    throw new RoadmapMutationError("no existe nodo problem");
  }
  const cur = payload.nodes[idx];
  const next: RoadmapNode = {
    ...cur,
    data: {
      title: args.title ?? cur.data.title,
      description: args.description ?? cur.data.description,
    },
  };
  return {
    nodes: payload.nodes.map((n, i) => (i === idx ? next : n)),
    edges: payload.edges,
  };
}

// ---------- Dispatch ----------

export type ToolName =
  | "add_node"
  | "update_node"
  | "remove_node"
  | "reorder_nodes"
  | "update_problem";

export type ToolResult =
  | { ok: true }
  | { ok: false; error: string };

export function applyMutation(
  payload: RoadmapPayload,
  toolName: string,
  input: unknown,
): { next: RoadmapPayload; result: ToolResult } {
  try {
    switch (toolName) {
      case "add_node":
        return {
          next: addNode(payload, input as AddNodeArgs),
          result: { ok: true },
        };
      case "update_node":
        return {
          next: updateNode(payload, input as UpdateNodeArgs),
          result: { ok: true },
        };
      case "remove_node":
        return {
          next: removeNode(payload, input as RemoveNodeArgs),
          result: { ok: true },
        };
      case "reorder_nodes":
        return {
          next: reorderNodes(payload, input as ReorderNodesArgs),
          result: { ok: true },
        };
      case "update_problem":
        return {
          next: updateProblem(payload, input as UpdateProblemArgs),
          result: { ok: true },
        };
      default:
        return {
          next: payload,
          result: { ok: false, error: `tool desconocida: ${toolName}` },
        };
    }
  } catch (e) {
    return {
      next: payload,
      result: {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      },
    };
  }
}
