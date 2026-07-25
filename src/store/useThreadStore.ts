import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { Message, Position, Thread, ThreadEdge, ThreadStatus } from '../types';
import { generateId } from '../lib/id';
import { llmClient, type LLMMessage } from '../lib/mockLLM';
import { computeBranchPosition } from '../lib/layout';
import { debounce, loadState, saveState } from './persistence';

interface ThreadStoreState {
  threads: Record<string, Thread>;
  edges: ThreadEdge[];
  rootThreadId: string | null;

  sendUserMessage: (threadId: string, content: string) => void;
  /** Re-runs generation against the thread's current history after a failure. */
  retryReply: (threadId: string) => void;
  branchFromMessage: (sourceThreadId: string, messageId: string) => string;
  /**
   * Regenerates an assistant message `count` different ways: branches at the
   * user turn preceding it (excluding the original reply) into `count` new
   * sibling threads, each requesting its own reply concurrently. Returns the
   * new thread ids.
   */
  branchFanOut: (sourceThreadId: string, messageId: string, count: number) => string[];
  /** Appends the same user message to each thread and generates in parallel. */
  broadcastMessage: (threadIds: string[], content: string) => void;
  /**
   * Creates one new thread whose context is synthesized from the tail of
   * each source thread, and immediately requests a reply. Needs at least two
   * distinct, existing source threads; returns null otherwise.
   */
  mergeThreads: (sourceThreadIds: string[]) => string | null;
  /** Manual annotation edge between any two threads; never affects layout. */
  addReferenceEdge: (sourceId: string, targetId: string) => void;
  /** No-op on a 'branch' edge — structural lineage only ever changes via deleteThread. */
  removeEdge: (edgeId: string) => void;
  renameThread: (threadId: string, title: string) => void;
  setThreadStatus: (threadId: string, status: ThreadStatus) => void;
  deleteThread: (threadId: string) => void;
  updateNodePosition: (threadId: string, position: Position) => void;
}

function createThread(overrides: Partial<Thread> & Pick<Thread, 'id'>): Thread {
  return {
    parentThreadIds: [],
    branchFromMessageId: null,
    title: 'Thread',
    messages: [],
    position: { x: 0, y: 0 },
    status: 'open',
    isGeneratingReply: false,
    error: null,
    createdAt: Date.now(),
    ...overrides,
  };
}

