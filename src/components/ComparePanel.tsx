import { useThreadStore } from '../store/useThreadStore';
import { useFocusThread } from '../hooks/useFocusThread';

interface ComparePanelProps {
  threadIds: string[];
  onClose: () => void;
}

/**
 * Side-by-side view of several threads' latest messages — the landing spot
 * after a broadcast, so the same question's answers can be read at once
 * instead of hunting across the canvas.
 */
export function ComparePanel({ threadIds, onClose }: ComparePanelProps) {
  const threads = useThreadStore((s) => s.threads);
  const retryReply = useThreadStore((s) => s.retryReply);
  const focusThread = useFocusThread();

  const validIds = threadIds.filter((id) => threads[id]);
  const columns = Math.min(Math.max(validIds.length, 1), 3);

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 p-8">
      <div className="flex max-h-full w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Compare answers</h2>
            <p className="text-xs text-gray-500">
              {validIds.length} {validIds.length === 1 ? 'thread' : 'threads'} · same question,
              broadcast in parallel
            </p>
          </div>
          <button
            type="button"
            className="rounded px-2 py-1 text-sm text-gray-500 hover:bg-gray-100"
            onClick={onClose}
          >
            Close
          </button>
        </header>

        <div className="flex-1 overflow-auto p-4">
          {validIds.length === 0 ? (
            <p className="p-4 text-sm text-gray-400">
              None of the compared threads exist anymore.
            </p>
          ) : (
            <div
              className="grid gap-4"
              style={{ gridTemplateColumns: `repeat(${columns}, minmax(16rem, 1fr))` }}
            >
              {validIds.map((id) => {
                const thread = threads[id];
                const lastMessage = thread.messages[thread.messages.length - 1];
                return (
                  <div key={id} className="flex flex-col rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between gap-2 border-b border-gray-100 bg-gray-50 px-3 py-2">
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-800">
                        {thread.title}
                      </span>
                      <button
                        type="button"
                        className="shrink-0 rounded px-1.5 py-0.5 text-xs text-blue-600 hover:bg-blue-100"
                        onClick={() => focusThread(id)}
                      >
                        Focus
                      </button>
                    </div>
                    <div className="flex-1 space-y-2 px-3 py-2 text-sm">
                      {thread.isGeneratingReply && (
                        <p className="text-xs italic text-gray-400">Generating…</p>
                      )}
                      {thread.error && (
                        <div className="flex items-center justify-between gap-2 rounded-lg bg-rose-50 px-2 py-1.5 text-xs text-rose-700">
                          <span className="min-w-0 flex-1">{thread.error}</span>
                          <button
                            type="button"
                            className="shrink-0 rounded bg-rose-600 px-2 py-1 font-medium text-white"
                            onClick={() => retryReply(id)}
                          >
                            Retry
                          </button>
                        </div>
                      )}
                      {!thread.isGeneratingReply && !thread.error && lastMessage && (
                        <p className="whitespace-pre-wrap text-gray-800">{lastMessage.content}</p>
                      )}
                      {!lastMessage && !thread.isGeneratingReply && (
                        <p className="text-xs text-gray-400">No messages yet.</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
