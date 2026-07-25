import type { Position, Thread } from '../types';

export const NODE_WIDTH = 360;
export const NODE_HEIGHT = 480;
export const H_GAP = 120;
export const V_GAP = 40;

/**
 * Generations between this thread and the root, i.e. the longest path up
 * through any parent (a merge node sits one column past its deepest source).
 * Guards against a cycle so a corrupted parent chain can't recurse forever —
 * genuine cycles can't arise through normal actions, since branching and
 * merging only ever create a new leaf, but this stays defensive.
 */
export function depthOf(threadId: string, threads: Record<string, Thread>): number {
  const memo = new Map<string, number>();

  function compute(id: string, seen: Set<string>): number {
    const cached = memo.get(id);
    if (cached !== undefined) return cached;
    if (seen.has(id)) return 0;

    const thread = threads[id];
    if (!thread || thread.parentThreadIds.length === 0) {
      memo.set(id, 0);
      return 0;
    }

    const nextSeen = new Set(seen).add(id);
    const depth = 1 + Math.max(...thread.parentThreadIds.map((pid) => compute(pid, nextSeen)));
    memo.set(id, depth);
    return depth;
  }

  return compute(threadId, new Set());
}

/**
 * Places a new node one column past the deepest of its source threads, in
 * the next free vertical slot within that column — guaranteeing no overlap
 * with any existing node. Used for ordinary branches (one source), fan-out
 * siblings (one source, called repeatedly), and merges (multiple sources).
 */
export function computeBranchPosition(
  sources: Thread[],
  threads: Record<string, Thread>,
): Position {
  const depth = Math.max(...sources.map((s) => depthOf(s.id, threads))) + 1;
  const x = depth * (NODE_WIDTH + H_GAP);

  const sameColumn = Object.values(threads).filter(
    (t) => depthOf(t.id, threads) === depth,
  );

  if (sameColumn.length === 0) {
    return { x, y: sources[0].position.y };
  }

  const maxY = Math.max(...sameColumn.map((t) => t.position.y));
  return { x, y: maxY + NODE_HEIGHT + V_GAP };
}
