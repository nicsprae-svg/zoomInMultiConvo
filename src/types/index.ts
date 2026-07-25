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
  parentThreadId: string | null;
  /**
   * The assistant message in the parent thread this branch was taken from.
   * Nulled when lineage is rewired by a delete, since the id no longer resolves.
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

export interface ThreadEdge {
  id: string;
  source: string;
  target: string;
}