function toLLMMessages(messages: Message[]): LLMMessage[] {
  return messages.map((m) => ({ role: m.role, content: m.content }));
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

function makeInitialState(): Pick<ThreadStoreState, 'threads' | 'edges' | 'rootThreadId'> {
  const persisted = loadState();
  if (persisted) {
    return {
      threads: persisted.threads,
      edges: persisted.edges,
      rootThreadId: persisted.rootThreadId,
    };
  }

  const rootId = generateId();
  const root = createThread({ id: rootId, title: 'Main thread' });
  return { threads: { [rootId]: root }, edges: [], rootThreadId: rootId };
}

export const useThreadStore = create<ThreadStoreState>()(
  subscribeWithSelector((set, get) => {
    /** Immutably updates one thread, no-op if it has since been deleted. */
    const patchThread = (threadId: string, patch: (thread: Thread) => Thread) => {
      set((state) => {
        const thread = state.threads[threadId];
        if (!thread) return state;
        return { threads: { ...state.threads, [threadId]: patch(thread) } };
      });
    };

    /**
     * Generates a reply from the thread's current history. Always clears
     * `isGeneratingReply`, on both paths — a rejection that left it set would
     * disable the thread's input with no way back short of wiping storage.
     * `variantHint` is passed through so concurrent calls sharing identical
     * history (fan-out, broadcast) don't come back as duplicates.
     */
    const requestReply = (threadId: string, variantHint?: string) => {
      patchThread(threadId, (thread) => ({
        ...thread,
        isGeneratingReply: true,
        error: null,
      }));

      const history = get().threads[threadId]?.messages ?? [];

      llmClient
        .getReply(toLLMMessages(history), variantHint)
        .then((replyContent) => {
          const assistantMessage: Message = {
            id: generateId(),
            role: 'assistant',
            content: replyContent,
            timestamp: Date.now(),
          };
          patchThread(threadId, (thread) => ({
            ...thread,
            messages: [...thread.messages, assistantMessage],
            isGeneratingReply: false,
            error: null,
          }));
        })
        .catch((err: unknown) => {
          patchThread(threadId, (thread) => ({
            ...thread,
            isGeneratingReply: false,
            error: err instanceof Error ? err.message : 'Failed to generate a reply',
          }));
        });
    };

    return {
      ...makeInitialState(),

      sendUserMessage: (threadId, content) => {
        const trimmed = content.trim();
        if (!trimmed) return;
        if (!get().threads[threadId]) return;

        const userMessage: Message = {
          id: generateId(),
          role: 'user',
          content: trimmed,
          timestamp: Date.now(),
        };

        patchThread(threadId, (thread) => ({
          ...thread,
          messages: [...thread.messages, userMessage],
        }));

        requestReply(threadId);
      },

      retryReply: (threadId) => {
        const thread = get().threads[threadId];
        if (!thread || thread.isGeneratingReply) return;
        requestReply(threadId);
      },

      branchFromMessage: (sourceThreadId, messageId) => {
        const state = get();
        const source = state.threads[sourceThreadId];
        if (!source) return sourceThreadId;

        const branchIndex = source.messages.findIndex((m) => m.id === messageId);
        if (branchIndex === -1) return sourceThreadId;

        const inheritedMessages = source.messages
          .slice(0, branchIndex + 1)
          .map((m) => ({ ...m }));

        const newThreadId = generateId();
        const position = computeBranchPosition([source], state.threads);

        const newThread = createThread({
          id: newThreadId,
          parentThreadIds: [sourceThreadId],
          branchFromMessageId: messageId,
          title: `Branch of ${source.title}`,
          messages: inheritedMessages,
          position,
        });

        const newEdge: ThreadEdge = {
          id: `${sourceThreadId}-${newThreadId}`,
          source: sourceThreadId,
          target: newThreadId,
          type: 'branch',
        };

        set((s) => ({
          threads: { ...s.threads, [newThreadId]: newThread },
          edges: [...s.edges, newEdge],
        }));

        return newThreadId;
      },

      branchFanOut: (sourceThreadId, messageId, count) => {
        const state = get();
        const source = state.threads[sourceThreadId];
        if (!source || count < 1) return [];

        const branchIndex = source.messages.findIndex((m) => m.id === messageId);
        if (branchIndex === -1) return [];

        // Exclusive of the branched message: fan-out regenerates *that* reply
        // itself, N different ways, rather than continuing past it.
        const inheritedMessages = source.messages.slice(0, branchIndex).map((m) => ({ ...m }));

        let workingThreads = state.threads;
        const newIds: string[] = [];
        const newEdges: ThreadEdge[] = [];

        for (let i = 0; i < count; i++) {
          const newThreadId = generateId();
          const position = computeBranchPosition([source], workingThreads);
          const newThread = createThread({
            id: newThreadId,
            parentThreadIds: [sourceThreadId],
            branchFromMessageId: messageId,
            title: `Variant ${i + 1} of ${source.title}`,
            messages: inheritedMessages,
            position,
          });
          workingThreads = { ...workingThreads, [newThreadId]: newThread };
          newIds.push(newThreadId);
          newEdges.push({
            id: `${sourceThreadId}-${newThreadId}`,
            source: sourceThreadId,
            target: newThreadId,
            type: 'branch',
          });
        }

        set({ threads: workingThreads, edges: [...state.edges, ...newEdges] });

        // Each sibling starts from the exact same history, so each needs its
        // own hint or all three would come back with the same reply text.
        newIds.forEach((newThreadId) => requestReply(newThreadId, newThreadId));

        return newIds;
      },

      broadcastMessage: (threadIds, content) => {
        const trimmed = content.trim();
        if (!trimmed) return;

        const state = get();
        // Skip threads already mid-generation rather than clobbering an
        // in-flight request.
        const targetIds = threadIds.filter(
          (id) => state.threads[id] && !state.threads[id].isGeneratingReply,
        );
        if (targetIds.length === 0) return;

        set((s) => {
          const threads = { ...s.threads };
          for (const id of targetIds) {
            const thread = threads[id];
            const userMessage: Message = {
              id: generateId(),
              role: 'user',
              content: trimmed,
              timestamp: Date.now(),
            };
            threads[id] = { ...thread, messages: [...thread.messages, userMessage] };
          }
          return { threads };
        });

        // Hint with the thread id: two broadcast targets can share identical
        // history (e.g. fresh fan-out siblings), so history alone won't do.
        targetIds.forEach((id) => requestReply(id, id));
      },

      mergeThreads: (sourceThreadIds) => {
        const state = get();
        const uniqueIds = [...new Set(sourceThreadIds)];
        const sources = uniqueIds
          .map((id) => state.threads[id])
          .filter((t): t is Thread => Boolean(t));
        if (sources.length < 2) return null;

        // Distilled, not full history: each source contributes only its most
        // recent message, so synthesis reads as "reconcile these takes" rather
        // than replaying every parent transcript into the new thread.
        const promptLines = sources.map((s) => {
          const tail = s.messages[s.messages.length - 1];
          return `- "${s.title}": ${tail ? truncate(tail.content, 160) : '(no messages yet)'}`;
        });
        const synthesisMessage: Message = {
          id: generateId(),
          role: 'user',
          content: `Synthesize these threads into one coherent take:\n${promptLines.join('\n')}`,
          timestamp: Date.now(),
        };

        const newThreadId = generateId();
        const position = computeBranchPosition(sources, state.threads);
        const newThread = createThread({
          id: newThreadId,
          parentThreadIds: sources.map((s) => s.id),
          branchFromMessageId: null,
          title: `Merge of ${sources.map((s) => s.title).join(' + ')}`,
          messages: [synthesisMessage],
          position,
        });

        const newEdges: ThreadEdge[] = sources.map((s) => ({
          id: `${s.id}-${newThreadId}`,
          source: s.id,
          target: newThreadId,
          type: 'branch',
        }));

        set((s) => ({
          threads: { ...s.threads, [newThreadId]: newThread },
          edges: [...s.edges, ...newEdges],
        }));

        requestReply(newThreadId);
        return newThreadId;
      },

      addReferenceEdge: (sourceId, targetId) => {
        if (sourceId === targetId) return;
        const state = get();
        if (!state.threads[sourceId] || !state.threads[targetId]) return;

        const edgeId = `ref-${sourceId}-${targetId}`;
        if (state.edges.some((e) => e.id === edgeId)) return;

        set((s) => ({
          edges: [...s.edges, { id: edgeId, source: sourceId, target: targetId, type: 'reference' }],
        }));
      },

      removeEdge: (edgeId) => {
        set((s) => {
          const edge = s.edges.find((e) => e.id === edgeId);
          if (!edge || edge.type !== 'reference') return s;
          return { edges: s.edges.filter((e) => e.id !== edgeId) };
        });
      },

      renameThread: (threadId, title) => {
        const trimmed = title.trim();
        if (!trimmed) return;
        patchThread(threadId, (thread) => ({ ...thread, title: trimmed }));
      },

      setThreadStatus: (threadId, status) => {
        patchThread(threadId, (thread) => ({ ...thread, status }));
      },

      /**
       * Deletes a thread and reconnects its children directly to its own
       * parent(s), so no subtree is ever silently destroyed. The root cannot
       * be deleted: it anchors the graph and has no parent to adopt its
       * children. Generalized for merge nodes: a child adopts *all* of the
       * deleted thread's parents in its place, which also correctly handles
       * deleting a merge node itself (its children fan back out to every
       * thread it had synthesized). Re-parented children lose
       * `branchFromMessageId`, since it pointed at a message that lived in
       * the deleted thread (or is no longer a single unambiguous parent).
       * Their own messages are untouched — copied at branch/merge time and
       * independent ever since.
       */
      deleteThread: (threadId) => {
        const state = get();
        const target = state.threads[threadId];
        if (!target || target.parentThreadIds.length === 0) return;

        const grandparentIds = target.parentThreadIds;

        const childIds = state.edges
          .filter((e) => e.type === 'branch' && e.source === threadId)
          .map((e) => e.target);

        const threads = { ...state.threads };
        delete threads[threadId];
        for (const childId of childIds) {
          const child = threads[childId];
          if (!child) continue;
          const nextParentIds = [
            ...new Set(
              child.parentThreadIds.flatMap((pid) => (pid === threadId ? grandparentIds : [pid])),
            ),
          ];
          threads[childId] = {
            ...child,
            parentThreadIds: nextParentIds,
            branchFromMessageId: null,
          };
        }

        const survivingEdges = state.edges.filter(
          (e) => e.source !== threadId && e.target !== threadId,
        );
        const existingIds = new Set(survivingEdges.map((e) => e.id));
        const adoptionEdges: ThreadEdge[] = [];
        for (const childId of childIds) {
          if (!threads[childId]) continue;
          for (const parentId of grandparentIds) {
            const edgeId = `${parentId}-${childId}`;
            if (!existingIds.has(edgeId)) {
              adoptionEdges.push({ id: edgeId, source: parentId, target: childId, type: 'branch' });
              existingIds.add(edgeId);
            }
          }
        }

        set({ threads, edges: [...survivingEdges, ...adoptionEdges] });
      },

      updateNodePosition: (threadId, position) => {
        patchThread(threadId, (thread) => ({ ...thread, position }));
      },
    };
  }),
);

const persistDebounced = debounce(saveState, 500);

useThreadStore.subscribe(
  (state) => ({
    threads: state.threads,
    edges: state.edges,
    rootThreadId: state.rootThreadId,
  }),
  (slice) => persistDebounced(slice),
);
