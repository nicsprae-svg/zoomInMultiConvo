import type { Thread, ThreadEdge } from '../types';

const SCHEMA_VERSION = 3;
const STORAGE_KEY = `zoomChat:v${SCHEMA_VERSION}`;

/** Older keys are read once, migrated forward, then written under STORAGE_KEY. */
const LEGACY_KEYS = ['zoomChat:v2', 'zoomChat:v1'];

export interface PersistedState {
  version: number;
  threads: Record<string, Thread>;
  edges: ThreadEdge[];
  rootThreadId: string | null;
}

export function saveState(state: Omit<PersistedState, 'version'>): void {
  try {
    const payload: PersistedState = { version: SCHEMA_VERSION, ...state };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    // Most likely QuotaExceededError. Surface it rather than losing data silently.
    console.error('Failed to save state to localStorage — changes are not persisted', err);
  }
}

/**
 * v1 -> v2: threads gained `status` and `error`.
 * v2 -> v3: `Thread.parentThreadId` (single) became `parentThreadIds` (array,
 * to allow merge nodes with multiple sources); `ThreadEdge` gained `type`,
 * defaulted to 'branch' since every pre-v3 edge was structural.
 * Returns null when the payload is too old or malformed to rescue.
 */
function migrate(data: unknown): PersistedState | null {
  if (!data || typeof data !== 'object') return null;
  const raw = data as Record<string, unknown>;

  if (typeof raw.threads !== 'object' || raw.threads === null || !Array.isArray(raw.edges)) {
    return null;
  }
  if (raw.version !== 1 && raw.version !== 2 && raw.version !== SCHEMA_VERSION) return null;

  const threads: Record<string, Thread> = {};
  for (const [id, value] of Object.entries(raw.threads as Record<string, unknown>)) {
    const thread = value as Partial<Thread> & { parentThreadId?: string | null };
    if (!thread || typeof thread.id !== 'string' || !Array.isArray(thread.messages)) {
      return null;
    }

    const parentThreadIds = Array.isArray(thread.parentThreadIds)
      ? thread.parentThreadIds
      : thread.parentThreadId
        ? [thread.parentThreadId]
        : [];

    const migratedThread: Thread = {
      ...(thread as Thread),
      parentThreadIds,
      status: thread.status ?? 'open',
      // Transient fields never survive a reload: an in-flight request died with
      // the page, so a persisted `true` would strand the thread permanently.
      isGeneratingReply: false,
      error: null,
    };
    delete (migratedThread as Partial<Thread> & { parentThreadId?: unknown }).parentThreadId;
    threads[id] = migratedThread;
  }

  const edges: ThreadEdge[] = (raw.edges as Array<Partial<ThreadEdge>>).map((edge) => ({
    id: edge.id ?? `${edge.source}-${edge.target}`,
    source: edge.source ?? '',
    target: edge.target ?? '',
    type: edge.type === 'reference' ? 'reference' : 'branch',
  }));

  return {
    version: SCHEMA_VERSION,
    threads,
    edges,
    rootThreadId: typeof raw.rootThreadId === 'string' ? raw.rootThreadId : null,
  };
}

export function loadState(): PersistedState | null {
  for (const key of [STORAGE_KEY, ...LEGACY_KEYS]) {
    let parsed: unknown;
    try {
      const rawText = localStorage.getItem(key);
      if (!rawText) continue;
      parsed = JSON.parse(rawText);
    } catch (err) {
      console.warn(`Discarding unparseable persisted state at ${key}`, err);
      continue;
    }

    const migrated = migrate(parsed);
    if (migrated) {
      if (key !== STORAGE_KEY) {
        // Write forward immediately so the migration only ever runs once.
        saveState(migrated);
      }
      return migrated;
    }
    console.warn(`Discarding persisted state at ${key}: incompatible shape or version`);
  }
  return null;
}

export function debounce<Args extends unknown[]>(
  fn: (...args: Args) => void,
  waitMs: number,
): (...args: Args) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: Args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), waitMs);
  };
}
