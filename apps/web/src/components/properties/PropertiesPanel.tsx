import React from 'react';
import { useCanvasStore, STICKY_COLOR_MAP } from '../../stores/useCanvasStore';
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  Columns3,
  Rows3,
  BringToFront,
  SendToBack,
  ArrowUp,
  ArrowDown,
  Copy,
  Trash2,
  Bold,
  Sliders,
  Type,
  Palette,
  CornerDownRight,
  Spline,
  Minus,
  ArrowRight,
  Tag,
  Plus,
} from 'lucide-react';
import { StickyColor, RoutingType, ArrowheadType, SwimlaneObject } from '@diagrammer/shared';
import { getSwimlaneLayout } from '@diagrammer/engine';

const FILL_PALETTE = [
  { label: 'White', value: '#ffffff' },
  { label: 'Slate', value: '#f1f5f9' },
  { label: 'Blue', value: '#eff6ff' },
  { label: 'Green', value: '#f0fdf4' },
  { label: 'Yellow', value: '#fefce8' },
  { label: 'Orange', value: '#fff7ed' },
  { label: 'Rose', value: '#fff1f2' },
  { label: 'Purple', value: '#faf5ff' },
  { label: 'Transparent', value: 'transparent' },
];

const STROKE_PALETTE = [
  { label: 'Slate Light', value: '#94a3b8' },
  { label: 'Slate Dark', value: '#334155' },
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Green', value: '#22c55e' },
  { label: 'Amber', value: '#f59e0b' },
  { label: 'Red', value: '#ef4444' },
  { label: 'Purple', value: '#a855f7' },
];

const STICKY_COLORS: StickyColor[] = [
  'yellow',
  'blue',
  'green',
  'pink',
  'purple',
  'orange',
  'gray',
  'mint',
  'peach',
];

