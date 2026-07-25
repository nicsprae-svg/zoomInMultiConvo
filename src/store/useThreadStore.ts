import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { Message, Position, Thread, ThreadEdge } from '../types';
import { generateId } from '../lib/id';
import { llmClient, type LLMMessage } from '../lib/mockLLM';
import { computeBranchPosition } from '../lib/layout';
import { debounce, loadState, saveState } from './persistence';

interface ThreadStoreState {
  threads: Record<string, Thread>;
  edges: ThreadEdge[];
  rootThreadId: string | null;

  sendUserMessage: (threadId: string, content: string) => void;
  branchFromMessage: (sourceThreadId: string, messageId: string) => string;
  updateNodePosition: (threadId: string, position: Position) => void;
}

function createThread(overrides: Partial<Thread> & Pick<Thread, 'id'>): Thread {
  return {
    parentThreadId: null,
    branchFromMessageId: null,
    title: 'Thread',
    messages: [],
    position: { x: 0, y: 0 },
    isGeneratingReply: false,
    createdAt: Date.now(),
    ...overrides,
  };
}

function toLLMMessages(messages: Message[]): LLMMessage[] {
  return messages.map((m) => ({ role: m.role, content: m.content }));
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
  subscribeWithSelector((set, get) => ({
    ...makeInitialState(),

    sendUserMessage: (threadId, content) => {
      const trimmed = content.trim();
      if (!trimmed) return;

      const userMessage: Message = {
        id: generateId(),
        role: 'user',
        content: trimmed,
        timestamp: Date.now(),
      };

      set((state) => {
        const thread = state.threads[threadId];
        if (!thread) return state;
        return {
          threads: {
            ...state.threads,
            [threadId]: {
              ...thread,
              messages: [...thread.messages, userMessage],
              isGeneratingReply: true,
            },
          },
        };
      });

      const historySnapshot = get().threads[threadId]?.messages ?? [];
      llmClient.getReply(toLLMMessages(historySnapshot)).then((replyContent) => {
        const assistantMessage: Message = {
          id: generateId(),
          role: 'assistant',
          content: replyContent,
          timestamp: Date.now(),
        };
        set((state) => {
          const thread = state.threads[threadId];
          if (!thread) return state;
          return {
            threads: {
              ...state.threads,
              [threadId]: {
                ...thread,
                messages: [...thread.messages, assistantMessage],
                isGeneratingReply: false,
              },
            },
          };
        });
      });
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
      const position = computeBranchPosition(source, state.threads, state.edges);

      const newThread = createThread({
        id: newThreadId,
        parentThreadId: sourceThreadId,
        branchFromMessageId: messageId,
        title: `Branch of ${source.title}`,
        messages: inheritedMessages,
        position,
      });

      const newEdge: ThreadEdge = {
        id: `${sourceThreadId}-${newThreadId}`,
        source: sourceThreadId,
        target: newThreadId,
      };

      set((s) => ({
        threads: { ...s.threads, [newThreadId]: newThread },
        edges: [...s.edges, newEdge],
      }));

      return newThreadId;
    },

    updateNodePosition: (threadId, position) => {
      set((state) => {
        const thread = state.threads[threadId];
        if (!thread) return state;
        return {
          threads: { ...state.threads, [threadId]: { ...thread, position } },
        };
      });
    },
  })),
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
