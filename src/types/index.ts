export type Role = 'user' | 'assistant';

/**
 * Judgement the user has passed on a path. Drives node colour on the canvas
 * and the status column in the list view; never set automatically.
 */
export type ThreadStatus = 'open' | 'promising' | 'dead-end' | 'chosen';

export const THREAD_STATUSES: ThreadStatus[] = ['open', 'promising', 'dead-end', 'chosen'];

export interface Message {
  id: string;
  role: Role;
  content: string;
  timestamp: number;
}

export interface Position {
  x: number;
  y: number;
}

export interface Thread {
  id: string;
  /**
   * Empty for the root. One entry for an ordinary branch or fan-out variant.
   * Two or more for a merge node, whose context was synthesized from each.
   */
  parentThreadIds: string[];
  /**
   * The assistant message in the (single) parent this branch was taken from.
   * Only meaningful when parentThreadIds.length === 1 — merge nodes have no
   * single branch point. Nulled when lineage is rewired by a delete, since
   * the id no longer resolves.
   */
  branchFromMessageId: string | null;
  title: string;
  messages: Message[];
  position: Position;
  status: ThreadStatus;
  /** Transient: reset on reload, since any in-flight request dies with the page. */
  isGeneratingReply: boolean;
  /** Transient: last generation failure, cleared on retry. */
  error: string | null;
  createdAt: number;
}

/**
 * 'branch' edges are structural lineage — auto-created by branching, fan-out,
 * or merging — and are what layout and context derive from. 'reference'
 * edges are manual, user-drawn annotations between any two nodes; they carry
 * no context and never affect layout.
 */
export type EdgeType = 'branch' | 'reference';

export interface ThreadEdge {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
}
