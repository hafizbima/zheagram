import React from 'react';
import {
  ConnectorObject,
  BoardObject,
  AnchorSide,
  RoutingType,
  Point,
} from '@diagrammer/shared';
import {
  calculateConnectorRoute,
  getShapeAnchors,
  AnchorPoint,
  Box,
} from '@diagrammer/engine';

interface ConnectorLayerProps {
  connectors: ConnectorObject[];
  objects: Record<string, BoardObject>;
  boardVersion?: number;
  selectedIds: string[];
  zoom: number;
  reconnectingConnectorId?: string | null;
  onSelectConnector: (id: string, e: React.MouseEvent) => void;
  onDoubleClickConnector: (id: string, e: React.MouseEvent) => void;
  onEndpointPointerDown?: (
    e: React.PointerEvent,
    connectorId: string,
    endpoint: 'from' | 'to'
  ) => void;
}

export const ConnectorLayer: React.FC<ConnectorLayerProps> = ({
  connectors,
  objects,
  boardVersion,
  selectedIds,
  zoom,
  reconnectingConnectorId,
  onSelectConnector,
  onDoubleClickConnector,
  onEndpointPointerDown,
}) => {
  const resolveAnchor = (
    endpoint: { objectId: string; anchor: AnchorSide } | { x: number; y: number },
    defaultSide: AnchorSide = 'right'
  ): AnchorPoint | null => {
    if ('objectId' in endpoint) {
      const obj = objects[endpoint.objectId];
      if (!obj || !('x' in obj && 'y' in obj && 'width' in obj && 'height' in obj)) {
        return null;
      }
      const anchors = getShapeAnchors(obj as any);
      return anchors[endpoint.anchor] || anchors.right;
    } else {
      return {
        side: defaultSide,
        pos: { x: endpoint.x, y: endpoint.y },
        normal: { x: 0, y: 0 },
      };
    }
  };

  const uniqueColors = Array.from(
    new Set([
      '#64748b',
      '#3b82f6',
      ...connectors.map((c) => c.style.stroke || '#64748b'),
    ])
  );

  const obstacles: Box[] = React.useMemo(() => {
    const list: Box[] = [];
    for (const obj of Object.values(objects)) {
      if (
        !obj ||
        obj.type === 'connector' ||
        obj.type === 'swimlane' ||
        obj.type === 'frame' ||
        obj.type === 'drawing' ||
        !('x' in obj) ||
        !('width' in obj) ||
        !('height' in obj)
      ) {
        continue;
      }
      list.push({
        minX: obj.x,
        minY: obj.y,
        maxX: obj.x + (obj as any).width,
        maxY: obj.y + (obj as any).height,
      });
    }
    return list;
  }, [objects, boardVersion]);

  return (
    <g className="connector-layer">
      <defs>
        {uniqueColors.map((color) => {
          const colorKey = color.replace(/[^a-zA-Z0-9]/g, '');
          return (
            <React.Fragment key={colorKey}>
              {/* 1. Open Arrow Marker */}
              <marker
                id={`marker-arrow-end-${colorKey}`}
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto"
              >
                <path
                  d="M 1 1.5 L 8 5 L 1 8.5"
                  fill="none"
                  stroke={color}
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </marker>
              <marker
                id={`marker-arrow-start-${colorKey}`}
                viewBox="0 0 10 10"
                refX="2"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto"
              >
                <path
                  d="M 8 1.5 L 1 5 L 8 8.5"
                  fill="none"
                  stroke={color}
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </marker>

              {/* 2. Solid Triangle Marker */}
              <marker
                id={`marker-triangle-end-${colorKey}`}
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto"
              >
                <polygon points="0 1.5, 9 5, 0 8.5" fill={color} />
              </marker>
              <marker
                id={`marker-triangle-start-${colorKey}`}
                viewBox="0 0 10 10"
                refX="2"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto"
              >
                <polygon points="9 1.5, 0 5, 9 8.5" fill={color} />
              </marker>

              {/* 3. Solid Circle Dot Marker */}
              <marker
                id={`marker-circle-end-${colorKey}`}
                viewBox="0 0 10 10"
                refX="5"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto"
              >
                <circle cx="5" cy="5" r="3.5" fill={color} stroke="#ffffff" strokeWidth="0.8" />
              </marker>
              <marker
                id={`marker-circle-start-${colorKey}`}
                viewBox="0 0 10 10"
                refX="5"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto"
              >
                <circle cx="5" cy="5" r="3.5" fill={color} stroke="#ffffff" strokeWidth="0.8" />
              </marker>

              {/* 4. Solid Diamond Marker */}
              <marker
                id={`marker-diamond-end-${colorKey}`}
                viewBox="0 0 10 10"
                refX="5"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto"
              >
                <polygon points="5 1.5, 8.5 5, 5 8.5, 1.5 5" fill={color} />
              </marker>
              <marker
                id={`marker-diamond-start-${colorKey}`}
                viewBox="0 0 10 10"
                refX="5"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto"
              >
                <polygon points="5 1.5, 8.5 5, 5 8.5, 1.5 5" fill={color} />
              </marker>
            </React.Fragment>
          );
        })}
      </defs>

      {connectors.map((conn) => {
        const fromAnchor = resolveAnchor(conn.from, 'right');
        const toAnchor = resolveAnchor(conn.to, 'left');

        if (!fromAnchor || !toAnchor) return null;

        const isSelected = selectedIds.includes(conn.id);
        const isSelfLoop =
          'objectId' in conn.from &&
          'objectId' in conn.to &&
          conn.from.objectId === conn.to.objectId;

        const fromObj = 'objectId' in conn.from ? objects[conn.from.objectId] : null;
        const toObj = 'objectId' in conn.to ? objects[conn.to.objectId] : null;
        const selfBounds =
          isSelfLoop && fromObj && 'x' in fromObj
            ? {
                minX: fromObj.x,
                minY: fromObj.y,
                maxX: fromObj.x + (fromObj as any).width,
                maxY: fromObj.y + (fromObj as any).height,
              }
            : undefined;

        // Filter out terminal objects so they are not treated as obstacles to their own connector
        const connObstacles = obstacles.filter((b) => {
          if (fromObj && 'x' in fromObj && b.minX === fromObj.x && b.minY === fromObj.y) return false;
          if (toObj && 'x' in toObj && b.minX === toObj.x && b.minY === toObj.y) return false;
          return true;
        });

        const { svgPath, labelPosition } = calculateConnectorRoute(
          fromAnchor,
          toAnchor,
          conn.routing,
          conn.waypoints || [],
          isSelfLoop,
          selfBounds,
          connObstacles
        );

        const strokeColor = isSelected ? '#3b82f6' : conn.style.stroke || '#64748b';
        const strokeWidth = (conn.style.strokeWidth || 2) * (isSelected ? 1.25 : 1);
        const colorKey = strokeColor.replace(/[^a-zA-Z0-9]/g, '');
        const endType = conn.style?.endArrowhead;
        const startType = conn.style?.startArrowhead;
        const markerEnd = endType && endType !== 'none' ? `url(#marker-${endType}-end-${colorKey})` : undefined;
        const markerStart = startType && startType !== 'none' ? `url(#marker-${startType}-start-${colorKey})` : undefined;
        const isBeingReconnected = conn.id === reconnectingConnectorId;

        return (
          <g
            key={conn.id}
            className="connector-item cursor-pointer transition-opacity"
            opacity={isBeingReconnected ? 0.15 : 1}
            style={{ pointerEvents: isBeingReconnected ? 'none' : 'auto' }}
          >
            {/* Invisible stroke for easy clicking */}
            <path
              d={svgPath}
              fill="none"
              stroke="transparent"
              strokeWidth={Math.max(12, Math.min(24, 16 / zoom))}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                e.stopPropagation();
                onSelectConnector(conn.id, e as any);
              }}
              onClick={(e) => {
                if (e.button !== 0) return;
                e.stopPropagation();
                onSelectConnector(conn.id, e);
              }}
              onDoubleClick={(e) => {
                if (e.button !== 0) return;
                e.stopPropagation();
                onDoubleClickConnector(conn.id, e);
              }}
            />

            {/* Selection Glow */}
            {isSelected && (
              <path
                d={svgPath}
                fill="none"
                stroke="#3b82f6"
                strokeWidth={strokeWidth + 4 / zoom}
                strokeOpacity={0.25}
                strokeLinejoin="round"
                strokeLinecap="round"
                className="pointer-events-none"
              />
            )}

            {/* Main Visible Path */}
            <path
              d={svgPath}
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray={
                conn.style.strokeDash === 'dashed'
                  ? '6 4'
                  : conn.style.strokeDash === 'dotted'
                  ? '2 3'
                  : undefined
              }
              markerEnd={markerEnd}
              markerStart={markerStart}
              className="pointer-events-none transition-colors"
            />

            {/* Midpoint Text Label */}
            {conn.label && (
              <g
                transform={`translate(${labelPosition.x}, ${labelPosition.y})`}
                onPointerDown={(e) => {
                  if (e.button !== 0) return;
                  e.stopPropagation();
                  onSelectConnector(conn.id, e as any);
                }}
                onClick={(e) => {
                  if (e.button !== 0) return;
                  e.stopPropagation();
                  onSelectConnector(conn.id, e);
                }}
                onDoubleClick={(e) => {
                  if (e.button !== 0) return;
                  e.stopPropagation();
                  onDoubleClickConnector(conn.id, e);
                }}
              >
                {/* Pill background */}
                <rect
                  x={-Math.max(24, conn.label.length * 4.5)}
                  y={-11}
                  width={Math.max(48, conn.label.length * 9)}
                  height={22}
                  rx={6}
                  fill="#ffffff"
                  stroke={isSelected ? '#3b82f6' : '#cbd5e1'}
                  strokeWidth={1}
                  className="shadow-sm"
                />
                <text
                  x={0}
                  y={0}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#1e293b"
                  fontSize={12}
                  fontWeight={500}
                  className="select-none font-sans pointer-events-none"
                >
                  {conn.label}
                </text>
              </g>
            )}

          </g>
        );
      })}
    </g>
  );
};
