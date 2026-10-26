import React, { useState, useRef, useEffect } from 'react';
import {
  ConnectorObject,
  RoutingType,
  ArrowheadType,
} from '@diagrammer/shared';
import {
  CornerDownRight,
  Spline,
  Minus,
  ArrowLeftRight,
  Type,
  Trash2,
  RotateCcw,
  GripVertical,
} from 'lucide-react';

export const CONNECTOR_PALETTE = [
  { label: 'Slate', value: '#64748b' },
  { label: 'Dark', value: '#1e293b' },
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Green', value: '#22c55e' },
  { label: 'Amber', value: '#f59e0b' },
  { label: 'Red', value: '#ef4444' },
  { label: 'Purple', value: '#a855f7' },
];

export const ARROWHEAD_OPTIONS: Array<{
  type: ArrowheadType;
  label: string;
  renderIcon: (isStart?: boolean) => React.ReactNode;
}> = [
  {
    type: 'none',
    label: 'None',
    renderIcon: () => <Minus className="w-3.5 h-3.5" />,
  },
  {
    type: 'arrow',
    label: 'Open Arrow',
    renderIcon: (isStart) => (
      <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 stroke-current fill-none stroke-[2]">
        {isStart ? (
          <path d="M 11 3 L 5 8 L 11 13" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <path d="M 5 3 L 11 8 L 5 13" strokeLinecap="round" strokeLinejoin="round" />
        )}
      </svg>
    ),
  },
  {
    type: 'triangle',
    label: 'Solid Triangle',
    renderIcon: (isStart) => (
      <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 fill-current">
        {isStart ? (
          <polygon points="12 3, 4 8, 12 13" />
        ) : (
          <polygon points="4 3, 12 8, 4 13" />
        )}
      </svg>
    ),
  },
  {
    type: 'circle',
    label: 'Circle Dot',
    renderIcon: () => (
      <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 fill-current">
        <circle cx="8" cy="8" r="4.5" />
      </svg>
    ),
  },
  {
    type: 'diamond',
    label: 'Diamond',
    renderIcon: () => (
      <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 fill-current">
        <polygon points="8 2.5, 13.5 8, 8 13.5, 2.5 8" />
      </svg>
    ),
  },
];

interface FloatingConnectorToolbarProps {
  connector: ConnectorObject;
  position: { x: number; y: number };
  placement?: 'top' | 'bottom';
  onUpdate: (updates: Partial<ConnectorObject>) => void;
  onEditLabel: () => void;
  onDelete: () => void;
}

