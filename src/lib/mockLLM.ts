export interface LLMMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface LLMClient {
  /**
   * `variantHint` distinguishes concurrent calls sharing identical history —
   * fan-out siblings, broadcast targets — so they don't read as duplicates.
   */
  getReply(history: LLMMessage[], variantHint?: string): Promise<string>;
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const OPENERS: Array<(topic: string) => string> = [
  (topic) => `That's an interesting point about "${topic}".`,
  () => 'Building on what you said,',
  () => 'Good question —',
  (topic) => `Picking up on "${topic}",`,
  () => "Here's another angle:",
  (topic) => `Thinking about "${topic}" differently,`,
];

const BODIES: string[] = [
  'here is a thought worth considering in response.',
  "here's how I'd approach that.",
  "I'd suggest looking at it this way.",
  'there are a few directions we could take this next.',
  'the key tradeoff is probably worth naming explicitly.',
  "it's worth checking whether the assumption underneath actually holds.",
];

class MockLLMClient implements LLMClient {
  async getReply(history: LLMMessage[], variantHint?: string): Promise<string> {
    const delay = 600 + Math.random() * 900;
    await new Promise((resolve) => setTimeout(resolve, delay));

    const lastUser = [...history].reverse().find((m) => m.role === 'user');
    const topic = truncate(lastUser?.content ?? '', 40);

    // With a variantHint, selection is seeded from the hint so two calls
    // sharing identical history (fan-out, broadcast) are guaranteed to read
    // differently. Without one, plain randomness keeps ordinary turns and
    // retries from feeling templated.
    let openerIdx: number;
    let bodyIdx: number;
    if (variantHint) {
      const seed = hashString(variantHint);
      openerIdx = seed % OPENERS.length;
      bodyIdx = Math.floor(seed / OPENERS.length) % BODIES.length;
    } else {
      openerIdx = Math.floor(Math.random() * OPENERS.length);
      bodyIdx = Math.floor(Math.random() * BODIES.length);
    }

    return `${OPENERS[openerIdx](topic)} ${BODIES[bodyIdx]}`;
  }
}

export const llmClient: LLMClient = new MockLLMClient();
