"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";

import "@xyflow/react/dist/style.css";

import {
  NODE_TYPE_LABEL,
  type RoadmapEdge,
  type RoadmapNode,
  type RoadmapNodeData,
  type RoadmapNodeType,
  type RoadmapPayload,
} from "@/lib/roadmap-types";
import { layoutRoadmap } from "@/lib/roadmap-layout";

import styles from "./roadmap-canvas.module.css";

type FlowNode = Node<RoadmapNodeData, RoadmapNodeType>;
type FlowEdge = Edge;

function RoadmapStepNode({ data, type, selected }: NodeProps<FlowNode>) {
  const kind = (type as RoadmapNodeType) ?? "action";
  return (
    <div
      className={`${styles.node}${selected ? ` ${styles.selected}` : ""}`}
      data-type={kind}
    >
      <Handle type="target" position={Position.Top} />
      <span className={styles.kind}>{NODE_TYPE_LABEL[kind]}</span>
      <h4 className={styles.title}>{data.title}</h4>
      <p className={styles.desc}>{data.description}</p>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

const nodeTypes = {
  problem: RoadmapStepNode,
  action: RoadmapStepNode,
  milestone: RoadmapStepNode,
};

function toFlow(nodes: RoadmapNode[], edges: RoadmapEdge[]): {
  nodes: FlowNode[];
  edges: FlowEdge[];
} {
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: n.data,
    })),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
    })),
  };
}

// Si todos los nodos vienen en (0,0) asumimos que el LLM aún no aplicó layout.
function needsLayout(nodes: RoadmapNode[]): boolean {
  return nodes.every((n) => n.position.x === 0 && n.position.y === 0);
}

type RoadmapCanvasProps = {
  payload: RoadmapPayload;
  onPayloadChange?: (payload: RoadmapPayload) => void;
};

function RoadmapCanvasInner({
  payload,
  onPayloadChange,
}: RoadmapCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>([]);

  // Mantengo refs al callback y a los edges originales para que `onNodeDragStop`
  // no necesite ser recreado en cada render.
  const onPayloadChangeRef = useRef(onPayloadChange);
  onPayloadChangeRef.current = onPayloadChange;

  const originalEdgesRef = useRef<RoadmapEdge[]>(payload.edges);
  originalEdgesRef.current = payload.edges;

  useEffect(() => {
    let cancelled = false;
    const apply = async () => {
      const laid = needsLayout(payload.nodes)
        ? await layoutRoadmap(payload.nodes, payload.edges)
        : payload.nodes;
      if (cancelled) return;
      const flow = toFlow(laid, payload.edges);
      setNodes(flow.nodes);
      setEdges(flow.edges);

      // Si el LLM nos dio nodos en (0,0) y aquí calculamos posiciones reales,
      // empuja el payload con posiciones para que el backend las persista.
      if (needsLayout(payload.nodes)) {
        onPayloadChangeRef.current?.({
          nodes: laid,
          edges: payload.edges,
        });
      }
    };
    apply();
    return () => {
      cancelled = true;
    };
  }, [payload, setNodes, setEdges]);

  const handleNodeDragStop = useCallback(() => {
    if (!onPayloadChangeRef.current) return;
    const cb = onPayloadChangeRef.current;
    // Reconstruyo el payload usando el estado actual de xyflow.
    setNodes((current) => {
      const next: RoadmapNode[] = current.map((n) => ({
        id: n.id,
        type: (n.type as RoadmapNodeType) ?? "action",
        data: n.data as RoadmapNodeData,
        position: { x: n.position.x, y: n.position.y },
      }));
      cb({ nodes: next, edges: originalEdgesRef.current });
      return current;
    });
  }, [setNodes]);

  const fitViewOptions = useMemo(() => ({ padding: 0.2 }), []);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeDragStop={handleNodeDragStop}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={fitViewOptions}
      nodesDraggable
      nodesConnectable={false}
      proOptions={{ hideAttribution: false }}
    >
      <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="#d8d8d4" />
      <Controls position="bottom-right" showInteractive={false} />
      <MiniMap pannable zoomable position="bottom-left" />
    </ReactFlow>
  );
}

export function RoadmapCanvas({
  payload,
  onPayloadChange,
}: RoadmapCanvasProps) {
  return (
    <div className={styles.canvas}>
      <ReactFlowProvider>
        <RoadmapCanvasInner
          payload={payload}
          onPayloadChange={onPayloadChange}
        />
      </ReactFlowProvider>
    </div>
  );
}
