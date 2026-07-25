import { useMemo, useCallback } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  type Node,
  type Edge,
  type OnNodeDrag,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useThreadStore } from '../store/useThreadStore';
import { ThreadNode } from './ThreadNode';

const nodeTypes = { thread: ThreadNode };

const defaultEdgeOptions = {
  type: 'smoothstep',
  markerEnd: { type: MarkerType.ArrowClosed, width: 20, height: 20 },
  style: { strokeWidth: 2 },
};

function FlowCanvas() {
  const threads = useThreadStore((s) => s.threads);
  const threadEdges = useThreadStore((s) => s.edges);
  const updateNodePosition = useThreadStore((s) => s.updateNodePosition);

  const nodes: Node[] = useMemo(
    () =>
      Object.values(threads).map((thread) => ({
        id: thread.id,
        type: 'thread',
        position: thread.position,
        data: {},
        draggable: true,
      })),
    [threads],
  );

  const edges: Edge[] = useMemo(
    () =>
      threadEdges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
      })),
    [threadEdges],
  );

  const handleNodeDragStop: OnNodeDrag = useCallback(
    (_event, node) => {
      updateNodePosition(node.id, node.position);
    },
    [updateNodePosition],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      defaultEdgeOptions={defaultEdgeOptions}
      onNodeDragStop={handleNodeDragStop}
      minZoom={0.1}
      maxZoom={1.5}
      fitView
    >
      <Background gap={24} />
      <Controls />
      <MiniMap pannable zoomable />
    </ReactFlow>
  );
}

export function Canvas() {
  return (
    <div className="h-screen w-screen">
      <ReactFlowProvider>
        <FlowCanvas />
      </ReactFlowProvider>
    </div>
  );
}
