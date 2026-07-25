import { useMemo, useState, type KeyboardEvent } from 'react';
import { useThreadStore } from '../store/useThreadStore';
import { useFocusThread } from '../hooks/useFocusThread';
import { buildThreadRows, sortRows, type SortKey } from '../lib/threadTree';
import { STATUS_STYLES } from '../lib/status';
import { THREAD_STATUSES, type ThreadStatus } from '../types';

const COLUMNS: { key: SortKey | null; label: string; className?: string }[] = [
  { key: null, label: '', className: 'w-8' },
  { key: 'depth', label: 'Depth', className: 'w-16' },
  { key: 'title', label: 'Thread' },
  { key: null, label: 'Branched from' },
  { key: 'messageCount', label: 'Msgs', className: 'w-16' },
  { key: 'lastActivity', label: 'Last activity', className: 'w-32' },
  { key: 'status', label: 'Status', className: 'w-32' },
  { key: null, label: '', className: 'w-10' },
];

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface ListViewProps {
  onClose: () => void;
  /** Broadcast just fired; open the compare panel on these threads. */
  onBroadcast: (threadIds: string[]) => void;
}

export function ListView({ onClose, onBroadcast }: ListViewProps) {
  const threads = useThreadStore((s) => s.threads);
  const setThreadStatus = useThreadStore((s) => s.setThreadStatus);
  const renameThread = useThreadStore((s) => s.renameThread);
  const deleteThread = useThreadStore((s) => s.deleteThread);
  const broadcastMessage = useThreadStore((s) => s.broadcastMessage);
  const mergeThreads = useThreadStore((s) => s.mergeThreads);
  const focusThread = useFocusThread();

  const [sortKey, setSortKey] = useState<SortKey>('depth');
  const [ascending, setAscending] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [broadcastText, setBroadcastText] = useState('');

  const rows = useMemo(
    () => sortRows(buildThreadRows(threads), sortKey, ascending),
    [threads, sortKey, ascending],
  );

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setAscending((prev) => !prev);
    } else {
      setSortKey(key);
      setAscending(true);
    }
  };

  const commitRename = (id: string) => {
    renameThread(id, draftTitle);
    setEditingId(null);
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allVisibleSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.id));
  const toggleSelectAll = () => {
    setSelectedIds(allVisibleSelected ? new Set() : new Set(rows.map((r) => r.id)));
  };

  const submitBroadcast = () => {
    const trimmed = broadcastText.trim();
    if (!trimmed || selectedIds.size === 0) return;
    const ids = [...selectedIds];
    broadcastMessage(ids, trimmed);
    setBroadcastText('');
    setSelectedIds(new Set());
    onBroadcast(ids);
  };

  const handleBroadcastKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitBroadcast();
    }
  };

  const handleMerge = () => {
    if (selectedIds.size < 2) return;
    const newThreadId = mergeThreads([...selectedIds]);
    setSelectedIds(new Set());
    if (newThreadId) {
      focusThread(newThreadId);
      onClose();
    }
  };

  return (
    <aside className="flex h-full w-[46rem] max-w-[50vw] flex-col border-l border-gray-200 bg-white">
      <header className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">Threads</h2>
          <p className="text-xs text-gray-500">
            {rows.length} {rows.length === 1 ? 'thread' : 'threads'} · click a row to focus it on
            the canvas · check rows to broadcast a question or merge them
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

      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="sticky top-0 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              {COLUMNS.map((column, index) => (
                <th
                  key={column.label || `col-${index}`}
                  className={`border-b border-gray-200 px-3 py-2 font-medium ${column.className ?? ''}`}
                >
                  {index === 0 ? (
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAll}
                      title="Select all"
                    />
                  ) : column.key ? (
                    <button
                      type="button"
                      className="flex items-center gap-1 hover:text-gray-800"
                      onClick={() => toggleSort(column.key as SortKey)}
                    >
                      {column.label}
                      {sortKey === column.key && <span>{ascending ? '↑' : '↓'}</span>}
                    </button>
                  ) : (
                    column.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isRoot = row.parentTitle === null;
              const isSelected = selectedIds.has(row.id);
              return (
                <tr
                  key={row.id}
                  className={`cursor-pointer border-b border-gray-100 hover:bg-blue-50 ${isSelected ? 'bg-blue-50/60' : ''}`}
                  onClick={() => focusThread(row.id)}
                >
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelected(row.id)}
                    />
                  </td>

                  <td className="px-3 py-2 text-gray-500">{row.depth}</td>

                  <td className="px-3 py-2">
                    {editingId === row.id ? (
                      <input
                        className="w-full rounded border border-blue-400 px-1.5 py-0.5 outline-none"
                        value={draftTitle}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setDraftTitle(e.target.value)}
                        onBlur={() => commitRename(row.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitRename(row.id);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                      />
                    ) : (
                      <div className="flex min-w-0 items-center gap-1">
                        {row.isMerge && (
                          <span
                            className="shrink-0 rounded bg-violet-100 px-1 py-0.5 text-[10px] font-semibold text-violet-700"
                            title="Merge node"
                          >
                            ⑂
                          </span>
                        )}
                        <button
                          type="button"
                          className="max-w-full truncate text-left font-medium text-gray-800 hover:underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDraftTitle(row.title);
                            setEditingId(row.id);
                          }}
                          title="Click to rename"
                        >
                          {row.title}
                        </button>
                      </div>
                    )}
                    <div className="truncate text-xs text-gray-400">
                      {isRoot ? 'root' : `↳ from ${row.parentTitle}`}
                      {row.isGeneratingReply && ' · generating…'}
                      {row.hasError && ' · failed'}
                    </div>
                  </td>

                  <td className="max-w-[16rem] px-3 py-2 text-xs text-gray-600">
                    {row.branchFrom ?? <span className="text-gray-300">—</span>}
                  </td>

                  <td className="px-3 py-2 text-gray-500">{row.messageCount}</td>

                  <td className="px-3 py-2 text-xs text-gray-500">
                    {formatTime(row.lastActivity)}
                  </td>

                  <td className="px-3 py-2">
                    <select
                      className={`rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_STYLES[row.status].badge}`}
                      value={row.status}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setThreadStatus(row.id, e.target.value as ThreadStatus)}
                    >
                      {THREAD_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {STATUS_STYLES[status].label}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td className="px-3 py-2">
                    {!isRoot && (
                      <button
                        type="button"
                        className="rounded px-1 text-xs text-gray-400 hover:bg-rose-50 hover:text-rose-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteThread(row.id);
                        }}
                        title="Delete thread (children re-attach to its parent)"
                      >
                        ✕
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedIds.size > 0 && (
        <div className="nowheel flex flex-col gap-2 border-t border-gray-200 bg-gray-50 p-2">
          <div className="flex items-center justify-between px-0.5 text-xs text-gray-500">
            <span>
              {selectedIds.size} {selectedIds.size === 1 ? 'thread' : 'threads'} selected
            </span>
            <button
              type="button"
              className="text-gray-400 hover:text-gray-700"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear selection
            </button>
          </div>

          <div className="flex items-end gap-2">
            <textarea
              className="max-h-20 w-full resize-none rounded-lg border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
              rows={1}
              placeholder="Ask the same question of every selected thread…"
              value={broadcastText}
              onChange={(e) => setBroadcastText(e.target.value)}
              onKeyDown={handleBroadcastKeyDown}
            />
            <button
              type="button"
              className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!broadcastText.trim()}
              onClick={submitBroadcast}
            >
              Broadcast
            </button>
          </div>

          {selectedIds.size >= 2 && (
            <button
              type="button"
              className="self-start rounded-lg border border-violet-300 bg-violet-50 px-3 py-1.5 text-sm font-medium text-violet-700 hover:bg-violet-100"
              onClick={handleMerge}
              title="Create a new thread that synthesizes the tail of each selected thread"
            >
              ⑂ Merge into one thread
            </button>
          )}
        </div>
      )}
    </aside>
  );
}
