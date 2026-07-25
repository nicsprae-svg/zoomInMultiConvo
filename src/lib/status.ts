import type { ThreadStatus } from '../types';

interface StatusStyle {
  label: string;
  /** Node border on the canvas. */
  border: string;
  /** Badge in the list view and node header. */
  badge: string;
}

export const STATUS_STYLES: Record<ThreadStatus, StatusStyle> = {
  open: {
    label: 'Open',
    border: 'border-gray-200',
    badge: 'bg-gray-100 text-gray-600',
  },
  promising: {
    label: 'Promising',
    border: 'border-amber-400',
    badge: 'bg-amber-100 text-amber-800',
  },
  'dead-end': {
    label: 'Dead end',
    border: 'border-rose-300',
    badge: 'bg-rose-100 text-rose-700',
  },
  chosen: {
    label: 'Chosen',
    border: 'border-emerald-500',
    badge: 'bg-emerald-100 text-emerald-800',
  },
};