export const PropertiesPanel: React.FC = () => {
  const {
    selectedIds,
    documentStore,
    updateSelectedProperties,
    updateSelectedConnector,
    alignSelected,
    distributeSelected,
    bringForward,
    sendBackward,
    bringToFront,
    sendToBack,
    duplicateSelected,
    deleteSelected,
    addSwimlaneLane,
    removeSwimlaneLane,
    updateSwimlaneLane,
    updateSwimlaneTitle,
    setSwimlaneOrientation,
    resizeSwimlaneLane,
    resizeSwimlaneHeader,
  } = useCanvasStore();

  if (selectedIds.length === 0) return null;

  const boardState = documentStore.getState();
  const selectedObjects = selectedIds
    .map((id) => boardState.objects[id])
    .filter(Boolean);

  if (selectedObjects.length === 0) return null;

  const primaryObj = selectedObjects[0];
  const isMultiple = selectedObjects.length > 1;

  // Dedicated Swimlane Properties Panel
  if (primaryObj.type === 'swimlane') {
    const sw = primaryObj as SwimlaneObject;
    const layout = getSwimlaneLayout(sw);
    const lanes = sw.lanes || [];
    const isHorizontal = (sw.orientation || 'horizontal') === 'horizontal';

    return (
      <aside
        aria-label="Swimlane properties panel"
        className="absolute right-4 top-20 w-72 max-h-[calc(100vh-100px)] overflow-y-auto bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-xl p-4 flex flex-col gap-3.5 z-30 select-none text-xs text-slate-700 animate-in fade-in slide-in-from-right-2 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-1.5">
            <Columns3 className="w-4 h-4 text-blue-600" />
            <span className="font-semibold text-slate-800">Swimlane Diagram</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={duplicateSelected}
              title="Duplicate (Ctrl+D)"
              className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-800 transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={deleteSelected}
              title="Delete (Del)"
              className="p-1 hover:bg-red-50 rounded text-slate-500 hover:text-red-600 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Diagram Title */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            Pool Title
          </label>
          <input
            type="text"
            value={sw.headerTitle || ''}
            onChange={(e) => updateSwimlaneTitle(sw.id, e.target.value)}
            placeholder="Swimlane Title..."
            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
          />
        </div>

        {/* Orientation Switcher */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            Orientation
          </label>
          <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setSwimlaneOrientation(sw.id, 'horizontal')}
              className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                isHorizontal
                  ? 'bg-white text-blue-600 shadow-sm font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Rows3 className="w-3.5 h-3.5" /> Horizontal
            </button>
            <button
              onClick={() => setSwimlaneOrientation(sw.id, 'vertical')}
              className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                !isHorizontal
                  ? 'bg-white text-blue-600 shadow-sm font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Columns3 className="w-3.5 h-3.5" /> Vertical
            </button>
          </div>
        </div>

        {/* Header Dimensions */}
        <div className="flex flex-col gap-1.5 pt-1 border-t border-slate-100">
          <label className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            Header Dimensions
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-slate-500">Pool Header H</span>
              <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
                <input
                  type="number"
                  min={24}
                  max={120}
                  value={sw.headerSize ?? 34}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val)) resizeSwimlaneHeader(sw.id, val, undefined);
                  }}
                  className="w-full bg-transparent text-xs font-mono text-slate-800 focus:outline-none"
                />
                <span className="text-[10px] text-slate-400">px</span>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-slate-500">
                {isHorizontal ? 'Lane Header W' : 'Lane Header H'}
              </span>
              <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
                <input
                  type="number"
                  min={isHorizontal ? 60 : 24}
                  max={isHorizontal ? 350 : 100}
                  value={sw.headerColSize ?? (isHorizontal ? 130 : 32)}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val)) resizeSwimlaneHeader(sw.id, undefined, val);
                  }}
                  className="w-full bg-transparent text-xs font-mono text-slate-800 focus:outline-none"
                />
                <span className="text-[10px] text-slate-400">px</span>
              </div>
            </div>
          </div>
        </div>

        {/* Lanes List & Management */}
        <div className="flex flex-col gap-2 pt-1 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              Lanes ({lanes.length})
            </span>
            <button
              onClick={() => addSwimlaneLane(sw.id)}
              className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors text-[11px] font-medium"
            >
              <Plus className="w-3 h-3" /> Add Lane
            </button>
          </div>

          <div className="flex flex-col gap-1.5 max-h-52 overflow-y-auto pr-0.5">
            {lanes.map((lane, index) => {
              const computedLane = layout.lanes.find((l) => l.id === lane.id);
              const currentSize =
                lane.size ??
                (computedLane
                  ? Math.round(isHorizontal ? computedLane.height : computedLane.width)
                  : isHorizontal
                  ? 90
                  : 140);

              return (
                <div
                  key={lane.id}
                  className="flex items-center gap-1.5 p-1.5 bg-slate-50 border border-slate-200/80 rounded-xl group hover:border-slate-300 transition-colors"
                >
                  <span className="w-5 h-5 rounded-md bg-slate-200/70 text-slate-600 font-semibold text-[10px] flex items-center justify-center flex-shrink-0">
                    {index + 1}
                  </span>
                  <input
                    type="text"
                    value={lane.title}
                    onChange={(e) => updateSwimlaneLane(sw.id, lane.id, { title: e.target.value })}
                    placeholder={`Lane ${index + 1}`}
                    className="flex-1 min-w-0 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  {/* Lane Size (px) */}
                  <div
                    className="flex items-center gap-0.5 bg-white border border-slate-200 rounded-md px-1 py-0.5 flex-shrink-0"
                    title={`Lane ${isHorizontal ? 'Height' : 'Width'} in pixels`}
                  >
                    <span className="text-[9px] text-slate-400 font-mono">
                      {isHorizontal ? 'H' : 'W'}
                    </span>
                    <input
                      type="number"
                      min={isHorizontal ? 36 : 50}
                      step={10}
                      value={currentSize}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val) && val > 0) {
                          resizeSwimlaneLane(sw.id, lane.id, val);
                        }
                      }}
                      className="w-10 text-center bg-transparent text-[11px] font-mono text-slate-700 focus:outline-none"
                    />
                  </div>
                  {/* Lane Accent Color Indicator / Toggle */}
                  <button
                    onClick={() => {
                      const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', ''];
                      const currentIdx = colors.indexOf(lane.color || '');
                      const nextColor = colors[(currentIdx + 1) % colors.length];
                      updateSwimlaneLane(sw.id, lane.id, { color: nextColor || undefined });
                    }}
                    title="Toggle Lane Accent Color"
                    className="w-5 h-5 rounded-full border border-slate-300 flex items-center justify-center flex-shrink-0 overflow-hidden hover:scale-105 transition-transform"
                    style={{ backgroundColor: lane.color || '#e2e8f0' }}
                  />
                  {/* Delete Lane (min 1 lane) */}
                  <button
                    onClick={() => removeSwimlaneLane(sw.id, lane.id)}
                    disabled={lanes.length <= 1}
                    title={lanes.length <= 1 ? 'Minimum 1 lane required' : 'Delete Lane'}
                    className={`p-1 rounded-lg transition-colors flex-shrink-0 ${
                      lanes.length <= 1
                        ? 'text-slate-300 cursor-not-allowed'
                        : 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>

          <button
            onClick={() => addSwimlaneLane(sw.id)}
            className="w-full py-2 px-3 border border-dashed border-blue-300 bg-blue-50/50 hover:bg-blue-50 text-blue-600 rounded-xl font-medium flex items-center justify-center gap-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add New Lane
          </button>
        </div>

        {/* Style & Colors */}
        <div className="flex flex-col gap-2 pt-1 border-t border-slate-100">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Palette className="w-3 h-3" /> Pool Border Color
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {STROKE_PALETTE.map((s) => (
              <button
                key={s.value}
                onClick={() =>
                  updateSelectedProperties({ stroke: s.value })
                }
                title={s.label}
                style={{ backgroundColor: s.value }}
                className={`w-5 h-5 rounded-full border transition-transform ${
                  sw.style?.stroke === s.value
                    ? 'border-blue-600 ring-2 ring-blue-100 scale-110'
                    : 'border-white hover:scale-105'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Z-Order / Arrange */}
        <div className="flex flex-col gap-1.5 pt-1 border-t border-slate-100">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            Arrange
          </span>
          <div className="grid grid-cols-4 gap-1">
            <button
              onClick={bringForward}
              title="Bring Forward"
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center justify-center text-slate-600"
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={sendBackward}
              title="Send Backward"
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center justify-center text-slate-600"
            >
              <ArrowDown className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={bringToFront}
              title="Bring to Front"
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center justify-center text-slate-600"
            >
              <BringToFront className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={sendToBack}
              title="Send to Back"
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center justify-center text-slate-600"
            >
              <SendToBack className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>
    );
  }

  // Dedicated Connector Properties Panel
  if (primaryObj.type === 'connector') {
    const conn = primaryObj;
    return (
      <aside
        aria-label="Connector properties panel"
        className="absolute right-4 top-20 w-64 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-xl p-4 flex flex-col gap-3.5 z-30 select-none text-xs text-slate-700 animate-in fade-in slide-in-from-right-2 duration-150"
      >
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <span className="font-semibold text-slate-800">CONNECTOR</span>
          <button
            onClick={deleteSelected}
            title="Delete (Del)"
            className="p-1 hover:bg-red-50 rounded text-slate-500 hover:text-red-600 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Routing Type */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            Route Style
          </span>
          <div className="grid grid-cols-3 gap-1 bg-slate-50 p-1 rounded-xl">
            <button
              onClick={() => updateSelectedConnector({ routing: 'orthogonal' })}
              className={`flex items-center justify-center gap-1 py-1.5 rounded-lg transition-colors ${
                conn.routing === 'orthogonal' ? 'bg-white shadow-xs text-blue-600 font-medium' : 'text-slate-600 hover:bg-white/50'
              }`}
            >
              <CornerDownRight className="w-3.5 h-3.5" /> Elbow
            </button>
            <button
              onClick={() => updateSelectedConnector({ routing: 'curved' })}
              className={`flex items-center justify-center gap-1 py-1.5 rounded-lg transition-colors ${
                conn.routing === 'curved' ? 'bg-white shadow-xs text-blue-600 font-medium' : 'text-slate-600 hover:bg-white/50'
              }`}
            >
              <Spline className="w-3.5 h-3.5" /> Curved
            </button>
            <button
              onClick={() => updateSelectedConnector({ routing: 'straight' })}
              className={`flex items-center justify-center gap-1 py-1.5 rounded-lg transition-colors ${
                conn.routing === 'straight' ? 'bg-white shadow-xs text-blue-600 font-medium' : 'text-slate-600 hover:bg-white/50'
              }`}
            >
              <Minus className="w-3.5 h-3.5" /> Straight
            </button>
          </div>
        </div>

        {/* Stroke Color */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            Line Color
          </span>
          <div className="flex items-center gap-1.5">
            {STROKE_PALETTE.map((s) => (
              <button
                key={s.value}
                onClick={() =>
                  updateSelectedConnector({
                    style: { ...conn.style, stroke: s.value },
                  })
                }
                title={s.label}
                style={{ backgroundColor: s.value }}
                className={`w-5 h-5 rounded-full border transition-transform ${
                  conn.style.stroke === s.value ? 'border-blue-600 ring-2 ring-blue-100 scale-110' : 'border-white hover:scale-105'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Stroke Width & Dash */}
        <div className="flex items-center gap-2">
          {[1, 2, 4].map((w) => (
            <button
              key={w}
              onClick={() =>
                updateSelectedConnector({
                  style: { ...conn.style, strokeWidth: w },
                })
              }
              className={`flex-1 py-1 rounded-lg border text-center transition-colors ${
                conn.style.strokeWidth === w
                  ? 'border-blue-600 bg-blue-50 text-blue-700 font-medium'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              {w}px
            </button>
          ))}
          <button
            onClick={() =>
              updateSelectedConnector({
                style: {
                  ...conn.style,
                  strokeDash: conn.style.strokeDash === 'dashed' ? 'solid' : 'dashed',
                },
              })
            }
            className={`px-2 py-1 rounded-lg border text-center transition-colors ${
              conn.style.strokeDash === 'dashed'
                ? 'border-blue-600 bg-blue-50 text-blue-700 font-medium'
                : 'border-slate-200 hover:bg-slate-50'
            }`}
          >
            Dash
          </button>
        </div>

        {/* Arrowheads */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <ArrowRight className="w-3 h-3" /> Arrowhead
          </span>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() =>
                updateSelectedConnector({
                  style: {
                    ...conn.style,
                    endArrowhead: conn.style?.endArrowhead === 'arrow' ? 'none' : 'arrow',
                  },
                })
              }
              className={`py-1 rounded-lg border text-center transition-colors ${
                conn.style?.endArrowhead === 'arrow'
                  ? 'border-blue-600 bg-blue-50 text-blue-700 font-medium'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              End Arrow: {conn.style?.endArrowhead === 'arrow' ? 'On' : 'Off'}
            </button>
            <button
              onClick={() =>
                updateSelectedConnector({
                  style: {
                    ...conn.style,
                    startArrowhead: conn.style?.startArrowhead === 'arrow' ? 'none' : 'arrow',
                  },
                })
              }
              className={`py-1 rounded-lg border text-center transition-colors ${
                conn.style?.startArrowhead === 'arrow'
                  ? 'border-blue-600 bg-blue-50 text-blue-700 font-medium'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              Start Arrow: {conn.style?.startArrowhead === 'arrow' ? 'On' : 'Off'}
            </button>
          </div>
        </div>

        {/* Connector Text Label */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Tag className="w-3 h-3" /> Text Label
          </span>
          <input
            type="text"
            placeholder="e.g. Yes, No, Processed"
            value={conn.label || ''}
            onChange={(e) => updateSelectedConnector({ label: e.target.value })}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none text-slate-800 placeholder:text-slate-400 text-xs"
          />
        </div>
      </aside>
    );
  }

  // Derive styles from primary object
  const currentFill = ('style' in primaryObj && primaryObj.style?.fill) || '#ffffff';
  const currentStroke = ('style' in primaryObj && primaryObj.style?.stroke) || '#64748b';
  const currentStrokeWidth = ('style' in primaryObj && primaryObj.style?.strokeWidth) || 2;
  const currentOpacity =
    'style' in primaryObj && primaryObj.style?.opacity !== undefined
      ? Math.round(primaryObj.style.opacity * 100)
      : 100;

  const currentFontSize = ('textStyle' in primaryObj && primaryObj.textStyle?.fontSize) || 14;
  const currentTextAlign = ('textStyle' in primaryObj && primaryObj.textStyle?.textAlign) || 'center';
  const currentFontWeight = ('textStyle' in primaryObj && primaryObj.textStyle?.fontWeight) || 'normal';

  const isSticky = primaryObj.type === 'sticky';

  return (
    <aside
      aria-label="Properties panel"
      className="absolute right-4 top-20 w-64 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-xl p-4 flex flex-col gap-3.5 z-30 select-none text-xs text-slate-700 animate-in fade-in slide-in-from-right-2 duration-150"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <span className="font-semibold text-slate-800">
          {isMultiple ? `${selectedObjects.length} Objects Selected` : primaryObj.type.toUpperCase()}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={duplicateSelected}
            title="Duplicate (Ctrl+D)"
            className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-800 transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={deleteSelected}
            title="Delete (Del)"
            className="p-1 hover:bg-red-50 rounded text-slate-500 hover:text-red-600 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Alignment & Distribution */}
      {isMultiple && (
        <div className="flex flex-col gap-1.5 pb-2 border-b border-slate-100">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            Align & Distribute
          </span>
          <div className="grid grid-cols-6 gap-1 bg-slate-50 p-1 rounded-xl">
            <button
              onClick={() => alignSelected('left')}
              title="Align Left"
              className="p-1.5 hover:bg-white rounded-lg flex justify-center text-slate-600 transition-colors"
            >
              <AlignLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => alignSelected('center')}
              title="Align Center Horizontal"
              className="p-1.5 hover:bg-white rounded-lg flex justify-center text-slate-600 transition-colors"
            >
              <AlignCenter className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => alignSelected('right')}
              title="Align Right"
              className="p-1.5 hover:bg-white rounded-lg flex justify-center text-slate-600 transition-colors"
            >
              <AlignRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => alignSelected('top')}
              title="Align Top"
              className="p-1.5 hover:bg-white rounded-lg flex justify-center text-slate-600 transition-colors"
            >
              <AlignStartVertical className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => alignSelected('middle')}
              title="Align Middle Vertical"
              className="p-1.5 hover:bg-white rounded-lg flex justify-center text-slate-600 transition-colors"
            >
              <AlignCenterVertical className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => alignSelected('bottom')}
              title="Align Bottom"
              className="p-1.5 hover:bg-white rounded-lg flex justify-center text-slate-600 transition-colors"
            >
              <AlignEndVertical className="w-3.5 h-3.5" />
            </button>
          </div>

          {selectedObjects.length >= 3 && (
            <div className="flex items-center gap-1 mt-1">
              <button
                onClick={() => distributeSelected('horizontal')}
                className="flex-1 flex items-center justify-center gap-1.5 py-1 bg-slate-50 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors text-[11px]"
              >
                <Columns3 className="w-3 h-3" /> Even Horiz
              </button>
              <button
                onClick={() => distributeSelected('vertical')}
                className="flex-1 flex items-center justify-center gap-1.5 py-1 bg-slate-50 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors text-[11px]"
              >
                <Rows3 className="w-3 h-3" /> Even Vert
              </button>
            </div>
          )}
        </div>
      )}

      {/* Text Content Editor for Shapes, Stickies, Text */}
      {(primaryObj.type === 'shape' || primaryObj.type === 'sticky' || primaryObj.type === 'text') && (

        <div className="flex flex-col gap-1.5 pb-2 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Type className="w-3 h-3" /> Text Content
            </span>
            <span className="text-[10px] text-slate-400 italic">or double-click</span>
          </div>
          <textarea
            value={(primaryObj as any).text || ''}
            onChange={(e) =>
              updateSelectedProperties(undefined, undefined, { text: e.target.value })
            }
            placeholder="Type text for this shape..."
            rows={isSticky ? 3 : 2}
            className="w-full bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:border-blue-500 rounded-lg p-2 outline-none text-slate-800 placeholder:text-slate-400 text-xs resize-none transition-colors"
          />
        </div>
      )}

      {/* Frame Title Editor */}
      {primaryObj.type === 'frame' && (
        <div className="flex flex-col gap-1.5 pb-2 border-b border-slate-100">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            Frame Title
          </span>
          <input
            type="text"
            value={(primaryObj as any).name || ''}
            onChange={(e) =>
              updateSelectedProperties(undefined, undefined, { name: e.target.value })
            }
            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none text-slate-800 text-xs"
          />
        </div>
      )}

      {/* Sticky Note Color Palette */}
      {isSticky && (
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Palette className="w-3 h-3" /> Note Color
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {STICKY_COLORS.map((c) => (
              <button
                key={c}
                onClick={() =>
                  updateSelectedProperties(undefined, { textColor: STICKY_COLOR_MAP[c].text }, { color: c })
                }
                style={{ backgroundColor: STICKY_COLOR_MAP[c].bg }}
                className={`w-5 h-5 rounded-full border-2 transition-transform ${
                  (primaryObj as any).color === c
                    ? 'border-slate-800 scale-110 shadow-sm'
                    : 'border-slate-200 hover:scale-105'
                }`}
                title={c}
              />
            ))}
          </div>

          {/* Quick Tag */}
          <div className="flex items-center gap-1 flex-wrap pt-1 border-t border-slate-100">
            <span className="text-[10px] text-slate-400 mr-0.5">Tag:</span>
            {['Idea', 'High Priority', 'Bug', 'Design'].map((t) => (
              <button
                key={t}
                onClick={() =>
                  updateSelectedProperties(undefined, undefined, {
                    tag: (primaryObj as any).tag === t ? undefined : t,
                  })
                }
                className={`px-1.5 py-0.5 rounded text-[10px] border transition-colors ${
                  (primaryObj as any).tag === t
                    ? 'bg-blue-100 text-blue-700 border-blue-300 font-semibold'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Reaction Emoji */}
          <div className="flex items-center gap-1 pt-1 border-t border-slate-100">
            <span className="text-[10px] text-slate-400 mr-0.5">Reaction:</span>
            {['👍', '🚀', '🔥', '❤️', '💡'].map((em) => (
              <button
                key={em}
                onClick={() =>
                  updateSelectedProperties(undefined, undefined, {
                    reaction: (primaryObj as any).reaction === em ? undefined : em,
                  })
                }
                className={`w-6 h-6 rounded-md flex items-center justify-center text-xs border transition-colors ${
                  (primaryObj as any).reaction === em
                    ? 'bg-amber-100 border-amber-300 scale-110'
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {em}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Fill Color */}
      {!isSticky && primaryObj.type !== 'text' && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Palette className="w-3 h-3" /> Fill Color
          </span>
          <div className="grid grid-cols-5 gap-1.5">
            {FILL_PALETTE.map((f) => (
              <button
                key={f.value}
                onClick={() => updateSelectedProperties({ fill: f.value })}
                title={f.label}
                style={{ backgroundColor: f.value === 'transparent' ? undefined : f.value }}
                className={`h-6 rounded-lg border flex items-center justify-center transition-transform ${
                  currentFill === f.value ? 'border-blue-600 ring-2 ring-blue-100' : 'border-slate-200 hover:scale-105'
                } ${f.value === 'transparent' ? 'bg-gradient-to-tr from-red-100 to-white text-[10px] text-red-400 font-bold' : ''}`}
              >
                {f.value === 'transparent' ? '✕' : ''}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Stroke Color & Width */}
      {!isSticky && primaryObj.type !== 'text' && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            Stroke & Border
          </span>
          <div className="flex items-center gap-1.5">
            {STROKE_PALETTE.map((s) => (
              <button
                key={s.value}
                onClick={() => updateSelectedProperties({ stroke: s.value })}
                title={s.label}
                style={{ backgroundColor: s.value }}
                className={`w-5 h-5 rounded-full border transition-transform ${
                  currentStroke === s.value ? 'border-blue-600 ring-2 ring-blue-100 scale-110' : 'border-white hover:scale-105'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2 mt-1">
            {[1, 2, 4].map((width) => (
              <button
                key={width}
                onClick={() => updateSelectedProperties({ strokeWidth: width })}
                className={`flex-1 py-1 rounded-lg border text-center transition-colors ${
                  currentStrokeWidth === width
                    ? 'border-blue-600 bg-blue-50 text-blue-700 font-medium'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                {width}px
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Typography Controls */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1">
          <Type className="w-3 h-3" /> Typography
        </span>

        <div className="flex items-center gap-2">
          <select
            value={currentFontSize}
            onChange={(e) =>
              updateSelectedProperties(undefined, { fontSize: Number(e.target.value) })
            }
            className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none text-slate-700 font-medium"
          >
            {[12, 14, 16, 20, 24, 32].map((s) => (
              <option key={s} value={s}>
                {s}px
              </option>
            ))}
          </select>

          <button
            onClick={() =>
              updateSelectedProperties(undefined, {
                fontWeight: currentFontWeight === 'bold' ? 'normal' : 'bold',
              })
            }
            className={`p-1.5 border rounded-lg transition-colors ${
              currentFontWeight === 'bold'
                ? 'border-blue-600 bg-blue-50 text-blue-700'
                : 'border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Bold className="w-3.5 h-3.5" />
          </button>

          <div className="flex items-center border border-slate-200 rounded-lg p-0.5 bg-slate-50">
            {(['left', 'center', 'right'] as const).map((align) => (
              <button
                key={align}
                onClick={() => updateSelectedProperties(undefined, { textAlign: align })}
                className={`p-1 rounded ${
                  currentTextAlign === align ? 'bg-white shadow-xs text-blue-600' : 'text-slate-500'
                }`}
              >
                {align === 'left' ? (
                  <AlignLeft className="w-3 h-3" />
                ) : align === 'center' ? (
                  <AlignCenter className="w-3 h-3" />
                ) : (
                  <AlignRight className="w-3 h-3" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Opacity Slider */}
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between items-center text-[11px] font-medium text-slate-400 uppercase tracking-wider">
          <span className="flex items-center gap-1">
            <Sliders className="w-3 h-3" /> Opacity
          </span>
          <span className="text-slate-600">{currentOpacity}%</span>
        </div>
        <input
          type="range"
          min={10}
          max={100}
          value={currentOpacity}
          onChange={(e) =>
            updateSelectedProperties({ opacity: Number(e.target.value) / 100 })
          }
          className="w-full accent-blue-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg appearance-none"
        />
      </div>

      {/* Z-Order Layering */}
      <div className="flex flex-col gap-1.5 pt-1 border-t border-slate-100">
        <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
          Layering
        </span>
        <div className="grid grid-cols-4 gap-1">
          <button
            onClick={bringToFront}
            title="Bring to Front"
            className="p-1.5 bg-slate-50 hover:bg-slate-100 rounded-lg flex items-center justify-center text-slate-600 transition-colors"
          >
            <BringToFront className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={bringForward}
            title="Bring Forward (Ctrl + ])"
            className="p-1.5 bg-slate-50 hover:bg-slate-100 rounded-lg flex items-center justify-center text-slate-600 transition-colors"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={sendBackward}
            title="Send Backward (Ctrl + [)"
            className="p-1.5 bg-slate-50 hover:bg-slate-100 rounded-lg flex items-center justify-center text-slate-600 transition-colors"
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={sendToBack}
            title="Send to Back"
            className="p-1.5 bg-slate-50 hover:bg-slate-100 rounded-lg flex items-center justify-center text-slate-600 transition-colors"
          >
            <SendToBack className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
};
