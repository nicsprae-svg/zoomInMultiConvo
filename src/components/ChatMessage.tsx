import { useState } from 'react';
import Markdown from 'react-markdown';
import type { Message } from '../types';

interface ChatMessageProps {
  message: Message;
  onBranch: (messageId: string) => void;
}

export function ChatMessage({ message, onBranch }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // Clipboard is unavailable without a secure context; nothing useful to do.
    }
  };

  return (
    <div className={`group flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
      <div
        className={`max-w-[85%] break-words rounded-2xl px-3 py-2 text-sm ${
          isUser ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-900'
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose-chat">
            <Markdown>{message.content}</Markdown>
          </div>
        )}
      </div>

      <div className="mt-1 flex gap-1 opacity-0 transition group-hover:opacity-100">
        <button
          type="button"
          className="nodrag rounded px-1.5 py-0.5 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          onClick={copy}
          title="Copy raw message text"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
        {!isUser && (
          <button
            type="button"
            className="nodrag rounded px-1.5 py-0.5 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            onClick={() => onBranch(message.id)}
            title="Branch a new thread from this message"
          >
            ⤷ Branch
          </button>
        )}
      </div>
    </div>
  );
}
