import { useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useThreadStore } from '../store/useThreadStore';
import { NODE_HEIGHT, NODE_WIDTH } from '../lib/layout';

/**
 * Centres the viewport on a thread's node, preserving the current zoom.
 * Shared by branch auto-pan and list-view row clicks so both behave alike.
 */
export function useFocusThread() {
  const { setCenter, getZoom } = useReactFlow();

  return useCallback(
    (threadId: string) => {
      const thread = useThreadStore.getState().threads[threadId];
      if (!thread) return;
      setCenter(
        thread.position.x + NODE_WIDTH / 2,
        thread.position.y + NODE_HEIGHT / 2,
        { zoom: getZoom(), duration: 400 },
      );
    },
    [setCenter, getZoom],
  );
}
