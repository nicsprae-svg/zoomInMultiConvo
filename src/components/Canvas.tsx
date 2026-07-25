import { useMemo, useCallback, useState, useEffect } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  Panel,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  type Node,
  type Edge,
  type OnNodeDrag,
  type OnConnect,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useThreadStore } from '../store/useThreadStore';
import { ThreadNode } from './ThreadNode';
import { ReferenceEdge } from './ReferenceEdge';
import { ListView } from './ListView';
import { ComparePanel } from './ComparePanel';

const nodeTypes = { thread: ThreadNode };
const edgeTypes = { reference: ReferenceEdge };

const defaultEdgeOptions = {
  type: 'smoothstep',
};

function FlowCanvas() {
  const threads = useThreadStore((s) => s.threads);
  const threadEdges = useThreadStore((s) => s.edges);
  const updateNodePosition = useThreadStore((s) => s.updateNodePosition);
  const addReferenceEdge = useThreadStore((s) => s.addReferenceEdge);

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
      threadEdges.map((edge) => {
        const isReference = edge.type === 'reference';
        return {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          // Reference edges route to a custom component with its own delete
          // button; branch edges use the default smoothstep renderer and are
          // only ever removed structurally, via deleteThread.
          type: isReference ? 'reference' : undefined,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 18,
            height: 18,
            color: isReference ? '#94a3b8' : '#64748b',
          },
          style: isReference
            ? { strokeWidth: 1.5, strokeDasharray: '6 4', stroke: '#94a3b8' }
            : { strokeWidth: 2, stroke: '#64748b' },
        };
      }),
    [threadEdges],
  );

  const handleNodeDragStop: OnNodeDrag = useCallback(
    (_event, node) => {
      updateNodePosition(node.id, node.position);
    },
    [updateNodePosition],
  );

  const handleConnect: OnConnect = useCallback(
    (connection) => {
      if (!connection.source || !connection.target) return;
      addReferenceEdge(connection.source, connection.target);
    },
    [addReferenceEdge],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      defaultEdgeOptions={defaultEdgeOptions}
      onNodeDragStop={handleNodeDragStop}
      onConnect={handleConnect}
      minZoom={0.1}
      maxZoom={1.5}
      fitView
    >
      <Background gap={24} />
      <Controls />
      <MiniMap pannable zoomable />
      <Panel position="bottom-left" className="pointer-events-none rounded bg-white/80 px-2 py-1 text-[11px] text-gray-500 shadow-sm">
        Drag between node handles to link threads · dashed = reference · click
        its ✕ to remove it
      </Panel>
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
