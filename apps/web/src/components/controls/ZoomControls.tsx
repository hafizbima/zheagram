import React from 'react';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { Minus, Plus, Maximize, Mouse, Laptop, Zap } from 'lucide-react';

export const ZoomControls: React.FC = () => {
  const { viewport, zoomAt, resetZoom, zoomToFit, navigationMode, setNavigationMode } = useCanvasStore();

  const handleZoomIn = () => {
    // Zoom in around screen center
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    zoomAt({ x: cx, y: cy }, 1.25);
  };

  const handleZoomOut = () => {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    zoomAt({ x: cx, y: cy }, 0.8);
  };

  const handleZoomToFit = () => {
    zoomToFit(window.innerWidth, window.innerHeight);
  };

  const cycleNavigationMode = () => {
    if (navigationMode === 'auto') {
      setNavigationMode('trackpad');
    } else if (navigationMode === 'trackpad') {
      setNavigationMode('mouse');
    } else {
      setNavigationMode('auto');
    }
  };

  const zoomPercent = Math.round(viewport.zoom * 100);

  return (
    <div className="absolute bottom-5 left-5 flex items-center gap-1 bg-white/95 backdrop-blur-sm border border-slate-200/80 px-2 py-1.5 rounded-2xl shadow-lg z-30 select-none">
      <button
        onClick={handleZoomOut}
        title="Zoom Out (Ctrl -)"
        className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors"
      >
        <Minus className="w-3.5 h-3.5" />
      </button>

      <button
        onClick={resetZoom}
        title="Reset to 100% (Shift 0)"
        className="px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-md transition-colors min-w-[48px] text-center"
      >
        {zoomPercent}%
      </button>

      <button
        onClick={handleZoomIn}
        title="Zoom In (Ctrl +)"
        className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>

      <div className="w-px h-4 bg-slate-200 mx-1" />

      <button
        onClick={handleZoomToFit}
        title="Zoom to Fit (Shift 1)"
        className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors"
      >
        <Maximize className="w-3.5 h-3.5" />
      </button>

      <div className="w-px h-4 bg-slate-200 mx-1" />

      {/* Navigation Mode: Trackpad vs Mouse vs Auto */}
      <button
        onClick={cycleNavigationMode}
        title={
          navigationMode === 'trackpad'
            ? 'Trackpad Mode: 2-finger scroll adjusts scrollbar/pan, pinch zooms (Click to cycle)'
            : navigationMode === 'mouse'
            ? 'Mouse Mode: Wheel zooms, Shift/Ctrl pans (Click to cycle)'
            : 'Auto Mode: Adjusts scrollbar on trackpad, zooms on mouse wheel (Click to cycle)'
        }
        className={`flex items-center gap-1.5 px-2 py-1 rounded-xl text-xs font-medium transition-colors ${
          navigationMode === 'trackpad'
            ? 'bg-blue-50 text-blue-700 hover:bg-blue-100'
            : navigationMode === 'mouse'
            ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        }`}
      >
        {navigationMode === 'trackpad' ? (
          <>
            <Laptop className="w-3.5 h-3.5 text-blue-600" />
            <span>Trackpad</span>
          </>
        ) : navigationMode === 'mouse' ? (
          <>
            <Mouse className="w-3.5 h-3.5 text-amber-600" />
            <span>Mouse</span>
          </>
        ) : (
          <>
            <Zap className="w-3.5 h-3.5 text-blue-500" />
            <span>Auto</span>
          </>
        )}
      </button>
    </div>
  );
};
