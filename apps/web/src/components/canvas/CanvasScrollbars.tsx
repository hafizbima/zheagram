import React, { useRef, useState, useEffect } from 'react';
import { useCanvasStore } from '../../stores/useCanvasStore';

export const CanvasScrollbars: React.FC = () => {
  const { viewport, setViewport, documentStore } = useCanvasStore();

  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState<'h' | 'v' | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  const dragStartRef = useRef<{
    clientX: number;
    clientY: number;
    initialProgress: number;
  }>({ clientX: 0, clientY: 0, initialProgress: 0 });

  const scrollbarRafRef = useRef<number | null>(null);
  const latestDragPosRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Light up scrollbars whenever viewport or board state changes
  useEffect(() => {
    setIsVisible(true);
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    fadeTimerRef.current = setTimeout(() => {
      if (!isHovered && !isDragging) {
        setIsVisible(false);
      }
    }, 1800);
    return () => {
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, [viewport.x, viewport.y, viewport.zoom, isHovered, isDragging]);

  useEffect(() => {
    return () => {
      if (scrollbarRafRef.current) {
        cancelAnimationFrame(scrollbarRafRef.current);
      }
    };
  }, []);

  // Compute world content bounds across all objects
  const boardState = documentStore.getState();
  const objects = Object.values(boardState.objects);

  let minObjX = -500;
  let minObjY = -400;
  let maxObjX = 1800;
  let maxObjY = 1200;

  for (const obj of objects) {
    if ('x' in obj && 'y' in obj && 'width' in obj && 'height' in obj) {
      minObjX = Math.min(minObjX, obj.x);
      minObjY = Math.min(minObjY, obj.y);
      maxObjX = Math.max(maxObjX, obj.x + (obj as any).width);
      maxObjY = Math.max(maxObjY, obj.y + (obj as any).height);
    }
  }

  const winW = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const winH = typeof window !== 'undefined' ? window.innerHeight : 800;

  const camWorldLeft = -viewport.x / viewport.zoom;
  const camWorldTop = -viewport.y / viewport.zoom;
  const camWorldWidth = winW / viewport.zoom;
  const camWorldHeight = winH / viewport.zoom;

  const marginX = Math.max(600, camWorldWidth * 0.4);
  const marginY = Math.max(600, camWorldHeight * 0.4);

  const totalMinX = Math.min(minObjX - marginX, camWorldLeft - 200);
  const totalMaxX = Math.max(maxObjX + marginX, camWorldLeft + camWorldWidth + 200);
  const totalMinY = Math.min(minObjY - marginY, camWorldTop - 200);
  const totalMaxY = Math.max(maxObjY + marginY, camWorldTop + camWorldHeight + 200);

  const totalWorldWidth = Math.max(2000, totalMaxX - totalMinX);
  const totalWorldHeight = Math.max(1600, totalMaxY - totalMinY);

  // Vertical scrollbar math
  const trackHeight = Math.max(120, winH - 220);
  const visibleRatioY = Math.min(1, Math.max(0.06, camWorldHeight / totalWorldHeight));
  const thumbHeight = Math.max(36, Math.round(visibleRatioY * trackHeight));
  const rangeY = totalWorldHeight - camWorldHeight;
  const progressY = rangeY > 0 ? Math.min(1, Math.max(0, (camWorldTop - totalMinY) / rangeY)) : 0;
  const thumbTop = Math.round(progressY * (trackHeight - thumbHeight));

  // Horizontal scrollbar math
  const trackWidth = Math.max(160, winW - 420);
  const visibleRatioX = Math.min(1, Math.max(0.06, camWorldWidth / totalWorldWidth));
  const thumbWidth = Math.max(48, Math.round(visibleRatioX * trackWidth));
  const rangeX = totalWorldWidth - camWorldWidth;
  const progressX = rangeX > 0 ? Math.min(1, Math.max(0, (camWorldLeft - totalMinX) / rangeX)) : 0;
  const thumbLeft = Math.round(progressX * (trackWidth - thumbWidth));

  // Handle dragging vertical thumb
  const handleVerticalThumbDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      initialProgress: progressY,
    };
    setIsDragging('v');
  };

  // Handle dragging horizontal thumb
  const handleHorizontalThumbDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      initialProgress: progressX,
    };
    setIsDragging('h');
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    e.stopPropagation();

    latestDragPosRef.current = { clientX: e.clientX, clientY: e.clientY };

    if (!scrollbarRafRef.current) {
      scrollbarRafRef.current = requestAnimationFrame(() => {
        scrollbarRafRef.current = null;
        if (!latestDragPosRef.current) return;

        if (isDragging === 'v') {
          const deltaScreenY = latestDragPosRef.current.clientY - dragStartRef.current.clientY;
          const availableTrackH = trackHeight - thumbHeight;
          if (availableTrackH <= 0) return;
          const progressDelta = deltaScreenY / availableTrackH;
          const newProgress = Math.min(1, Math.max(0, dragStartRef.current.initialProgress + progressDelta));
          const newCamWorldTop = totalMinY + newProgress * rangeY;
          setViewport((prev) => ({
            ...prev,
            y: Math.round(-newCamWorldTop * prev.zoom),
          }));
        } else if (isDragging === 'h') {
          const deltaScreenX = latestDragPosRef.current.clientX - dragStartRef.current.clientX;
          const availableTrackW = trackWidth - thumbWidth;
          if (availableTrackW <= 0) return;
          const progressDelta = deltaScreenX / availableTrackW;
          const newProgress = Math.min(1, Math.max(0, dragStartRef.current.initialProgress + progressDelta));
          const newCamWorldLeft = totalMinX + newProgress * rangeX;
          setViewport((prev) => ({
            ...prev,
            x: Math.round(-newCamWorldLeft * prev.zoom),
          }));
        }
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    if (scrollbarRafRef.current) {
      cancelAnimationFrame(scrollbarRafRef.current);
      scrollbarRafRef.current = null;
    }
    latestDragPosRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    setIsDragging(null);
  };

  // Clicking on vertical track jumps to location
  const handleVerticalTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const clickProgress = Math.min(1, Math.max(0, (clickY - thumbHeight / 2) / (trackHeight - thumbHeight)));
    const targetCamTop = totalMinY + clickProgress * rangeY;
    setViewport((prev) => ({
      ...prev,
      y: Math.round(-targetCamTop * prev.zoom),
    }));
    setIsVisible(true);
  };

  // Clicking on horizontal track jumps to location
  const handleHorizontalTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickProgress = Math.min(1, Math.max(0, (clickX - thumbWidth / 2) / (trackWidth - thumbWidth)));
    const targetCamLeft = totalMinX + clickProgress * rangeX;
    setViewport((prev) => ({
      ...prev,
      x: Math.round(-targetCamLeft * prev.zoom),
    }));
    setIsVisible(true);
  };

  return (
    <div
      className={`pointer-events-none fixed inset-0 z-20 transition-opacity duration-300 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Vertical Scrollbar (Right edge) */}
      <div
        className="pointer-events-auto absolute right-2 top-20 flex items-center justify-center transition-all group"
        style={{ height: trackHeight }}
      >
        <div
          onClick={handleVerticalTrackClick}
          className="relative h-full w-2 hover:w-3.5 bg-slate-300/30 hover:bg-slate-300/60 rounded-full transition-all cursor-pointer shadow-sm backdrop-blur-[2px]"
          title="Scroll Canvas Vertically"
        >
          <div
            onPointerDown={handleVerticalThumbDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{
              top: thumbTop,
              height: thumbHeight,
            }}
            className={`absolute left-0 right-0 rounded-full transition-colors cursor-grab active:cursor-grabbing ${
              isDragging === 'v'
                ? 'bg-blue-600 shadow-md ring-2 ring-blue-300/50'
                : 'bg-slate-500/60 hover:bg-slate-600 group-hover:bg-slate-600/80'
            }`}
          />
        </div>
      </div>

      {/* Horizontal Scrollbar (Bottom edge, centered between left and right controls) */}
      <div
        className="pointer-events-auto absolute bottom-2.5 left-36 flex items-center justify-center transition-all group"
        style={{ width: trackWidth }}
      >
        <div
          onClick={handleHorizontalTrackClick}
          className="relative w-full h-2 hover:h-3.5 bg-slate-300/30 hover:bg-slate-300/60 rounded-full transition-all cursor-pointer shadow-sm backdrop-blur-[2px]"
          title="Scroll Canvas Horizontally"
        >
          <div
            onPointerDown={handleHorizontalThumbDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{
              left: thumbLeft,
              width: thumbWidth,
            }}
            className={`absolute top-0 bottom-0 rounded-full transition-colors cursor-grab active:cursor-grabbing ${
              isDragging === 'h'
                ? 'bg-blue-600 shadow-md ring-2 ring-blue-300/50'
                : 'bg-slate-500/60 hover:bg-slate-600 group-hover:bg-slate-600/80'
            }`}
          />
        </div>
      </div>
    </div>
  );
};
