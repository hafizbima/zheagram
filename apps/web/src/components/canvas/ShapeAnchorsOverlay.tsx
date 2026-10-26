import React from 'react';
import {
  ShapeObject,
  StickyObject,
  TextObject,
  FrameObject,
  ImageObject,
  SwimlaneObject,
  AnchorSide,
} from '@diagrammer/shared';
import { getShapeAnchors } from '@diagrammer/engine';
import { useCanvasStore } from '../../stores/useCanvasStore';

export type ConnectableObject =
  | ShapeObject
  | StickyObject
  | TextObject
  | FrameObject
  | ImageObject
  | SwimlaneObject;

interface ShapeAnchorsOverlayProps {
  shape: ConnectableObject;
  zoom: number;
  onStartConnectorDrag?: (
    e: React.PointerEvent,
    sourceId: string,
    anchor: AnchorSide
  ) => void;
  isTargetPreview?: boolean;
  snappedSide?: AnchorSide | null;
  hidePlusButtons?: boolean;
}

export const ShapeAnchorsOverlay: React.FC<ShapeAnchorsOverlayProps> = ({
  shape,
  zoom,
  onStartConnectorDrag,
  isTargetPreview = false,
  snappedSide = null,
  hidePlusButtons = false,
}) => {
  const { quickCreateConnectedNode } = useCanvasStore();
  const anchors = getShapeAnchors(shape as any);
  const dotRadius = Math.max(5, 6 / Math.sqrt(zoom));
  const plusBtnSize = Math.max(18, 20 / Math.sqrt(zoom));

  const sides: AnchorSide[] = ['top', 'right', 'bottom', 'left'];

  return (
    <g className="shape-anchors-overlay pointer-events-auto">
      {/* 4 Magnetic Anchor Dots */}
      {sides.map((side) => {
        const anchor = anchors[side];
        const isSnapped = isTargetPreview && snappedSide === side;

        return (
          <g
            key={side}
            transform={`translate(${anchor.pos.x}, ${anchor.pos.y})`}
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              if (onStartConnectorDrag) {
                e.stopPropagation();
                onStartConnectorDrag(e, shape.id, side);
              }
            }}
            className={`cursor-crosshair group ${isTargetPreview ? 'pointer-events-none' : ''}`}
          >
            {/* Wider hit circle */}
            <circle r={dotRadius * 2.5} fill="transparent" />

            {/* Magnetic snap pulse ring (when target anchor is magnetically snapped) */}
            {isSnapped && (
              <circle
                r={dotRadius * 2.2}
                fill="#3b82f6"
                fillOpacity={0.3}
                stroke="#3b82f6"
                strokeWidth={1.5 / zoom}
                className="animate-pulse"
              />
            )}

            {/* Hover glow ring */}
            <circle
              r={dotRadius * 1.6}
              fill="#3b82f6"
              fillOpacity={0.25}
              className={`transition-opacity pointer-events-none ${
                isSnapped ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              }`}
            />

            {/* Core anchor dot */}
            <circle
              r={isSnapped ? dotRadius * 1.25 : dotRadius}
              fill={isSnapped ? '#1d4ed8' : '#3b82f6'}
              stroke="#ffffff"
              strokeWidth={2 / zoom}
              className="group-hover:fill-blue-600 transition-all shadow-md pointer-events-none"
            />
          </g>
        );
      })}

      {/* Quick "+" Connect Button on Right (only when not in target preview and not hiding plus buttons) */}
      {!isTargetPreview && !hidePlusButtons && (
        <g
          transform={`translate(${anchors.right.pos.x + 28 / zoom}, ${anchors.right.pos.y})`}
          onClick={(e) => {
            e.stopPropagation();
            quickCreateConnectedNode(shape.id, 'right');
          }}
          className="cursor-pointer group"
        >
          <title>Quick connect right (Tab)</title>
          <circle
            r={plusBtnSize / 2}
            fill="#3b82f6"
            className="group-hover:fill-blue-700 transition-colors shadow-md"
          />
          <path
            d={`M ${-4 / zoom} 0 L ${4 / zoom} 0 M 0 ${-4 / zoom} L 0 ${4 / zoom}`}
            stroke="#ffffff"
            strokeWidth={2 / zoom}
            strokeLinecap="round"
            className="pointer-events-none"
          />
        </g>
      )}

      {/* Quick "+" Connect Button on Bottom (only when not in target preview and not hiding plus buttons) */}
      {!isTargetPreview && !hidePlusButtons && (
        <g
          transform={`translate(${anchors.bottom.pos.x}, ${anchors.bottom.pos.y + 28 / zoom})`}
          onClick={(e) => {
            e.stopPropagation();
            quickCreateConnectedNode(shape.id, 'bottom');
          }}
          className="cursor-pointer group"
        >
          <title>Quick connect down (Enter)</title>
          <circle
            r={plusBtnSize / 2}
            fill="#3b82f6"
            className="group-hover:fill-blue-700 transition-colors shadow-md"
          />
          <path
            d={`M ${-4 / zoom} 0 L ${4 / zoom} 0 M 0 ${-4 / zoom} L 0 ${4 / zoom}`}
            stroke="#ffffff"
            strokeWidth={2 / zoom}
            strokeLinecap="round"
            className="pointer-events-none"
          />
        </g>
      )}
    </g>
  );
};
