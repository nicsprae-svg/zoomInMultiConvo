import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Handle, Position as HandlePosition, type NodeProps } from '@xyflow/react';
import { useThreadStore } from '../store/useThreadStore';
import { useFocusThread, useFocusThreads } from '../hooks/useFocusThread';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { TypingIndicator } from './TypingIndicator';
import { NODE_HEIGHT, NODE_WIDTH } from '../lib/layout';
import { STATUS_STYLES } from '../lib/status';
import { THREAD_STATUSES, type ThreadStatus } from '../types';

const FAN_OUT_COUNT = 3;

export function ThreadNode({ id }: NodeProps) {
  const thread = useThreadStore((s) => s.threads[id]);
  const sendUserMessage = useThreadStore((s) => s.sendUserMessage);
  const branchFromMessage = useThreadStore((s) => s.branchFromMessage);
  const branchFanOut = useThreadStore((s) => s.branchFanOut);
  const retryReply = useThreadStore((s) => s.retryReply);
  const renameThread = useThreadStore((s) => s.renameThread);
  const setThreadStatus = useThreadStore((s) => s.setThreadStatus);
  const deleteThread = useThreadStore((s) => s.deleteThread);

  const focusThread = useFocusThread();
  const focusThreads = useFocusThreads();
  const listRef = useRef<HTMLDivElement>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [thread?.messages.length, thread?.isGeneratingReply]);

  if (!thread) return null;

  const isRoot = thread.parentThreadId === null;
  const statusStyle = STATUS_STYLES[thread.status];

  const handleBranch = (messageId: string) => {
    const newThreadId = branchFromMessage(id, messageId);
    if (newThreadId !== id) focusThread(newThreadId);
  };

  const handleFanOut = (messageId: string) => {
    const newIds = branchFanOut(id, messageId, FAN_OUT_COUNT);
    if (newIds.length > 0) focusThreads(newIds);
  };

  const branchFromLastReply = () => {
    const lastReply = [...thread.messages].reverse().find((m) => m.role === 'assistant');
    if (lastReply) handleBranch(lastReply.id);
  };

  const startRename = () => {
    setDraftTitle(thread.title);
    setIsRenaming(true);
  };

  const commitRename = () => {
    renameThread(id, draftTitle);
    setIsRenaming(false);
  };

  const handleTitleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitRename();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsRenaming(false);
    }
  };

  return (
    <div
      style={{ width: NODE_WIDTH, maxHeight: NODE_HEIGHT }}
      className={`flex flex-col overflow-hidden rounded-xl border-2 bg-white shadow-lg ${statusStyle.border}`}
    >
      <Handle type="target" position={HandlePosition.Left} className="!bg-gray-400" />
      <Handle type="source" position={HandlePosition.Right} className="!bg-gray-400" />

      <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-3 py-2">
        {isRenaming ? (
          <input
            className="nodrag min-w-0 flex-1 rounded border border-blue-400 px-1.5 py-0.5 text-sm font-semibold outline-none"
            value={draftTitle}
            autoFocus
            onChange={(e) => setDraftTitle(e.target.value)}
            onBlur={commitRename}
            onKeyDown={handleTitleKeyDown}
          />
        ) : (
          <button
            type="button"
            className="nodrag min-w-0 flex-1 truncate text-left text-sm font-semibold text-gray-800"
            onClick={startRename}
            title="Click to rename"
          >
            {thread.title}
          </button>
        )}

        <select
          className={`nodrag rounded px-1.5 py-0.5 text-xs font-medium ${statusStyle.badge}`}
          value={thread.status}
          onChange={(e) => setThreadStatus(id, e.target.value as ThreadStatus)}
          title="Path status"
        >
          {THREAD_STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_STYLES[status].label}
            </option>
          ))}
        </select>

        {!isRoot && (
          <button
            type="button"
            className="nodrag rounded px-1 text-xs text-gray-400 hover:bg-rose-50 hover:text-rose-600"
            onClick={() => deleteThread(id)}
            title="Delete thread (children re-attach to its parent)"
          >
            ✕
          </button>
        )}
      </div>

      <div ref={listRef} className="nowheel nodrag flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {thread.messages.length === 0 && (
          <p className="text-sm text-gray-400">Say something to start the conversation.</p>
        )}
        {thread.messages.map((message) => (
          <ChatMessage
            key={message.id}
            message={message}
            onBranch={handleBranch}
            onFanOut={handleFanOut}
          />
        ))}
        {thread.isGeneratingReply && <TypingIndicator />}
        {thread.error && (
          <div className="nodrag flex items-center justify-between gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
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
      </div>

      <ChatInput
        disabled={thread.isGeneratingReply}
        onSend={(content) => sendUserMessage(id, content)}
        onBranchLast={branchFromLastReply}
      />
    </div>
  );
}
