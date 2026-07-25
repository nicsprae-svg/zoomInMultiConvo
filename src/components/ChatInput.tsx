import { useState, type KeyboardEvent } from 'react';

interface ChatInputProps {
  disabled: boolean;
  onSend: (content: string) => void;
  /** Cmd/Ctrl+B — branches from this thread's most recent assistant message. */
  onBranchLast: () => void;
}

export function ChatInput({ disabled, onSend, onBranchLast }: ChatInputProps) {
  const [value, setValue] = useState('');

  const submit = () => {
    if (disabled) return;
    const trimmed = value.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setValue('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
      return;
    }
    if (e.key === 'b' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onBranchLast();
      return;
    }
    if (e.key === 'Escape') {
      e.currentTarget.blur();
    }
  };

  return (
    <div className="nodrag nowheel flex items-end gap-2 border-t border-gray-200 p-2">
      <textarea
        className="max-h-24 flex-1 resize-none rounded-lg border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
        rows={1}
        placeholder="Type a message…"
        value={value}
        disabled={disabled}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <button
        type="button"
        className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        disabled={disabled || !value.trim()}
        onClick={submit}
      >
        Send
      </button>
    </div>
  );
}
