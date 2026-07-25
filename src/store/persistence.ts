import type { Thread, ThreadEdge } from '../types';

const STORAGE_KEY = 'zoomChat:v1';
const SCHEMA_VERSION = 1;

export interface PersistedState {
  version: typeof SCHEMA_VERSION;
  threads: Record<string, Thread>;
  edges: ThreadEdge[];
  rootThreadId: string | null;
}

export function saveState(state: Omit<PersistedState, 'version'>): void {
  try {
    const payload: PersistedState = { version: SCHEMA_VERSION, ...state };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('Failed to save state to localStorage', err);
  }
}

export function loadState(): PersistedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      parsed.version === SCHEMA_VERSION &&
      typeof parsed.threads === 'object' &&
      Array.isArray(parsed.edges)
    ) {
      return parsed as PersistedState;
    }
    console.warn('Ignoring persisted state with incompatible shape/version');
    return null;
  } catch (err) {
    console.warn('Failed to load state from localStorage', err);
    return null;
  }
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
