import { useEffect, useRef } from 'react';
import { Handle, Position as HandlePosition, useReactFlow, type NodeProps } from '@xyflow/react';
import { useThreadStore } from '../store/useThreadStore';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { TypingIndicator } from './TypingIndicator';
import { NODE_HEIGHT, NODE_WIDTH } from '../lib/layout';

export function ThreadNode({ id }: NodeProps) {
  const thread = useThreadStore((s) => s.threads[id]);
  const sendUserMessage = useThreadStore((s) => s.sendUserMessage);
  const branchFromMessage = useThreadStore((s) => s.branchFromMessage);
  const { setCenter, getZoom } = useReactFlow();
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [thread?.messages.length, thread?.isGeneratingReply]);

  if (!thread) return null;

  const handleBranch = (messageId: string) => {
    const newThreadId = branchFromMessage(id, messageId);
    const newThread = useThreadStore.getState().threads[newThreadId];
    if (newThread) {
      setCenter(
        newThread.position.x + NODE_WIDTH / 2,
        newThread.position.y + NODE_HEIGHT / 2,
        { zoom: getZoom(), duration: 400 },
      );
    }
  };

  return (
    <div
      style={{ width: NODE_WIDTH, maxHeight: NODE_HEIGHT }}
      className="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg"
    >
      <Handle type="target" position={HandlePosition.Left} className="!bg-gray-400" />
      <Handle type="source" position={HandlePosition.Right} className="!bg-gray-400" />

      <div className="cursor-move truncate border-b border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-800">
        {thread.title}
      </div>

      <div ref={listRef} className="nowheel nodrag flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {thread.messages.length === 0 && (
          <p className="text-sm text-gray-400">Say something to start the conversation.</p>
        )}
        {thread.messages.map((message) => (
          <ChatMessage key={message.id} message={message} onBranch={handleBranch} />
        ))}
        {thread.isGeneratingReply && <TypingIndicator />}
      </div>

      <ChatInput
        disabled={thread.isGeneratingReply}
        onSend={(content) => sendUserMessage(id, content)}
      />
    </div>
  );
}
