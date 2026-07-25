import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from '@xyflow/react';
import { useThreadStore } from '../store/useThreadStore';

/**
 * Reference edges get their own delete affordance instead of relying on
 * click-to-select-then-Backspace: a thin dashed SVG stroke is a poor target
 * for that gesture (small hit area, no visible feedback), so a real button
 * at the midpoint is both easier to hit and, unlike the stroke, discoverable.
 */
export function ReferenceEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
}: EdgeProps) {
  const removeEdge = useThreadStore((s) => s.removeEdge);

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        <button
          type="button"
          data-edge-id={id}
          className="nodrag nopan pointer-events-auto absolute flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 bg-white text-[9px] leading-none text-slate-500 opacity-70 shadow hover:opacity-100 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600"
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
          }}
          onClick={(e) => {
            e.stopPropagation();
            removeEdge(id);
          }}
          title="Remove this reference link"
        >
          ✕
        </button>
      </EdgeLabelRenderer>
    </>
  );
}
