export type Role = 'user' | 'assistant';

export interface Message {
  id: string;
  role: Role;
  content: string;
  timestamp: number;
}

export interface Position {
  x: number;
  y: number;
}

export interface Thread {
  id: string;
  parentThreadId: string | null;
  branchFromMessageId: string | null;
  title: string;
  messages: Message[];
  position: Position;
  isGeneratingReply: boolean;
  createdAt: number;
}

export interface ThreadEdge {
  id: string;
  source: string;
  target: string;
}
