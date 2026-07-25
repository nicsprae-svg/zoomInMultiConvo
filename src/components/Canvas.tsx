import { useMemo, useCallback, useState, useEffect } from 'react';
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
import { ListView } from './ListView';
import { ComparePanel } from './ComparePanel';

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
  const [showList, setShowList] = useState(false);
  const [compareIds, setCompareIds] = useState<string[] | null>(null);
  const threadCount = useThreadStore((s) => Object.keys(s.threads).length);

  // Esc closes whichever overlay is open, but only when focus isn't inside a
  // field — there Esc means "blur this input" instead. Compare, being on top,
  // closes first.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (compareIds) setCompareIds(null);
      else setShowList(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [compareIds]);

  return (
    <ReactFlowProvider>
      <div className="flex h-screen w-screen overflow-hidden">
        <div className="relative min-w-0 flex-1">
          <FlowCanvas />
          {!showList && (
            <button
              type="button"
              className="absolute right-4 top-4 z-10 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow hover:bg-gray-50"
              onClick={() => setShowList(true)}
            >
              List view ({threadCount})
            </button>
          )}
        </div>
        {showList && (
          <ListView onClose={() => setShowList(false)} onBroadcast={setCompareIds} />
        )}
      </div>
      {compareIds && (
        <ComparePanel threadIds={compareIds} onClose={() => setCompareIds(null)} />
      )}
    </ReactFlowProvider>
  );
}
