import React, { useRef, useState, useEffect } from 'react';
import { useCanvasStore, STICKY_COLOR_MAP } from '../../stores/useCanvasStore';
import { Map, ChevronDown, ChevronUp } from 'lucide-react';

export const Minimap: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const { documentStore, viewport, setViewport } = useCanvasStore();

  const boardState = documentStore.getState();
  const objects = Object.values(boardState.objects);

  // Compute bounds of all objects
  let minX = -500;
  let minY = -400;
  let maxX = 1500;
  let maxY = 1000;

  for (const obj of objects) {
    if ('x' in obj && 'y' in obj && 'width' in obj && 'height' in obj) {
      minX = Math.min(minX, obj.x - 200);
      minY = Math.min(minY, obj.y - 200);
      maxX = Math.max(maxX, obj.x + obj.width + 200);
      maxY = Math.max(maxY, obj.y + obj.height + 200);
    }
  }

  const mapWidth = 200;
  const mapHeight = 130;
  const worldWidth = Math.max(800, maxX - minX);
  const worldHeight = Math.max(600, maxY - minY);

  const scaleX = mapWidth / worldWidth;
  const scaleY = mapHeight / worldHeight;
  const mapScale = Math.min(scaleX, scaleY);

  const worldToMap = (wx: number, wy: number) => ({
    x: (wx - minX) * mapScale,
    y: (wy - minY) * mapScale,
  });

  const mapToWorld = (mx: number, my: number) => ({
    x: mx / mapScale + minX,
    y: my / mapScale + minY,
  });

  // Viewport camera rect in map coordinates
  const viewWidth = window.innerWidth;
  const viewHeight = window.innerHeight;

  const viewWorldMinX = -viewport.x / viewport.zoom;
  const viewWorldMinY = -viewport.y / viewport.zoom;
  const viewWorldMaxX = (viewWidth - viewport.x) / viewport.zoom;
  const viewWorldMaxY = (viewHeight - viewport.y) / viewport.zoom;

  const viewMapStart = worldToMap(viewWorldMinX, viewWorldMinY);
  const viewMapEnd = worldToMap(viewWorldMaxX, viewWorldMaxY);
  const viewMapW = Math.max(12, viewMapEnd.x - viewMapStart.x);
  const viewMapH = Math.max(8, viewMapEnd.y - viewMapStart.y);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const targetWorld = mapToWorld(mx, my);

    setViewport((prev) => ({
      ...prev,
      x: viewWidth / 2 - targetWorld.x * prev.zoom,
      y: viewHeight / 2 - targetWorld.y * prev.zoom,
    }));
  };

  return (
    <div className="absolute bottom-5 right-28 z-30 select-none">
      <div className="bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-xl overflow-hidden transition-all duration-200">
        {/* Header toggle */}
        <div
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center justify-between px-3 py-1.5 cursor-pointer hover:bg-slate-50 transition-colors text-xs font-semibold text-slate-700 border-b border-slate-100"
        >
          <div className="flex items-center gap-1.5">
            <Map className="w-3.5 h-3.5 text-blue-600" />
            <span>Radar Minimap</span>
          </div>
          <button className="text-slate-400 hover:text-slate-600 p-0.5">
            {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Minimap SVG canvas */}
        {isExpanded && (
          <div
            ref={containerRef}
            onPointerDown={handlePointerDown}
            className="w-[200px] h-[130px] bg-slate-50 relative cursor-crosshair overflow-hidden"
          >
            <svg width={mapWidth} height={mapHeight} className="pointer-events-none">
              {/* Objects */}
              {objects.map((obj) => {
                if (obj.type === 'connector' || !('x' in obj)) return null;

                const pos = worldToMap(obj.x, obj.y);
                const w = Math.max(2, (obj.width || 40) * mapScale);
                const h = Math.max(2, (obj.height || 30) * mapScale);

                let fill = '#94a3b8';
                if (obj.type === 'sticky') {
                  fill = STICKY_COLOR_MAP[obj.color]?.border || '#facc15';
                } else if (obj.type === 'shape') {
                  fill = obj.style?.stroke || '#3b82f6';
                } else if (obj.type === 'frame') {
                  fill = '#cbd5e1';
                } else if (obj.type === 'swimlane') {
                  fill = '#3b82f6';
                }

                return (
                  <rect
                    key={obj.id}
                    x={pos.x}
                    y={pos.y}
                    width={w}
                    height={h}
                    rx={1}
                    fill={fill}
                    opacity={obj.type === 'frame' ? 0.3 : obj.type === 'swimlane' ? 0.25 : 0.8}
                    stroke={obj.type === 'swimlane' ? '#3b82f6' : undefined}
                    strokeWidth={obj.type === 'swimlane' ? 0.5 : undefined}
                  />
                );
              })}

              {/* Viewport Frustum Box */}
              <rect
                x={viewMapStart.x}
                y={viewMapStart.y}
                width={viewMapW}
                height={viewMapH}
                fill="#3b82f6"
                fillOpacity={0.15}
                stroke="#3b82f6"
                strokeWidth={1.5}
                rx={2}
              />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
};
