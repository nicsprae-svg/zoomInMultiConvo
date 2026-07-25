export interface LLMMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface LLMClient {
  getReply(history: LLMMessage[]): Promise<string>;
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

const REPLY_TEMPLATES = [
  (topic: string) => `That's an interesting point about "${topic}". Here's a thought worth considering in response.`,
  (_topic: string) => `Sure — building on what you said, here's how I'd approach that.`,
  (_topic: string) => `Good question. Based on the conversation so far, I'd suggest looking at it this way.`,
  (topic: string) => `Picking up on "${topic}" — there are a few directions we could take this next.`,
];

class MockLLMClient implements LLMClient {
  async getReply(history: LLMMessage[]): Promise<string> {
    const delay = 600 + Math.random() * 900;
    await new Promise((resolve) => setTimeout(resolve, delay));

    const lastUser = [...history].reverse().find((m) => m.role === 'user');
    const topic = truncate(lastUser?.content ?? '', 40);
    const template = REPLY_TEMPLATES[history.length % REPLY_TEMPLATES.length];
    return template(topic);
  }
}

export const llmClient: LLMClient = new MockLLMClient();
