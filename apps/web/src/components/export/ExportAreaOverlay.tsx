import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, X } from 'lucide-react';
import type { ExportArea } from '../../utils/exportCanvas';

interface ExportAreaOverlayProps {
  format: 'png' | 'svg';
  onCancel: () => void;
  onConfirm: (area: ExportArea) => void;
}

interface DragStart {
  x: number;
  y: number;
}

const MIN_SELECTION_SIZE = 8;

export const ExportAreaOverlay: React.FC<ExportAreaOverlayProps> = ({
  format,
  onCancel,
  onConfirm,
}) => {
  const [selection, setSelection] = useState<ExportArea | null>(null);
  const dragStartRef = useRef<DragStart | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  const getSelection = (start: DragStart, endX: number, endY: number): ExportArea => ({
    x: Math.min(start.x, endX),
    y: Math.min(start.y, endY),
    width: Math.abs(endX - start.x),
    height: Math.abs(endY - start.y),
  });

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStartRef.current = { x: event.clientX, y: event.clientY };
    setSelection({ x: event.clientX, y: event.clientY, width: 0, height: 0 });
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = dragStartRef.current;
    if (!start) return;
    setSelection(getSelection(start, event.clientX, event.clientY));
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = dragStartRef.current;
    if (!start) return;
    dragStartRef.current = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Ignore browsers that release capture automatically.
    }

    const nextSelection = getSelection(start, event.clientX, event.clientY);
    setSelection(nextSelection);
  };

  const hasValidSelection = Boolean(
    selection && selection.width >= MIN_SELECTION_SIZE && selection.height >= MIN_SELECTION_SIZE
  );

  if (typeof document === 'undefined') return null;

  return createPortal(
    (
    <div
      className="fixed inset-0 z-[100] bg-slate-950/30 cursor-crosshair pointer-events-auto"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {selection && (
        <div
          className="absolute border-2 border-blue-500 bg-white/5 shadow-[0_0_0_9999px_rgba(15,23,42,0.38)] pointer-events-none"
          style={{
            left: selection.x,
            top: selection.y,
            width: selection.width,
            height: selection.height,
          }}
        >
          {hasValidSelection && (
            <div className="absolute left-1 top-1 rounded-md bg-slate-900/80 px-2 py-1 text-[11px] font-medium text-white whitespace-nowrap">
              {Math.round(selection.width)} × {Math.round(selection.height)} px
            </div>
          )}
        </div>
      )}

      <div
        className="absolute left-1/2 top-5 -translate-x-1/2 rounded-2xl border border-slate-200/80 bg-white/95 px-4 py-2.5 shadow-xl backdrop-blur-md pointer-events-auto"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className="text-xs text-slate-600">
            <div className="font-semibold text-slate-800">Select export area</div>
            <div>Drag like a screenshot. PNG exports at 4× resolution.</div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            title="Cancel (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={!hasValidSelection}
            onClick={() => selection && onConfirm(selection)}
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <Check className="h-3.5 w-3.5" />
            Export {format.toUpperCase()}
          </button>
        </div>
      </div>

      {!selection && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-xl bg-slate-900/75 px-4 py-2 text-sm font-medium text-white shadow-lg">
            Drag to select an area
          </div>
        </div>
      )}
    </div>
    ),
    document.body
  );
};
