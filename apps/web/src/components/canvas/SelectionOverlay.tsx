import React from 'react';
import { BoardObject, ResizeHandleType } from '@diagrammer/shared';
import { getShapeHandles, ROTATION_HANDLE_OFFSET } from '@diagrammer/engine';

interface SelectionOverlayProps {
  objects: BoardObject[];
  zoom: number;
  onHandlePointerDown: (e: React.PointerEvent, handleType: ResizeHandleType) => void;
}

export const SelectionOverlay: React.FC<SelectionOverlayProps> = ({
  objects,
  zoom,
  onHandlePointerDown,
}) => {
  if (objects.length === 0) return null;

  const handleSize = Math.max(8, 9 / Math.sqrt(zoom));

  // Single Object Selection
  if (objects.length === 1) {
    const obj = objects[0];
    if (!('x' in obj && 'y' in obj && 'width' in obj && 'height' in obj)) return null;

    const rot = obj.rotation ?? 0;
    const cx = obj.x + obj.width / 2;
    const cy = obj.y + obj.height / 2;
    const isLocked = Boolean(obj.isLocked);

    if (isLocked) {
      const badgeScale = Math.max(0.7, 1 / Math.sqrt(zoom));
      return (
        <g className="selection-overlay pointer-events-auto">
          <g transform={`rotate(${rot} ${cx} ${cy})`}>
            <rect
              x={obj.x - 2}
              y={obj.y - 2}
              width={obj.width + 4}
              height={obj.height + 4}
              fill="none"
              stroke="#94a3b8"
              strokeWidth={1.5 / zoom}
              strokeDasharray={`${4 / zoom} ${3 / zoom}`}
              className="pointer-events-none"
            />
            {/* Lock Badge */}
            <g transform={`translate(${obj.x + obj.width - 6}, ${obj.y - 6}) scale(${badgeScale})`}>
              <circle r={11} fill="#475569" className="shadow-md" />
              {/* Lock SVG icon */}
              <path
                d="M -3.5 -1 L -3.5 -3.5 C -3.5 -5.5, 3.5 -5.5, 3.5 -3.5 L 3.5 -1 M -4.5 -1 L 4.5 -1 C 5 -1, 5.5 -0.5, 5.5 0 L 5.5 5 C 5.5 5.5, 5 6, 4.5 6 L -4.5 6 C -5 6, -5.5 5.5, -5.5 5 L -5.5 0 C -5.5 -0.5, -5 -1, -4.5 -1 Z"
                fill="none"
                stroke="#ffffff"
                strokeWidth={1.4}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          </g>
        </g>
      );
    }

    const handles = getShapeHandles(obj as any);

    return (
      <g className="selection-overlay pointer-events-auto">
        {/* Rotated Selection Bounding Box */}
        <g transform={`rotate(${rot} ${cx} ${cy})`}>
          <rect
            x={obj.x - 2}
            y={obj.y - 2}
            width={obj.width + 4}
            height={obj.height + 4}
            fill="none"
            stroke="#3b82f6"
            strokeWidth={1.5 / zoom}
            strokeDasharray={`${4 / zoom} ${3 / zoom}`}
            className="pointer-events-none"
          />

          {/* Stem line to rotation handle */}
          <line
            x1={cx}
            y1={obj.y}
            x2={cx}
            y2={obj.y - ROTATION_HANDLE_OFFSET}
            stroke="#3b82f6"
            strokeWidth={1.5 / zoom}
            className="pointer-events-none"
          />
        </g>

        {/* Interactive Handles */}
        {handles.map((handle) => {
          const isRotate = handle.type === 'rotate';

          return (
            <g
              key={handle.type}
              transform={`translate(${handle.worldPos.x}, ${handle.worldPos.y})`}
              onPointerDown={(e) => onHandlePointerDown(e, handle.type)}
              style={{ cursor: handle.cursor }}
            >
              {isRotate ? (
                <circle
                  r={handleSize * 0.75}
                  fill="#ffffff"
                  stroke="#3b82f6"
                  strokeWidth={2 / zoom}
                  className="hover:fill-blue-100 hover:stroke-blue-600 transition-colors"
                />
              ) : (
                <rect
                  x={-handleSize / 2}
                  y={-handleSize / 2}
                  width={handleSize}
                  height={handleSize}
                  rx={1.5}
                  fill="#ffffff"
                  stroke="#3b82f6"
                  strokeWidth={2 / zoom}
                  className="hover:fill-blue-100 hover:stroke-blue-600 transition-colors shadow-sm"
                />
              )}
            </g>
          );
        })}
      </g>
    );
  }

  // Multi-Object Selection: common axis-aligned bounding box
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const obj of objects) {
    if ('x' in obj && 'y' in obj && 'width' in obj && 'height' in obj) {
      minX = Math.min(minX, obj.x);
      minY = Math.min(minY, obj.y);
      maxX = Math.max(maxX, obj.x + obj.width);
      maxY = Math.max(maxY, obj.y + obj.height);
    }
  }

  const multiWidth = maxX - minX;
  const multiHeight = maxY - minY;
  const allLocked = objects.every((o) => o.isLocked);

  if (allLocked) {
    const badgeScale = Math.max(0.7, 1 / Math.sqrt(zoom));
    return (
      <g className="selection-overlay-multi pointer-events-auto">
        <rect
          x={minX - 4}
          y={minY - 4}
          width={multiWidth + 8}
          height={multiHeight + 8}
          fill="#94a3b8"
          fillOpacity={0.04}
          stroke="#94a3b8"
          strokeWidth={1.5 / zoom}
          strokeDasharray={`${5 / zoom} ${4 / zoom}`}
          className="pointer-events-none"
        />
        <g transform={`translate(${maxX + 2}, ${minY - 8}) scale(${badgeScale})`}>
          <circle r={11} fill="#475569" className="shadow-md" />
          <path
            d="M -3.5 -1 L -3.5 -3.5 C -3.5 -5.5, 3.5 -5.5, 3.5 -3.5 L 3.5 -1 M -4.5 -1 L 4.5 -1 C 5 -1, 5.5 -0.5, 5.5 0 L 5.5 5 C 5.5 5.5, 5 6, 4.5 6 L -4.5 6 C -5 6, -5.5 5.5, -5.5 5 L -5.5 0 C -5.5 -0.5, -5 -1, -4.5 -1 Z"
            fill="none"
            stroke="#ffffff"
            strokeWidth={1.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </g>
    );
  }

  const multiCorners: Array<{ type: ResizeHandleType; x: number; y: number; cursor: string }> = [
    { type: 'nw', x: minX, y: minY, cursor: 'nwse-resize' },
    { type: 'ne', x: maxX, y: minY, cursor: 'nesw-resize' },
    { type: 'se', x: maxX, y: maxY, cursor: 'nwse-resize' },
    { type: 'sw', x: minX, y: maxY, cursor: 'nesw-resize' },
  ];

  return (
    <g className="selection-overlay-multi pointer-events-auto">
      <rect
        x={minX - 4}
        y={minY - 4}
        width={multiWidth + 8}
        height={multiHeight + 8}
        fill="#3b82f6"
        fillOpacity={0.04}
        stroke="#3b82f6"
        strokeWidth={1.5 / zoom}
        strokeDasharray={`${5 / zoom} ${4 / zoom}`}
        className="pointer-events-none"
      />

      {multiCorners.map((c) => (
        <rect
          key={c.type}
          x={c.x - handleSize / 2}
          y={c.y - handleSize / 2}
          width={handleSize}
          height={handleSize}
          rx={1.5}
          fill="#ffffff"
          stroke="#3b82f6"
          strokeWidth={2 / zoom}
          style={{ cursor: c.cursor }}
          onPointerDown={(e) => onHandlePointerDown(e, c.type)}
          className="hover:fill-blue-100 hover:stroke-blue-600 transition-colors shadow-sm"
        />
      ))}
    </g>
  );
};
