import type { Position, Thread, ThreadEdge } from '../types';

export const NODE_WIDTH = 360;
export const NODE_HEIGHT = 480;
export const H_GAP = 120;
export const V_GAP = 40;

function depthOf(threadId: string, threads: Record<string, Thread>): number {
  let depth = 0;
  let current = threads[threadId];
  while (current?.parentThreadId) {
    depth += 1;
    current = threads[current.parentThreadId];
  }
  return depth;
}

/**
 * Places a new branch node in the next free vertical slot within its
 * generation's column, guaranteeing no overlap with any existing node.
 */
export function computeBranchPosition(
  parent: Thread,
  threads: Record<string, Thread>,
  _edges: ThreadEdge[],
): Position {
  const depth = depthOf(parent.id, threads) + 1;
  const x = depth * (NODE_WIDTH + H_GAP);

  const sameColumn = Object.values(threads).filter(
    (t) => depthOf(t.id, threads) === depth,
  );

  if (sameColumn.length === 0) {
    return { x, y: parent.position.y };
  }

  const maxY = Math.max(...sameColumn.map((t) => t.position.y));
  return { x, y: maxY + NODE_HEIGHT + V_GAP };
}
