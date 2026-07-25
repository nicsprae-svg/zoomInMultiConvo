import type { Message } from '../types';

interface ChatMessageProps {
  message: Message;
  onBranch: (messageId: string) => void;
}

export function ChatMessage({ message, onBranch }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`group flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
      <div
        className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm ${
          isUser ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-900'
        }`}
      >
        {message.content}
      </div>
      {!isUser && (
        <button
          type="button"
          className="nodrag mt-1 rounded px-1.5 py-0.5 text-xs text-gray-400 opacity-0 transition hover:bg-gray-100 hover:text-gray-700 group-hover:opacity-100"
          onClick={() => onBranch(message.id)}
          title="Branch a new thread from this message"
        >
          ⤷ Branch
        </button>
      )}
    </div>
  );
}
