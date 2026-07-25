import type { Thread, ThreadStatus } from '../types';
import { depthOf } from './layout';

export interface ThreadRow {
  id: string;
  depth: number;
  title: string;
  parentTitle: string | null;
  /** Excerpt of the parent message this thread branched from, if still known. */
  branchFrom: string | null;
  messageCount: number;
  /** Last message timestamp, falling back to creation time for empty threads. */
  lastActivity: number;
  status: ThreadStatus;
  isGeneratingReply: boolean;
  hasError: boolean;
}

export function excerpt(text: string, max = 60): string {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  return collapsed.length > max ? `${collapsed.slice(0, max)}…` : collapsed;
}

/**
 * Flattens the thread graph into one row per thread, resolving each thread's
 * parent title and branch-point excerpt so the list view can show lineage
 * without walking the graph itself.
 */
export function buildThreadRows(threads: Record<string, Thread>): ThreadRow[] {
  const rows = Object.values(threads).map((thread) => {
    const parent = thread.parentThreadId ? threads[thread.parentThreadId] : undefined;
    const branchMessage =
      parent && thread.branchFromMessageId
        ? parent.messages.find((m) => m.id === thread.branchFromMessageId)
        : undefined;
    const lastMessage = thread.messages[thread.messages.length - 1];

    return {
      id: thread.id,
      depth: depthOf(thread.id, threads),
      title: thread.title,
      parentTitle: parent?.title ?? null,
      branchFrom: branchMessage ? excerpt(branchMessage.content) : null,
      messageCount: thread.messages.length,
      lastActivity: lastMessage?.timestamp ?? thread.createdAt,
      status: thread.status,
      isGeneratingReply: thread.isGeneratingReply,
      hasError: thread.error !== null,
    };
  });

  // Depth first, then creation order within a generation, so lineage reads
  // top-to-bottom the same way the canvas reads left-to-right.
  return rows.sort((a, b) => a.depth - b.depth || a.lastActivity - b.lastActivity);
}

export type SortKey = 'depth' | 'title' | 'messageCount' | 'lastActivity' | 'status';

export function sortRows(rows: ThreadRow[], key: SortKey, ascending: boolean): ThreadRow[] {
  const direction = ascending ? 1 : -1;
  return [...rows].sort((a, b) => {
    switch (key) {
      case 'title':
        return a.title.localeCompare(b.title) * direction;
      case 'status':
        return a.status.localeCompare(b.status) * direction;
      case 'messageCount':
        return (a.messageCount - b.messageCount) * direction;
      case 'lastActivity':
        return (a.lastActivity - b.lastActivity) * direction;
      case 'depth':
      default:
        return (a.depth - b.depth) * direction;
    }
  });
}