export const FloatingConnectorToolbar: React.FC<FloatingConnectorToolbarProps> = ({
  connector,
  position,
  placement = 'top',
  onUpdate,
  onEditLabel,
  onDelete,
}) => {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  // Allow user to freely drag & reposition the floating toolbar anywhere on canvas
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; initialOffset: { x: number; y: number } } | null>(null);

  const toolbarRef = useRef<HTMLDivElement>(null);

  // Reset manual drag offset when selected connector changes
  useEffect(() => {
    setDragOffset(null);
  }, [connector.id]);

  const handlePointerDownDrag = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      initialOffset: dragOffset || { x: 0, y: 0 },
    };
  };

  const handlePointerMoveDrag = (e: React.PointerEvent) => {
    if (!dragStartRef.current) return;
    e.stopPropagation();
    const dx = e.clientX - dragStartRef.current.mouseX;
    const dy = e.clientY - dragStartRef.current.mouseY;
    setDragOffset({
      x: dragStartRef.current.initialOffset.x + dx,
      y: dragStartRef.current.initialOffset.y + dy,
    });
  };

  const handlePointerUpDrag = (e: React.PointerEvent) => {
    if (!dragStartRef.current) return;
    e.stopPropagation();
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    dragStartRef.current = null;
  };

  // Close popovers on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setShowColorPicker(false);
        setShowStartPicker(false);
        setShowEndPicker(false);
      }
    };
    if (showColorPicker || showStartPicker || showEndPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showColorPicker, showStartPicker, showEndPicker]);

  const currentRouting = connector.routing || 'orthogonal';
  const currentWidth = connector.style.strokeWidth || 2;
  const currentDash = connector.style.strokeDash || 'solid';
  const currentColor = connector.style.stroke || '#64748b';
  const startArrowhead: ArrowheadType = connector.style.startArrowhead || 'none';
  const endArrowhead: ArrowheadType = connector.style.endArrowhead || 'none';

  // 1-Click Flip Direction: swap from & to, reverse waypoints, swap start/end arrowheads
  const handleFlipDirection = (e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedFrom = connector.to;
    const updatedTo = connector.from;
    const updatedWaypoints = connector.waypoints
      ? [...connector.waypoints].reverse()
      : undefined;

    onUpdate({
      from: updatedFrom,
      to: updatedTo,
      waypoints: updatedWaypoints,
      style: {
        ...connector.style,
        startArrowhead: endArrowhead,
        endArrowhead: startArrowhead,
      },
    });
  };

  const currentStartOption =
    ARROWHEAD_OPTIONS.find((o) => o.type === startArrowhead) || ARROWHEAD_OPTIONS[0];
  const currentEndOption =
    ARROWHEAD_OPTIONS.find((o) => o.type === endArrowhead) || ARROWHEAD_OPTIONS[0];

  const finalX = position.x + (dragOffset?.x || 0);
  const finalY = position.y + (dragOffset?.y || 0);
  const popoverPlacementClass = placement === 'bottom' ? 'top-full mt-2' : 'bottom-full mb-2';

  return (
    <div
      className="absolute z-50 pointer-events-auto select-none"
      style={{
        left: `${finalX}px`,
        top: `${finalY}px`,
        transform: placement === 'bottom' ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        ref={toolbarRef}
        className="flex items-center gap-1 bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-xl rounded-xl p-1 text-xs text-slate-700 animate-in fade-in duration-100"
      >
        {/* Grip Handle for Free Repositioning */}
        <div
          onPointerDown={handlePointerDownDrag}
          onPointerMove={handlePointerMoveDrag}
          onPointerUp={handlePointerUpDrag}
          onPointerCancel={handlePointerUpDrag}
          title="Drag to reposition toolbar"
          className="flex items-center justify-center py-1 px-0.5 cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 rounded transition-colors touch-none"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </div>
      {/* 1. Line Routing Types & Auto-Route Reset */}
      <div className="flex items-center gap-0.5 bg-slate-100/80 p-0.5 rounded-lg">
        <button
          onClick={() =>
            onUpdate({
              routing: 'orthogonal',
              ...(currentRouting === 'orthogonal' ? { waypoints: [] } : {}),
            })
          }
          title={
            currentRouting === 'orthogonal' && connector.waypoints?.length
              ? 'Click to reset bends (Auto Route)'
              : 'Elbow line (Rounded corners)'
          }
          className={`p-1.5 rounded-md transition-colors ${
            currentRouting === 'orthogonal'
              ? 'bg-white text-blue-600 shadow-xs font-medium'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <CornerDownRight className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onUpdate({ routing: 'curved' })}
          title="Curved line"
          className={`p-1.5 rounded-md transition-colors ${
            currentRouting === 'curved'
              ? 'bg-white text-blue-600 shadow-xs font-medium'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Spline className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onUpdate({ routing: 'straight' })}
          title="Straight line"
          className={`p-1.5 rounded-md transition-colors ${
            currentRouting === 'straight'
              ? 'bg-white text-blue-600 shadow-xs font-medium'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Auto-Route Reset Button (when manual waypoints exist) */}
      {connector.waypoints && connector.waypoints.length > 0 && (
        <button
          onClick={() => onUpdate({ waypoints: [] })}
          title="Reset to clean obstacle-avoiding auto route"
          className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors shadow-xs"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Auto Route</span>
        </button>
      )}

      <div className="w-px h-5 bg-slate-200 mx-0.5" />

      {/* 2. Stroke Width Pills */}
      <div className="flex items-center gap-0.5">
        {[1, 2, 4, 8].map((w) => (
          <button
            key={w}
            onClick={() =>
              onUpdate({
                style: { ...connector.style, strokeWidth: w },
              })
            }
            title={`${w}px line thickness`}
            className={`px-1.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
              currentWidth === w
                ? 'bg-blue-50 text-blue-700 font-semibold'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {w}
          </button>
        ))}
      </div>

      <div className="w-px h-5 bg-slate-200 mx-0.5" />

      {/* 3. Stroke Dash Toggle */}
      <button
        onClick={() =>
          onUpdate({
            style: {
              ...connector.style,
              strokeDash: currentDash === 'dashed' ? 'solid' : 'dashed',
            },
          })
        }
        title={`Stroke style: ${currentDash === 'dashed' ? 'Dashed' : 'Solid'}`}
        className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
          currentDash === 'dashed'
            ? 'bg-blue-50 text-blue-700 font-semibold'
            : 'text-slate-600 hover:bg-slate-100'
        }`}
      >
        {currentDash === 'dashed' ? 'Dashed' : 'Solid'}
      </button>

      <div className="w-px h-5 bg-slate-200 mx-0.5" />

      {/* 4. Rich Arrowheads & 1-Click Flip Direction */}
      <div className="flex items-center gap-0.5 bg-slate-100/80 p-0.5 rounded-lg">
        {/* Start Arrowhead Selector */}
        <div className="relative">
          <button
            onClick={() => {
              setShowStartPicker(!showStartPicker);
              setShowEndPicker(false);
              setShowColorPicker(false);
            }}
            title={`Start terminal: ${currentStartOption.label}`}
            className={`p-1.5 rounded-md transition-colors ${
              startArrowhead !== 'none'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {currentStartOption.renderIcon(true)}
          </button>

          {showStartPicker && (
            <div className={`absolute ${popoverPlacementClass} left-0 bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl shadow-xl p-1 flex flex-col gap-0.5 z-50 animate-in fade-in zoom-in-95 duration-100 w-32`}>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-2 py-0.5">
                Start Terminal
              </span>
              {ARROWHEAD_OPTIONS.map((opt) => (
                <button
                  key={opt.type}
                  onClick={() => {
                    onUpdate({
                      style: { ...connector.style, startArrowhead: opt.type },
                    });
                    setShowStartPicker(false);
                  }}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs transition-colors ${
                    startArrowhead === opt.type
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span className="w-4 h-4 flex items-center justify-center">
                    {opt.renderIcon(true)}
                  </span>
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 1-Click Flip Direction Button */}
        <button
          onClick={handleFlipDirection}
          title="Flip line direction (⇄)"
          className="p-1.5 rounded-md hover:bg-white text-slate-700 hover:text-blue-600 transition-colors"
        >
          <ArrowLeftRight className="w-3.5 h-3.5" />
        </button>

        {/* End Arrowhead Selector */}
        <div className="relative">
          <button
            onClick={() => {
              setShowEndPicker(!showEndPicker);
              setShowStartPicker(false);
              setShowColorPicker(false);
            }}
            title={`End terminal: ${currentEndOption.label}`}
            className={`p-1.5 rounded-md transition-colors ${
              endArrowhead !== 'none'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {currentEndOption.renderIcon(false)}
          </button>

          {showEndPicker && (
            <div className={`absolute ${popoverPlacementClass} right-0 bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl shadow-xl p-1 flex flex-col gap-0.5 z-50 animate-in fade-in zoom-in-95 duration-100 w-32`}>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-2 py-0.5">
                End Terminal
              </span>
              {ARROWHEAD_OPTIONS.map((opt) => (
                <button
                  key={opt.type}
                  onClick={() => {
                    onUpdate({
                      style: { ...connector.style, endArrowhead: opt.type },
                    });
                    setShowEndPicker(false);
                  }}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs transition-colors ${
                    endArrowhead === opt.type
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span className="w-4 h-4 flex items-center justify-center">
                    {opt.renderIcon(false)}
                  </span>
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="w-px h-5 bg-slate-200 mx-0.5" />

      {/* 5. Line Color Picker */}
      <div className="relative">
        <button
          onClick={() => {
            setShowColorPicker(!showColorPicker);
            setShowStartPicker(false);
            setShowEndPicker(false);
          }}
          title="Line color"
          className="p-1.5 rounded-md hover:bg-slate-100 flex items-center gap-1.5 text-slate-700 transition-colors"
        >
          <span
            className="w-3.5 h-3.5 rounded-full border border-slate-300 shadow-xs"
            style={{ backgroundColor: currentColor }}
          />
        </button>

        {showColorPicker && (
          <div className={`absolute ${popoverPlacementClass} left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl shadow-xl p-2 flex items-center gap-1.5 z-50 animate-in fade-in zoom-in-95 duration-100`}>
            {CONNECTOR_PALETTE.map((c) => (
              <button
                key={c.value}
                onClick={() => {
                  onUpdate({
                    style: { ...connector.style, stroke: c.value },
                  });
                  setShowColorPicker(false);
                }}
                title={c.label}
                style={{ backgroundColor: c.value }}
                className={`w-5 h-5 rounded-full border transition-transform ${
                  currentColor === c.value
                    ? 'border-blue-600 ring-2 ring-blue-100 scale-110'
                    : 'border-slate-300 hover:scale-105'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      <div className="w-px h-5 bg-slate-200 mx-0.5" />

      {/* 6. Inline Text Label Button */}
      <button
        onClick={onEditLabel}
        title="Add or edit line label (or double-click line)"
        className={`p-1.5 rounded-md transition-colors ${
          connector.label
            ? 'bg-blue-50 text-blue-700 font-medium'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        }`}
      >
        <Type className="w-3.5 h-3.5" />
      </button>

      {/* 7. Quick Delete */}
      <button
        onClick={onDelete}
        title="Delete line (Delete / Backspace)"
        className="p-1.5 rounded-md text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-colors"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
      </div>
    </div>
  );
};
