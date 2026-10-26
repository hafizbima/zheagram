import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useCanvasStore, CanvasTool, STICKY_COLOR_MAP } from '../../stores/useCanvasStore';
import {
  MousePointer,
  Hand,
  Square,
  ArrowUpRight,
  Type,
  StickyNote,
  Frame,
  Undo2,
  Redo2,
  Trash2,
  Circle,
  Diamond,
  Triangle,
  Database,
  FileText,
  Cloud,
  Hexagon,
  PenTool,
  Highlighter,
  Eraser,
  Image as ImageIcon,
  Lock,
  Unlock,
  Group,
  Ungroup,
  Sparkles,
  CornerDownRight,
  Spline,
  Minus,
  Columns3,
} from 'lucide-react';
import { ShapeKind, StickyColor } from '@diagrammer/shared';

const SHAPE_OPTIONS: Array<{ kind: ShapeKind | 'swimlane'; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { kind: 'rectangle', label: 'Rectangle', icon: Square },
  { kind: 'rounded-rectangle', label: 'Rounded Rect', icon: Square },
  { kind: 'ellipse', label: 'Ellipse', icon: Circle },
  { kind: 'diamond', label: 'Diamond', icon: Diamond },
  { kind: 'triangle', label: 'Triangle', icon: Triangle },
  { kind: 'parallelogram', label: 'Parallelogram', icon: Square },
  { kind: 'cylinder', label: 'Cylinder / DB', icon: Database },
  { kind: 'document', label: 'Document', icon: FileText },
  { kind: 'hexagon', label: 'Hexagon', icon: Hexagon },
  { kind: 'cloud', label: 'Cloud', icon: Cloud },
  { kind: 'swimlane', label: 'Swimlane', icon: Columns3 },
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

const PEN_COLORS = ['#3b82f6', '#1e293b', '#ef4444', '#10b981', '#8b5cf6', '#f59e0b'];
const PEN_WIDTHS = [2, 4, 6, 8];

interface ToolbarProps {
  onOpenTemplates?: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ onOpenTemplates }) => {
  const {
    tool,
    setTool,
    activeShapeKind,
    setActiveShapeKind,
    activeStickyColor,
    setActiveStickyColor,
    activeRouting,
    setActiveRouting,
    activeArrowheadType,
    setActiveArrowheadType,
    activeDrawingColor,
    setActiveDrawingColor,
    activeDrawingWidth,
    setActiveDrawingWidth,
    undo,
    redo,
    deleteSelected,
    selectedIds,
    addImage,
    toggleLockSelected,
    groupSelected,
    ungroupSelected,
    documentStore,
    viewport,
  } = useCanvasStore();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activePopover, setActivePopover] = useState<{
    type: 'shape' | 'sticky' | 'connector' | 'pen';
    rect: DOMRect;
  } | null>(null);

  const [hoverTooltip, setHoverTooltip] = useState<{
    text: string;
    kbd?: string;
    rect: DOMRect;
  } | null>(null);

  useEffect(() => {
    const handleDismiss = () => {
      setActivePopover(null);
      setHoverTooltip(null);
    };
    window.addEventListener('resize', handleDismiss);
    return () => window.removeEventListener('resize', handleDismiss);
  }, []);

  const showTooltip = (text: string, kbd?: string) => (e: React.MouseEvent<HTMLElement>) => {
    if (activePopover) return;
    setHoverTooltip({ text, kbd, rect: e.currentTarget.getBoundingClientRect() });
  };

  const hideTooltip = () => {
    setHoverTooltip(null);
  };

  const togglePopover = (type: 'shape' | 'sticky' | 'connector' | 'pen', el: HTMLElement) => {
    hideTooltip();
    setActivePopover((prev) =>
      prev?.type === type ? null : { type, rect: el.getBoundingClientRect() }
    );
  };

  const closePopovers = () => {
    setActivePopover(null);
    hideTooltip();
  };

  const boardObjects = documentStore.getState().objects;
  const selectedObjs = selectedIds.map((id) => boardObjects[id]).filter(Boolean);
  const hasLocked = selectedObjs.some((o) => o.isLocked);
  const hasGrouped = selectedObjs.some((o) => Boolean(o.groupId));

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const src = event.target?.result as string;
      if (!src) return;
      const img = new Image();
      img.onload = () => {
        let w = img.naturalWidth || 300;
        let h = img.naturalHeight || 200;
        const maxDim = 400;
        if (w > maxDim || h > maxDim) {
          const ratio = Math.min(maxDim / w, maxDim / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        const centerX = -viewport.x / viewport.zoom + (window.innerWidth / 2) / viewport.zoom - w / 2;
        const centerY = -viewport.y / viewport.zoom + (window.innerHeight / 2) / viewport.zoom - h / 2;
        addImage(src, Math.round(centerX), Math.round(centerY), w, h);
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <>
      <aside
        aria-label="Canvas tools"
        className="absolute left-4 top-20 bottom-20 my-auto h-fit max-h-[calc(100vh-10rem)] bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-xl p-1.5 flex flex-col z-30 select-none overflow-hidden"
      >
        {/* Scrollable Tool Items */}
        <div
          onScroll={() => {
            if (activePopover) setActivePopover(null);
            hideTooltip();
          }}
          className="flex flex-col gap-1 overflow-y-auto no-scrollbar py-0.5"
        >
          {/* Select */}
          <button
            onClick={() => {
              setTool('select');
              closePopovers();
            }}
            onMouseEnter={showTooltip('Select', 'V')}
            onMouseLeave={hideTooltip}
            title="Select (V)"
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors flex-shrink-0 ${
              tool === 'select'
                ? 'bg-blue-50 text-blue-600 font-medium'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <MousePointer className="w-5 h-5 stroke-[1.75]" />
          </button>

          {/* Hand / Pan */}
          <button
            onClick={() => {
              setTool('hand');
              closePopovers();
            }}
            onMouseEnter={showTooltip('Hand / Pan', 'H')}
            onMouseLeave={hideTooltip}
            title="Hand / Pan (H)"
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors flex-shrink-0 ${
              tool === 'hand'
                ? 'bg-blue-50 text-blue-600 font-medium'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Hand className="w-5 h-5 stroke-[1.75]" />
          </button>

          {/* Shapes with Popover */}
          <button
            onClick={(e) => {
              setTool('shape');
              togglePopover('shape', e.currentTarget);
            }}
            onMouseEnter={showTooltip('Shape', 'R')}
            onMouseLeave={hideTooltip}
            title="Shapes (R)"
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors flex-shrink-0 ${
              tool === 'shape'
                ? 'bg-blue-50 text-blue-600 font-medium'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Square className="w-5 h-5 stroke-[1.75]" />
          </button>

          {/* Connection Line / Arrow with Popover */}
          <button
            onClick={(e) => {
              setTool('connector');
              togglePopover('connector', e.currentTarget);
            }}
            onMouseEnter={showTooltip(activeArrowheadType === 'none' ? 'Line' : 'Arrow', 'A/L')}
            onMouseLeave={hideTooltip}
            title="Connection Line / Arrow (A, L, C)"
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors flex-shrink-0 ${
              tool === 'connector'
                ? 'bg-blue-50 text-blue-600 font-medium'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <ArrowUpRight className="w-5 h-5 stroke-[1.75]" />
          </button>

          {/* Sticky Notes with Popover */}
          <button
            onClick={(e) => {
              setTool('sticky');
              togglePopover('sticky', e.currentTarget);
            }}
            onMouseEnter={showTooltip('Sticky Note', 'N')}
            onMouseLeave={hideTooltip}
            title="Sticky Note (N)"
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors flex-shrink-0 ${
              tool === 'sticky'
                ? 'bg-blue-50 text-blue-600 font-medium'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <StickyNote className="w-5 h-5 stroke-[1.75]" />
          </button>

          {/* Freehand Pen with Popover */}
          <button
            onClick={(e) => {
              setTool('pen');
              togglePopover('pen', e.currentTarget);
            }}
            onMouseEnter={showTooltip('Pen', 'P')}
            onMouseLeave={hideTooltip}
            title="Pen (P)"
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors flex-shrink-0 ${
              tool === 'pen'
                ? 'bg-blue-50 text-blue-600 font-medium'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <PenTool className="w-5 h-5 stroke-[1.75]" />
          </button>

          {/* Highlighter */}
          <button
            onClick={() => {
              setTool('highlighter');
              closePopovers();
            }}
            onMouseEnter={showTooltip('Highlighter', 'Shift+P')}
            onMouseLeave={hideTooltip}
            title="Highlighter (Shift+P)"
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors flex-shrink-0 ${
              tool === 'highlighter'
                ? 'bg-amber-50 text-amber-600 font-medium'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Highlighter className="w-5 h-5 stroke-[1.75]" />
          </button>

          {/* Eraser */}
          <button
            onClick={() => {
              setTool('eraser');
              closePopovers();
            }}
            onMouseEnter={showTooltip('Eraser', 'E')}
            onMouseLeave={hideTooltip}
            title="Eraser (E)"
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors flex-shrink-0 ${
              tool === 'eraser'
                ? 'bg-red-50 text-red-600 font-medium'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Eraser className="w-5 h-5 stroke-[1.75]" />
          </button>

          {/* Text Box */}
          <button
            onClick={() => {
              setTool('text');
              closePopovers();
            }}
            onMouseEnter={showTooltip('Text Box', 'T')}
            onMouseLeave={hideTooltip}
            title="Text Box (T)"
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors flex-shrink-0 ${
              tool === 'text'
                ? 'bg-blue-50 text-blue-600 font-medium'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Type className="w-5 h-5 stroke-[1.75]" />
          </button>

          {/* Frame Container */}
          <button
            onClick={() => {
              setTool('frame');
              closePopovers();
            }}
            onMouseEnter={showTooltip('Frame', 'F')}
            onMouseLeave={hideTooltip}
            title="Frame (F)"
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors flex-shrink-0 ${
              tool === 'frame'
                ? 'bg-blue-50 text-blue-600 font-medium'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Frame className="w-5 h-5 stroke-[1.75]" />
          </button>

          {/* Swimlane Diagram Container */}
          <button
            onClick={() => {
              setTool('swimlane');
              closePopovers();
            }}
            onMouseEnter={showTooltip('Swimlane Diagram', 'S')}
            onMouseLeave={hideTooltip}
            title="Swimlane Diagram (S)"
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors flex-shrink-0 ${
              tool === 'swimlane'
                ? 'bg-blue-50 text-blue-600 font-medium'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Columns3 className="w-5 h-5 stroke-[1.75]" />
          </button>

          {/* Image Upload */}
          <button
            onClick={() => {
              fileInputRef.current?.click();
              closePopovers();
            }}
            onMouseEnter={showTooltip('Upload Image')}
            onMouseLeave={hideTooltip}
            title="Upload Image"
            className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors flex-shrink-0"
          >
            <ImageIcon className="w-5 h-5 stroke-[1.75]" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageFileChange}
            className="hidden"
          />

          {/* Template Library Shortcut */}
          {onOpenTemplates && (
            <button
              onClick={() => {
                closePopovers();
                onOpenTemplates();
              }}
              onMouseEnter={showTooltip('Templates Library')}
              onMouseLeave={hideTooltip}
              title="Templates Library"
              className="w-10 h-10 rounded-xl flex items-center justify-center text-purple-600 hover:bg-purple-50 transition-colors flex-shrink-0"
            >
              <Sparkles className="w-4 h-4 stroke-[1.75]" />
            </button>
          )}

          {/* Selection Actions: Lock, Group, Ungroup */}
          {selectedIds.length > 0 && (
            <>
              <div className="w-6 h-px bg-slate-200 mx-auto my-1 flex-shrink-0" />

              {/* Toggle Lock */}
              <button
                onClick={toggleLockSelected}
                onMouseEnter={showTooltip(hasLocked ? 'Unlock' : 'Lock', 'Ctrl+L')}
                onMouseLeave={hideTooltip}
                title={hasLocked ? 'Unlock (Ctrl+L)' : 'Lock (Ctrl+L)'}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors flex-shrink-0 ${
                  hasLocked ? 'bg-amber-50 text-amber-600' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {hasLocked ? <Unlock className="w-4 h-4 stroke-[1.75]" /> : <Lock className="w-4 h-4 stroke-[1.75]" />}
              </button>

              {/* Group */}
              {selectedIds.length > 1 && (
                <button
                  onClick={groupSelected}
                  onMouseEnter={showTooltip('Group', 'Ctrl+G')}
                  onMouseLeave={hideTooltip}
                  title="Group (Ctrl+G)"
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors flex-shrink-0"
                >
                  <Group className="w-4 h-4 stroke-[1.75]" />
                </button>
              )}

              {/* Ungroup */}
              {hasGrouped && (
                <button
                  onClick={ungroupSelected}
                  onMouseEnter={showTooltip('Ungroup', 'Ctrl+Shift+G')}
                  onMouseLeave={hideTooltip}
                  title="Ungroup (Ctrl+Shift+G)"
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors flex-shrink-0"
                >
                  <Ungroup className="w-4 h-4 stroke-[1.75]" />
                </button>
              )}
            </>
          )}
        </div>

        {/* Pinned Bottom Actions Divider & Buttons */}
        <div className="w-6 h-px bg-slate-200 mx-auto my-1 flex-shrink-0" />

        <div className="flex flex-col gap-1 flex-shrink-0">
          {/* Undo */}
          <button
            onClick={undo}
            onMouseEnter={showTooltip('Undo', 'Ctrl+Z')}
            onMouseLeave={hideTooltip}
            title="Undo (Ctrl+Z)"
            className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          >
            <Undo2 className="w-4 h-4 stroke-[1.75]" />
          </button>

          {/* Redo */}
          <button
            onClick={redo}
            onMouseEnter={showTooltip('Redo', 'Ctrl+Shift+Z')}
            onMouseLeave={hideTooltip}
            title="Redo (Ctrl+Shift+Z)"
            className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          >
            <Redo2 className="w-4 h-4 stroke-[1.75]" />
          </button>

          {/* Delete */}
          <button
            onClick={deleteSelected}
            disabled={selectedIds.length === 0}
            onMouseEnter={showTooltip('Delete Selected', 'Del')}
            onMouseLeave={hideTooltip}
            title="Delete Selected (Del)"
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
              selectedIds.length > 0
                ? 'text-red-500 hover:bg-red-50'
                : 'text-slate-300 cursor-not-allowed'
            }`}
          >
            <Trash2 className="w-4 h-4 stroke-[1.75]" />
          </button>
        </div>
      </aside>

      {/* Popovers Portal */}
      {activePopover &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-40 bg-transparent"
              onClick={() => setActivePopover(null)}
              onContextMenu={(e) => {
                e.preventDefault();
                setActivePopover(null);
              }}
            />
            <div
              className="fixed z-50 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-2xl p-2 animate-in fade-in zoom-in-95 duration-100"
              style={{
                left: activePopover.rect.right + 10,
                top: Math.min(window.innerHeight - 320, Math.max(16, activePopover.rect.top)),
              }}
            >
              {activePopover.type === 'shape' && (
                <div className="w-48 grid grid-cols-2 gap-1">
                  {SHAPE_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.kind}
                        onClick={() => {
                          setActiveShapeKind(opt.kind);
                          setActivePopover(null);
                        }}
                        className={`flex items-center gap-2 p-2 rounded-xl text-left text-xs transition-colors ${
                          activeShapeKind === opt.kind
                            ? 'bg-blue-50 text-blue-700 font-medium'
                            : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <Icon className="w-4 h-4 stroke-[1.75]" />
                        <span className="truncate">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {activePopover.type === 'sticky' && (
                <div className="grid grid-cols-3 gap-2 p-0.5 w-36">
                  {STICKY_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => {
                        setActiveStickyColor(c);
                        setActivePopover(null);
                      }}
                      style={{ backgroundColor: STICKY_COLOR_MAP[c].bg }}
                      className={`w-8 h-8 rounded-lg border-2 transition-transform ${
                        activeStickyColor === c
                          ? 'border-slate-800 scale-110 shadow-sm'
                          : 'border-slate-200 hover:scale-105'
                      }`}
                      title={c}
                    />
                  ))}
                </div>
              )}

              {activePopover.type === 'connector' && (
                <div className="flex flex-col gap-1.5 w-40">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-2 pt-0.5">
                    Terminal
                  </span>
                  <div className="grid grid-cols-2 gap-1 px-1">
                    <button
                      onClick={() => {
                        setActiveArrowheadType('arrow');
                        setActivePopover(null);
                      }}
                      className={`flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        activeArrowheadType === 'arrow'
                          ? 'bg-blue-50 text-blue-600 font-semibold'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                      title="Arrow (A)"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" /> Arrow
                    </button>
                    <button
                      onClick={() => {
                        setActiveArrowheadType('none');
                        setActivePopover(null);
                      }}
                      className={`flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        activeArrowheadType === 'none'
                          ? 'bg-blue-50 text-blue-600 font-semibold'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                      title="Plain Line (L)"
                    >
                      <Minus className="w-3.5 h-3.5" /> Line
                    </button>
                  </div>

                  <div className="h-px bg-slate-100 my-0.5" />

                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-2">
                    Routing Style
                  </span>
                  <button
                    onClick={() => {
                      setActiveRouting('orthogonal');
                      setActivePopover(null);
                    }}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      activeRouting === 'orthogonal'
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <CornerDownRight className="w-3.5 h-3.5" /> Elbow
                  </button>
                  <button
                    onClick={() => {
                      setActiveRouting('curved');
                      setActivePopover(null);
                    }}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      activeRouting === 'curved'
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Spline className="w-3.5 h-3.5" /> Curved
                  </button>
                  <button
                    onClick={() => {
                      setActiveRouting('straight');
                      setActivePopover(null);
                    }}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      activeRouting === 'straight'
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Minus className="w-3.5 h-3.5" /> Straight
                  </button>
                </div>
              )}

              {activePopover.type === 'pen' && (
                <div className="w-48 p-1 flex flex-col gap-2.5">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Ink Color
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {PEN_COLORS.map((col) => (
                      <button
                        key={col}
                        onClick={() => {
                          setActiveDrawingColor(col);
                          setActivePopover(null);
                        }}
                        style={{ backgroundColor: col }}
                        className={`w-6 h-6 rounded-full border-2 transition-transform ${
                          activeDrawingColor === col
                            ? 'border-slate-900 scale-110 shadow-sm'
                            : 'border-transparent hover:scale-105'
                        }`}
                      />
                    ))}
                  </div>

                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mt-1">
                    Stroke Width
                  </span>
                  <div className="flex items-center gap-1.5">
                    {PEN_WIDTHS.map((w) => (
                      <button
                        key={w}
                        onClick={() => {
                          setActiveDrawingWidth(w);
                          setActivePopover(null);
                        }}
                        className={`flex-1 py-1 rounded-lg text-xs font-medium border text-center transition-colors ${
                          activeDrawingWidth === w
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {w}px
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>,
          document.body
        )}

      {/* Tooltip Portal */}
      {hoverTooltip &&
        !activePopover &&
        createPortal(
          <div
            className="fixed pointer-events-none z-50 px-2 py-1 bg-slate-900 text-white text-xs rounded-md shadow-md whitespace-nowrap animate-in fade-in duration-100 flex items-center gap-1.5"
            style={{
              left: hoverTooltip.rect.right + 10,
              top: hoverTooltip.rect.top + hoverTooltip.rect.height / 2,
              transform: 'translateY(-50%)',
            }}
          >
            <span>{hoverTooltip.text}</span>
            {hoverTooltip.kbd && (
              <kbd className="text-slate-400 font-mono text-[10px]">({hoverTooltip.kbd})</kbd>
            )}
          </div>,
          document.body
        )}
    </>
  );
};
