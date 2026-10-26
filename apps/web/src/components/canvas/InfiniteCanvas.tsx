import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useCanvasStore, STICKY_COLOR_MAP } from '../../stores/useCanvasStore';
import {
  screenToWorld,
  worldToScreen,
  clampZoom,
  snapPointToGrid,
  calculateResize,
  calculateRotation,
  getAdaptiveGridParams,
  getShapeSvgData,
  getNearestAnchor,
  getShapeAnchors,
  calculateConnectorRoute,
  AnchorPoint,
  Box,
  pointsToSvgPath,
  AddObjectsCommand,
  UpdateObjectsCommand,
  DeleteObjectsCommand,
  calculateSnapGuides,
  SnapLine,
  parseRichText,
  combineParallelAnchors,
  getSideNormal,
  getSwimlaneLayout,
  SwimlaneComputedLane,
  SwimlaneDivider,
} from '@diagrammer/engine';

import {
  Point,
  ResizeHandleType,
  TextStyle,
  BoardObject,
  ShapeObject,
  StickyObject,
  TextObject,
  FrameObject,
  ConnectorObject,
  ConnectorEndpoint,
  DrawingObject,
  DrawingPoint,
  ImageObject,
  SwimlaneObject,
  SwimlaneLane,
  AnchorSide,
  ViewportTransform,
} from '@diagrammer/shared';
import { SelectionOverlay } from './SelectionOverlay';
import { InlineTextEditor } from './InlineTextEditor';
import { InlineLaneTitleEditor } from './InlineLaneTitleEditor';
import { ConnectorLayer } from './ConnectorLayer';
import { ShapeAnchorsOverlay, ConnectableObject } from './ShapeAnchorsOverlay';
import { FloatingConnectorToolbar } from './FloatingConnectorToolbar';
import { CanvasScrollbars } from './CanvasScrollbars';

type DragMode =
  | { type: 'idle' }
  | {
      type: 'pan';
      startScreen: Point;
      startClientX?: number;
      startClientY?: number;
      initialViewport: { x: number; y: number };
    }
  | {
      type: 'move';
      startWorld: Point;
      startScreen: Point;
      initialPositions: Record<string, Point>;
      isAltDuplicate?: boolean;
      hasDuplicated?: boolean;
    }
  | {
      type: 'resize';
      handle: ResizeHandleType;
      initialShape: any;
    }
  | {
      type: 'rotate';
      initialShape: any;
    }
  | {
      type: 'create';
      startWorld: Point;
    }
  | {
      type: 'marquee';
      startWorld: Point;
    }
  | {
      type: 'connector';
      sourceId: string | null;
      sourceAnchor?: AnchorSide;
      startWorld: Point;
      currentWorld: Point;
      targetSnap?: { objectId: string; side: AnchorSide; pos: Point } | null;
    }
  | {
      type: 'reconnect-endpoint';
      connectorId: string;
      endpoint: 'from' | 'to';
      currentWorld: Point;
      targetSnap?: { objectId: string; side: AnchorSide; pos: Point } | null;
    }
  | {
      type: 'draw';
      points: DrawingPoint[];
      isHighlighter: boolean;
    }
  | {
      type: 'erase';
      lastWorld: Point;
    }
  | {
      type: 'move-waypoint';
      connectorId: string;
      waypointIndex: number;
      initialConnector: ConnectorObject;
    }
  | {
      type: 'resize-swimlane-divider';
      swimlaneId: string;
      dividerId?: string;
      dividerType: 'pool-header' | 'lane-header-col' | 'lane';
      laneIndex?: number;
      startScreen?: Point;
      startWorld: Point;
      initialSwimlane: SwimlaneObject;
    };

const isConnectableObject = (obj: any): obj is ConnectableObject => {
  return Boolean(
    obj &&
      'x' in obj &&
      'y' in obj &&
      'width' in obj &&
      'height' in obj &&
      (obj.type === 'shape' ||
        obj.type === 'sticky' ||
        obj.type === 'text' ||
        obj.type === 'frame' ||
        obj.type === 'image' ||
        obj.type === 'swimlane')
  );
};

const resolveEndpointAnchor = (
  endpoint: ConnectorEndpoint,
  objects: Record<string, BoardObject>,
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

interface RichSvgTextProps {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  cx: number;
  cy: number;
  textStyle?: TextStyle;
  defaultFontSize?: number;
  defaultAlign?: 'left' | 'center' | 'right';
  defaultFontWeight?: string | number;
  defaultColor?: string;
  paddingX?: number;
  verticalAlign?: 'middle' | 'top';
}

const RichSvgText: React.FC<RichSvgTextProps> = ({
  text,
  x,
  y,
  width,
  cx,
  cy,
  textStyle,
  defaultFontSize = 14,
  defaultAlign = 'center',
  defaultFontWeight = 500,
  defaultColor = '#1e293b',
  paddingX = 14,
  verticalAlign = 'middle',
}) => {
  const formattedLines = useMemo(() => parseRichText(text), [text]);
  const fontSize = textStyle?.fontSize || defaultFontSize;
  const lineHeight = fontSize * 1.35;
  const totalHeight = formattedLines.length * lineHeight;
  const startY = verticalAlign === 'top' ? y + 26 : cy - totalHeight / 2 + fontSize * 0.8;

  const textAlign = textStyle?.textAlign || defaultAlign;
  const textAnchor =
    textAlign === 'left' ? 'start' : textAlign === 'right' ? 'end' : 'middle';
  const textX =
    textAlign === 'left' ? x + paddingX : textAlign === 'right' ? x + width - paddingX : cx;

  const isSinglePlain =
    verticalAlign === 'middle' &&
    formattedLines.length === 1 &&
    !formattedLines[0].isBullet &&
    !formattedLines[0].isNumbered &&
    formattedLines[0].spans.length === 1 &&
    !formattedLines[0].spans[0].bold &&
    !formattedLines[0].spans[0].italic &&
    !formattedLines[0].spans[0].underline &&
    !formattedLines[0].spans[0].strikethrough;

  return (
    <text
      x={textX}
      y={isSinglePlain ? cy : startY}
      textAnchor={textAnchor}
      dominantBaseline={isSinglePlain ? 'middle' : 'auto'}
      fill={textStyle?.textColor || defaultColor}
      fontSize={fontSize}
      fontWeight={textStyle?.fontWeight || defaultFontWeight}
      fontStyle={textStyle?.fontStyle || 'normal'}
      className="pointer-events-none select-none font-sans"
    >
      {formattedLines.map((line, lineIdx) => {
        const lineIndentOffset = line.indent * 12;
        const lineX = textAnchor === 'start' ? textX + lineIndentOffset : textX;
        const prefix = line.isBullet ? '• ' : line.isNumbered ? `${line.numberPrefix} ` : '';

        return (
          <React.Fragment key={lineIdx}>
            {line.spans.map((span, spanIdx) => {
              const spanText = (spanIdx === 0 ? prefix : '') + span.text;
              const textDec =
                span.underline && span.strikethrough
                  ? 'underline line-through'
                  : span.underline
                  ? 'underline'
                  : span.strikethrough
                  ? 'line-through'
                  : undefined;

              return (
                <tspan
                  key={spanIdx}
                  {...(spanIdx === 0 ? { x: lineX, dy: lineIdx === 0 ? 0 : lineHeight } : {})}
                  fontWeight={span.bold ? 'bold' : undefined}
                  fontStyle={span.italic ? 'italic' : undefined}
                  textDecoration={textDec}
                >
                  {spanText || (spanIdx === 0 ? ' ' : '')}
                </tspan>
              );
            })}
          </React.Fragment>
        );
      })}
    </text>
  );
};

export const InfiniteCanvas: React.FC = () => {
  const containerRef = useRef<SVGSVGElement>(null);
  const lastClickRef = useRef<{ id: string; time: number; x: number; y: number }>({
    id: '',
    time: 0,
    x: 0,
    y: 0,
  });
  const [dragMode, setDragMode] = useState<DragMode>({ type: 'idle' });
  const [transientObjects, setTransientObjectsState] = useState<Record<string, BoardObject>>({});
  const transientObjectsRef = useRef<Record<string, BoardObject>>({});
  const [hoveredShapeId, setHoveredShapeId] = useState<string | null>(null);

  const [creationPreview, setCreationPreview] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [marqueeBox, setMarqueeBox] = useState<{
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  } | null>(null);

  const [activeSnapGuides, setActiveSnapGuides] = useState<SnapLine[]>([]);
  const [editingLane, setEditingLane] = useState<{ swimlaneId: string; laneId: string } | null>(null);
  const [hoveredDivider, setHoveredDivider] = useState<{ swimlaneId: string; dividerId: string } | null>(null);

  const {
    tool,
    activeShapeKind,
    activeStickyColor,
    activeRouting,
    activeArrowheadType,
    setActiveArrowheadType,
    activeDrawingColor,
    activeDrawingWidth,
    addDrawing,
    viewport,
    selectedIds,
    isSpacePressed,
    editingTextId,
    navigationMode,
    documentStore,
    boardVersion,
    setViewport,
    panBy,
    zoomAt,
    selectObject,
    toggleSelectId,
    setSelectedIds,
    selectAll,
    updateObject,
    addShape,
    addSticky,
    addText,
    addFrame,
    addSwimlane,
    addSwimlaneLane,
    removeSwimlaneLane,
    updateSwimlaneLane,
    updateSwimlaneTitle,
    setSwimlaneOrientation,
    resizeSwimlaneLane,
    resizeSwimlaneHeader,
    addConnector,
    quickCreateConnectedNode,
    deleteSelected,
    duplicateSelected,
    copySelected,
    pasteSelected,
    bringForward,
    sendBackward,
    undo,
    redo,
    setTool,
    setIsSpacePressed,
    setEditingTextId,
    addImage,
    toggleLockSelected,
    groupSelected,
    ungroupSelected,
  } = useCanvasStore();

  const viewportRef = useRef(viewport);
  const targetViewportRef = useRef<ViewportTransform>({ ...viewport });
  const smoothRafRef = useRef<number | null>(null);
  const isZoomingRef = useRef(false);
  const zoomAnchorRef = useRef<{ screen: Point; world: Point } | null>(null);
  const cachedContainerRectRef = useRef<DOMRect | null>(null);

  useEffect(() => {
    viewportRef.current = viewport;
    if (!smoothRafRef.current) {
      targetViewportRef.current = { ...viewport };
    }
  }, [viewport]);

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        cachedContainerRectRef.current = containerRef.current.getBoundingClientRect();
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const panRafRef = useRef<number | null>(null);
  const latestPanPosRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const [isAltPressed, setIsAltPressed] = useState(false);
  const isPhysicalCtrlPressed = useRef(false);

  // Smooth scroll animation frame loop (exponential easing & display sync)
  const startSmoothAnimation = useCallback(
    (isTrackpad: boolean) => {
      if (smoothRafRef.current) return;

      const tick = () => {
        const current = viewportRef.current;
        const target = targetViewportRef.current;

        const panSpeed = isTrackpad ? 0.38 : 0.22;
        const zoomSpeed = isTrackpad ? 0.35 : 0.20;

        let nextZoom = current.zoom + (target.zoom - current.zoom) * zoomSpeed;
        let nextX: number;
        let nextY: number;

        if (isZoomingRef.current && zoomAnchorRef.current) {
          const { screen, world } = zoomAnchorRef.current;
          nextX = screen.x - world.x * nextZoom;
          nextY = screen.y - world.y * nextZoom;
        } else {
          nextX = current.x + (target.x - current.x) * panSpeed;
          nextY = current.y + (target.y - current.y) * panSpeed;
        }

        const diffX = Math.abs(target.x - nextX);
        const diffY = Math.abs(target.y - nextY);
        const diffZoom = Math.abs(target.zoom - nextZoom);

        if (diffX < 0.25 && diffY < 0.25 && diffZoom < 0.0005) {
          setViewport({ ...target });
          smoothRafRef.current = null;
          isZoomingRef.current = false;
          zoomAnchorRef.current = null;
        } else {
          setViewport({
            x: nextX,
            y: nextY,
            zoom: nextZoom,
          });
          smoothRafRef.current = requestAnimationFrame(tick);
        }
      };

      smoothRafRef.current = requestAnimationFrame(tick);
    },
    [setViewport]
  );

  useEffect(() => {
    return () => {
      if (panRafRef.current) {
        cancelAnimationFrame(panRafRef.current);
      }
      if (smoothRafRef.current) {
        cancelAnimationFrame(smoothRafRef.current);
      }
    };
  }, []);

  const baseBoardState = documentStore.getState();
  const boardState = useMemo(() => {
    if (Object.keys(transientObjects).length === 0) return baseBoardState;
    return {
      ...baseBoardState,
      objects: {
        ...baseBoardState.objects,
        ...transientObjects,
      },
    };
  }, [baseBoardState, boardVersion, transientObjects]);

  const setTransientObjects = useCallback((nextObjects: Record<string, BoardObject>) => {
    transientObjectsRef.current = nextObjects;
    setTransientObjectsState(nextObjects);
  }, []);

  const clearTransientObjects = useCallback(() => {
    transientObjectsRef.current = {};
    setTransientObjectsState({});
  }, []);

  const selectedObjects = selectedIds
    .map((id) => boardState.objects[id])
    .filter(Boolean);

  const connectors = boardState.order
    .map((id) => boardState.objects[id])
    .filter((o): o is ConnectorObject => Boolean(o && o.type === 'connector'));

  const boardObstacles: Box[] = useMemo(() => {
    const list: Box[] = [];
    for (const obj of Object.values(boardState.objects)) {
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
  }, [boardState.objects, boardVersion]);

  const editingRaw = editingTextId ? boardState.objects[editingTextId] : null;
  const editingObject = useMemo(() => {
    if (!editingRaw) return null;
    if (editingRaw.type === 'connector') {
      const fromAnchor = resolveEndpointAnchor(editingRaw.from, boardState.objects, 'right');
      const toAnchor = resolveEndpointAnchor(editingRaw.to, boardState.objects, 'left');
      let labelPos = { x: 0, y: 0 };
      if (fromAnchor && toAnchor) {
        const route = calculateConnectorRoute(
          fromAnchor,
          toAnchor,
          editingRaw.routing || 'orthogonal',
          editingRaw.waypoints || [],
          false,
          undefined,
          boardObstacles
        );
        labelPos = route.labelPosition;
      }
      return {
        ...editingRaw,
        x: labelPos.x - 70,
        y: labelPos.y - 18,
        width: 140,
        height: 36,
        text: editingRaw.label || '',
      };
    }
    return editingRaw as any;
  }, [editingRaw, boardState.objects, boardObstacles]);

  const gridParams = getAdaptiveGridParams(viewport.zoom);

  const initialEditingObjRef = useRef<BoardObject | null>(null);

  useEffect(() => {
    if (editingTextId) {
      const obj = documentStore.getState().objects[editingTextId];
      initialEditingObjRef.current = obj ? JSON.parse(JSON.stringify(obj)) : null;
    }
  }, [editingTextId, documentStore]);

  const commitEditingText = useCallback(() => {
    if (!editingTextId) return;
    const currentId = editingTextId;
    const targetObj = documentStore.getState().objects[currentId];
    const prevObj = initialEditingObjRef.current;
    if (targetObj && prevObj && prevObj.id === currentId) {
      if (JSON.stringify(prevObj) !== JSON.stringify(targetObj)) {
        const cmd = new UpdateObjectsCommand(documentStore, [prevObj], [targetObj]);
        documentStore.executeCommand(cmd);
      }
    }
    setEditingTextId(null);
  }, [editingTextId, documentStore, setEditingTextId]);


  // Wheel listener: Adaptive kinetic smooth navigation for Trackpad & Mouse
  // Trackpad Rules:
  // - 2-finger scroll: smoothly adjusts scrollbar/pans in all directions
  // - Pinch (or Ctrl+pinch): smoothly zooms centered at cursor
  // - Shift + 2-finger scroll: horizontal scroll
  // Mouse Rules:
  // - scroll up/down: smooth exponential zoom centered at cursor
  // - shift + scroll up/down: smooth horizontal pan left / right
  // - ctrl + scroll up/down: smooth vertical pan up / down
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      let rect = cachedContainerRectRef.current;
      if (!rect || rect.width === 0) {
        rect = el.getBoundingClientRect();
        cachedContainerRectRef.current = rect;
      }

      const screenAnchor = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };

      const isPinch = (e.ctrlKey || e.metaKey) && !isPhysicalCtrlPressed.current;

      // Determine if current event is trackpad gesture
      let isTrackpad = false;
      if (navigationMode === 'trackpad') {
        isTrackpad = true;
      } else if (navigationMode === 'mouse') {
        isTrackpad = false;
      } else {
        // Auto mode detection:
        if (isPinch) {
          isTrackpad = true;
        } else if (e.deltaX !== 0 && !e.shiftKey) {
          isTrackpad = true;
        } else if (e.deltaY % 1 !== 0 || e.deltaX % 1 !== 0) {
          isTrackpad = true;
        } else if (Math.abs(e.deltaY) < 45 && e.deltaY !== 0) {
          isTrackpad = true;
        } else {
          isTrackpad = false;
        }
      }

      const target = targetViewportRef.current;

      if (isTrackpad) {
        // Trackpad Navigation Rules
        if (isPinch) {
          const zoomDelta = -e.deltaY * 0.01;
          const zoomFactor = Math.exp(zoomDelta);
          const newZoom = clampZoom(target.zoom * zoomFactor, 0.1, 5.0);
          const worldAnchor = screenToWorld(screenAnchor, target);

          zoomAnchorRef.current = { screen: screenAnchor, world: worldAnchor };
          isZoomingRef.current = true;

          target.zoom = newZoom;
          target.x = screenAnchor.x - worldAnchor.x * newZoom;
          target.y = screenAnchor.y - worldAnchor.y * newZoom;

          startSmoothAnimation(true);
        } else if (e.shiftKey) {
          const delta = e.deltaY !== 0 ? e.deltaY : e.deltaX;
          isZoomingRef.current = false;
          target.x += -delta;
          startSmoothAnimation(true);
        } else if (e.ctrlKey || e.metaKey) {
          // Physical Ctrl pressed with trackpad: zoom
          const zoomDelta = -e.deltaY * 0.01;
          const zoomFactor = Math.exp(zoomDelta);
          const newZoom = clampZoom(target.zoom * zoomFactor, 0.1, 5.0);
          const worldAnchor = screenToWorld(screenAnchor, target);

          zoomAnchorRef.current = { screen: screenAnchor, world: worldAnchor };
          isZoomingRef.current = true;

          target.zoom = newZoom;
          target.x = screenAnchor.x - worldAnchor.x * newZoom;
          target.y = screenAnchor.y - worldAnchor.y * newZoom;

          startSmoothAnimation(true);
        } else {
          // Continuous 2-finger scroll adjusts scrollbar & viewport
          isZoomingRef.current = false;
          target.x += -e.deltaX;
          target.y += -e.deltaY;
          startSmoothAnimation(true);
        }
      } else {
        // Mouse Navigation Rules:
        if (e.shiftKey) {
          // Shift + scroll up = scroll left, Shift + scroll down = scroll right
          const delta = e.deltaY !== 0 ? e.deltaY : e.deltaX;
          isZoomingRef.current = false;
          target.x += -delta;
          startSmoothAnimation(false);
        } else if (e.ctrlKey || e.metaKey) {
          // Ctrl + scroll up = scroll up, Ctrl + scroll down = scroll down
          isZoomingRef.current = false;
          target.y += -e.deltaY;
          startSmoothAnimation(false);
        } else if (e.deltaY !== 0) {
          // Scroll up = zoom in, Scroll down = zoom out (centered at cursor)
          const zoomDelta = -e.deltaY * 0.0016;
          const zoomFactor = Math.exp(zoomDelta);
          const newZoom = clampZoom(target.zoom * zoomFactor, 0.1, 5.0);
          const worldAnchor = screenToWorld(screenAnchor, target);

          zoomAnchorRef.current = { screen: screenAnchor, world: worldAnchor };
          isZoomingRef.current = true;

          target.zoom = newZoom;
          target.x = screenAnchor.x - worldAnchor.x * newZoom;
          target.y = screenAnchor.y - worldAnchor.y * newZoom;

          startSmoothAnimation(false);
        } else if (e.deltaX !== 0) {
          isZoomingRef.current = false;
          target.x += -e.deltaX;
          startSmoothAnimation(false);
        }
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [navigationMode, startSmoothAnimation]);

  // Global Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.key === 'Alt') {
        setIsAltPressed(true);
      } else if (e.key === 'Control') {
        isPhysicalCtrlPressed.current = true;
      }

      if (e.code === 'Space' && !e.repeat) {
        setIsSpacePressed(true);
      } else if (e.key === 'v' || e.key === 'V') {
        setTool('select');
      } else if (e.key === 'h' || e.key === 'H') {
        setTool('hand');
      } else if (e.key === 'r' || e.key === 'R') {
        setTool('shape');
      } else if (e.key === 'n' || e.key === 'N') {
        setTool('sticky');
      } else if (e.key === 't' || e.key === 'T') {
        setTool('text');
      } else if (e.key === 'f' || e.key === 'F') {
        setTool('frame');
      } else if (!e.ctrlKey && !e.metaKey && (e.key === 'p' || e.key === 'P')) {
        setTool(e.shiftKey ? 'highlighter' : 'pen');
      } else if (!e.ctrlKey && !e.metaKey && (e.key === 's' || e.key === 'S')) {
        setTool('swimlane');
      } else if (e.key === 'c' || e.key === 'C' || (!e.ctrlKey && !e.metaKey && (e.key === 'a' || e.key === 'A'))) {
        setActiveArrowheadType('arrow');
        setTool('connector');
      } else if (!e.ctrlKey && !e.metaKey && (e.key === 'l' || e.key === 'L')) {
        setActiveArrowheadType('none');
        setTool('connector');
      } else if (e.key === 'e' || e.key === 'E') {
        setTool('eraser');
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault();
        toggleLockSelected();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'g' || e.key === 'G')) {
        e.preventDefault();
        if (e.shiftKey) {
          ungroupSelected();
        } else {
          groupSelected();
        }
      } else if (e.key === 'Tab') {
        e.preventDefault();
        if (selectedIds.length === 1) {
          quickCreateConnectedNode(selectedIds[0], 'right');
        }
      } else if (e.key === 'Enter' || e.key === 'F2') {
        e.preventDefault();
        if (selectedIds.length === 1) {
          setEditingTextId(selectedIds[0]);
        }
      }
 else if (e.key === 'Delete' || e.key === 'Backspace') {
        deleteSelected();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        selectAll();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault();
        copySelected();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        pasteSelected();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        duplicateSelected();
      } else if ((e.ctrlKey || e.metaKey) && e.key === ']') {
        e.preventDefault();
        bringForward();
      } else if ((e.ctrlKey || e.metaKey) && e.key === '[') {
        e.preventDefault();
        sendBackward();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        redo();
      }
    };


    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      } else if (e.key === 'Alt') {
        setIsAltPressed(false);
      } else if (e.key === 'Control') {
        isPhysicalCtrlPressed.current = false;
      }
    };

    const handleBlur = () => {
      setIsSpacePressed(false);
      setIsAltPressed(false);
      isPhysicalCtrlPressed.current = false;
    };

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
              const src = event.target?.result as string;
              if (!src) return;
              const img = new Image();
              img.onload = () => {
                let w = img.naturalWidth || 300;
                let h = img.naturalHeight || 200;
                const maxDim = 450;
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
          }
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('paste', handlePaste);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('paste', handlePaste);
      window.removeEventListener('blur', handleBlur);
    };
  }, [
    selectedIds,
    setIsSpacePressed,
    setTool,
    quickCreateConnectedNode,
    deleteSelected,
    selectAll,
    copySelected,
    pasteSelected,
    duplicateSelected,
    bringForward,
    sendBackward,
    undo,
    redo,
    toggleLockSelected,
    groupSelected,
    ungroupSelected,
    addImage,
    viewport,
  ]);

  const getScreenCoords = useCallback((e: React.PointerEvent | React.MouseEvent): Point => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }, []);

  const eraseAt = useCallback(
    (point: Point) => {
      const state = documentStore.getState();
      const eraserRadius = 18 / viewport.zoom;
      const toDeleteIds: string[] = [];

      for (const id of state.order) {
        const obj = state.objects[id];
        if (!obj || obj.isLocked) continue;

        if (obj.type === 'drawing') {
          let hit = false;
          for (let i = 0; i < obj.points.length; i++) {
            const p = obj.points[i];
            if (Math.hypot(p.x - point.x, p.y - point.y) <= eraserRadius + (obj.strokeWidth || 3) / 2) {
              hit = true;
              break;
            }
          }
          if (hit) {
            toDeleteIds.push(obj.id);
          }
        }
      }

      if (toDeleteIds.length === 0) {
        const hitId = documentStore.getSpatialIndex().hitTest(point, state.objects, state.order);
        if (hitId && !state.objects[hitId]?.isLocked) {
          toDeleteIds.push(hitId);
        }
      }

      if (toDeleteIds.length > 0) {
        const cmd = new DeleteObjectsCommand(documentStore, toDeleteIds);
        documentStore.executeCommand(cmd);
      }
    },
    [documentStore, viewport.zoom]
  );

  const getNearbyConnectableIds = (point: Point, radius: number): string[] => {
    const candidateIds = new Set(
      documentStore.getSpatialIndex().search({
        minX: point.x - radius,
        minY: point.y - radius,
        maxX: point.x + radius,
        maxY: point.y + radius,
      })
    );

    // Preserve z-order while limiting expensive anchor calculations to nearby objects.
    const nearbyIds: string[] = [];
    for (let i = boardState.order.length - 1; i >= 0; i--) {
      const id = boardState.order[i];
      if (candidateIds.has(id) && isConnectableObject(boardState.objects[id])) {
        nearbyIds.push(id);
      }
    }
    return nearbyIds;
  };

  // Pointer Down
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.button !== 1 && e.button !== 2) return;

    if (smoothRafRef.current) {
      cancelAnimationFrame(smoothRafRef.current);
      smoothRafRef.current = null;
      targetViewportRef.current = { ...viewportRef.current };
      isZoomingRef.current = false;
      zoomAnchorRef.current = null;
    }

    const screenPos = getScreenCoords(e);
    const worldPos = screenToWorld(screenPos, viewport);

    // Hit test objects upfront
    const hitId = documentStore
      .getSpatialIndex()
      .hitTest(worldPos, boardState.objects, boardState.order);
    const hitObj = hitId ? boardState.objects[hitId] : null;

    // Pan via right button (2), middle button (1), Space key, 'hand' tool, or Alt+click on canvas/locked object
    const isPanTrigger =
      e.button === 2 ||
      e.button === 1 ||
      isSpacePressed ||
      tool === 'hand' ||
      (e.altKey && (!hitId || hitObj?.isLocked));

    if (isPanTrigger) {
      if (editingTextId) {
        commitEditingText();
      }
      try {
        containerRef.current?.setPointerCapture?.(e.pointerId);
      } catch {
        // ignore
      }
      setDragMode({
        type: 'pan',
        startScreen: screenPos,
        startClientX: e.clientX,
        startClientY: e.clientY,
        initialViewport: { x: viewport.x, y: viewport.y },
      });
      return;
    }

    // Eraser Tool
    if (tool === 'eraser') {
      eraseAt(worldPos);
      setDragMode({
        type: 'erase',
        lastWorld: worldPos,
      });
      return;
    }

    // Freehand drawing via Pen or Highlighter
    if (tool === 'pen' || tool === 'highlighter') {
      setDragMode({
        type: 'draw',
        points: [worldPos],
        isHighlighter: tool === 'highlighter',
      });
      return;
    }

    // Creating new shape/sticky/text/frame/swimlane
    if (tool === 'shape' || tool === 'sticky' || tool === 'text' || tool === 'frame' || tool === 'swimlane') {
      const snappedStart = snapPointToGrid(worldPos, 10);
      setDragMode({
        type: 'create',
        startWorld: snappedStart,
      });
      setCreationPreview({
        x: snappedStart.x,
        y: snappedStart.y,
        width: 10,
        height: 10,
      });
      return;
    }

    if (hitId && hitObj) {
      // If connector tool is active, start dragging connector from this shape's nearest anchor (or free point if not connectable)
      if (tool === 'connector') {
        try {
          containerRef.current?.setPointerCapture?.(e.pointerId);
        } catch {
          // ignore
        }
        if (hitObj && isConnectableObject(hitObj)) {
          const snap = getNearestAnchor(worldPos, hitObj as any, 50 / viewport.zoom) || getShapeAnchors(hitObj as any).right;
          setDragMode({
            type: 'connector',
            sourceId: hitId,
            sourceAnchor: snap.side,
            startWorld: snap.pos,
            currentWorld: worldPos,
            targetSnap: null,
          });
        } else {
          setDragMode({
            type: 'connector',
            sourceId: null,
            sourceAnchor: 'right',
            startWorld: worldPos,
            currentWorld: worldPos,
            targetSnap: null,
          });
        }
        return;
      }

      // Check double-click on shape/object!
      const now = Date.now();
      const dist = Math.hypot(screenPos.x - lastClickRef.current.x, screenPos.y - lastClickRef.current.y);
      const isDouble =
        (e.detail && e.detail >= 2) ||
        (lastClickRef.current.id === hitId &&
          now - lastClickRef.current.time < 500 &&
          dist < 25);

      lastClickRef.current = { id: hitId, time: now, x: screenPos.x, y: screenPos.y };

      if (isDouble) {
        if (!hitObj.isLocked) {
          if (hitObj.type === 'swimlane') {
            const layout = getSwimlaneLayout(hitObj as SwimlaneObject);
            if (
              worldPos.x >= layout.headerBar.x &&
              worldPos.x <= layout.headerBar.x + layout.headerBar.width &&
              worldPos.y >= layout.headerBar.y &&
              worldPos.y <= layout.headerBar.y + layout.headerBar.height
            ) {
              setEditingTextId(hitId);
            } else {
              const clickedLane = layout.lanes.find(
                (l) =>
                  worldPos.x >= l.headerBounds.x &&
                  worldPos.x <= l.headerBounds.x + l.headerBounds.width &&
                  worldPos.y >= l.headerBounds.y &&
                  worldPos.y <= l.headerBounds.y + l.headerBounds.height
              );
              if (clickedLane) {
                setEditingLane({ swimlaneId: hitObj.id, laneId: clickedLane.id });
              }
            }
          } else {
            setEditingTextId(hitId);
          }
        }
        setDragMode({ type: 'idle' });
        return;
      }

      if (editingTextId && editingTextId !== hitId) {
        commitEditingText();
      }

      // Grouping: selecting a grouped object selects all its group members
      if (e.shiftKey) {
        toggleSelectId(hitId);
      } else if (!selectedIds.includes(hitId)) {
        if (hitObj.groupId) {
          const groupMembers = Object.values(boardState.objects)
            .filter((o) => o.groupId === hitObj.groupId)
            .map((o) => o.id);
          setSelectedIds(groupMembers);
        } else {
          selectObject(hitId);
        }
      }

      // If object is locked, allow selecting it, but do not drag it
      if (hitObj.isLocked) {
        setDragMode({ type: 'idle' });
        return;
      }

      // Prepare multi-object movement
      const candidateIds = e.shiftKey
        ? selectedIds.includes(hitId)
          ? selectedIds
          : [...selectedIds, hitId]
        : selectedIds.includes(hitId)
        ? selectedIds
        : hitObj.groupId
        ? Object.values(boardState.objects).filter((o) => o.groupId === hitObj.groupId).map((o) => o.id)
        : [hitId];

      const movingIds = new Set<string>();
      for (const id of candidateIds) {
        const obj = boardState.objects[id];
        if (!obj || obj.isLocked) continue;
        movingIds.add(id);

        // Frame & Swimlane containment: moving a container moves all objects inside it
        if (obj.type === 'frame' || obj.type === 'swimlane') {
          const container = obj as FrameObject | SwimlaneObject;
          for (const other of Object.values(boardState.objects)) {
            if (other.id === container.id || other.type === 'connector' || other.isLocked) continue;
            if (other.frameId === container.id) {
              movingIds.add(other.id);
            } else if ('x' in other && 'y' in other && 'width' in other && 'height' in other) {
              const isContained =
                other.x >= container.x &&
                other.y >= container.y &&
                other.x + other.width <= container.x + container.width &&
                other.y + other.height <= container.y + container.height;
              if (isContained) {
                movingIds.add(other.id);
              }
            }
          }
        }
      }

      if (movingIds.size === 0) return;

      const initialPositions: Record<string, Point> = {};
      for (const id of movingIds) {
        const obj = boardState.objects[id];
        if (obj && 'x' in obj && 'y' in obj) {
          initialPositions[id] = { x: obj.x, y: obj.y };
        }
      }

      setDragMode({
        type: 'move',
        startWorld: worldPos,
        startScreen: screenPos,
        initialPositions,
        isAltDuplicate: Boolean(e.altKey),
        hasDuplicated: false,
      });
    } else {
      lastClickRef.current = { id: '', time: 0, x: 0, y: 0 };
      if (editingTextId) {
        commitEditingText();
      }
      // Clicked on canvas empty space
      if (!e.shiftKey) {
        selectObject(null);
      }

      // If connector tool is active, start standalone line / arrow drag across empty canvas
      if (tool === 'connector') {
        try {
          containerRef.current?.setPointerCapture?.(e.pointerId);
        } catch {
          // ignore
        }
        setDragMode({
          type: 'connector',
          sourceId: null,
          sourceAnchor: 'right',
          startWorld: worldPos,
          currentWorld: worldPos,
          targetSnap: null,
        });
        return;
      }

      // Start Marquee Selection
      setDragMode({
        type: 'marquee',
        startWorld: worldPos,
      });
      setMarqueeBox({
        minX: worldPos.x,
        minY: worldPos.y,
        maxX: worldPos.x,
        maxY: worldPos.y,
      });
    }
  };

  // Pointer Move
  const handlePointerMove = (e: React.PointerEvent) => {
    const screenPos = getScreenCoords(e);
    const worldPos = screenToWorld(screenPos, viewport);

    // Track hovered shape when idle
    if (dragMode.type === 'idle') {
      let hitId = documentStore
        .getSpatialIndex()
        .hitTest(worldPos, boardState.objects, boardState.order);

      // If nothing directly hit, but we were previously hovering a shape, check if cursor is still
      // near that shape's bounds or anchors (tolerance margin so anchor dots and '+' buttons don't flicker)
      if (!hitId && hoveredShapeId) {
        const prevHovered = boardState.objects[hoveredShapeId];
        if (
          prevHovered &&
          'x' in prevHovered &&
          'y' in prevHovered &&
          'width' in prevHovered &&
          'height' in prevHovered
        ) {
          const margin = 36 / viewport.zoom;
          const inExpanded =
            worldPos.x >= prevHovered.x - margin &&
            worldPos.x <= prevHovered.x + prevHovered.width + margin &&
            worldPos.y >= prevHovered.y - margin &&
            worldPos.y <= prevHovered.y + prevHovered.height + margin;

          if (inExpanded) {
            hitId = hoveredShapeId;
          }
        }
      }

      setHoveredShapeId(hitId);
      return;
    }

    switch (dragMode.type) {
      case 'pan': {
        const startX = dragMode.startClientX ?? dragMode.startScreen.x;
        const startY = dragMode.startClientY ?? dragMode.startScreen.y;
        const initVp = dragMode.initialViewport;

        latestPanPosRef.current = { clientX: e.clientX, clientY: e.clientY };

        if (!panRafRef.current) {
          panRafRef.current = requestAnimationFrame(() => {
            panRafRef.current = null;
            if (!latestPanPosRef.current) return;
            const dx = latestPanPosRef.current.clientX - startX;
            const dy = latestPanPosRef.current.clientY - startY;
            setViewport({
              ...viewportRef.current,
              x: Math.round(initVp.x + dx),
              y: Math.round(initVp.y + dy),
            });
          });
        }
        break;
      }

      case 'move': {
        if (dragMode.startScreen) {
          const screenDx = screenPos.x - dragMode.startScreen.x;
          const screenDy = screenPos.y - dragMode.startScreen.y;
          if (Math.hypot(screenDx, screenDy) < 4) {
            // Under 4px jitter: don't move objects yet so double-clicks remain responsive
            break;
          }
        }

        // Lazy Alt-Duplicate: smoothly clone shapes once dragging starts without jumping
        if (dragMode.isAltDuplicate && !dragMode.hasDuplicated) {
          const state = documentStore.getState();
          const clonedObjs: BoardObject[] = [];
          const newSelectedIds: string[] = [];
          const newInitialPositions: Record<string, Point> = {};

          for (const [origId, initPos] of Object.entries(dragMode.initialPositions)) {
            const orig = state.objects[origId];
            if (!orig) continue;
            const newId = `${orig.type}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            const cloned = JSON.parse(JSON.stringify(orig)) as BoardObject;
            cloned.id = newId;
            clonedObjs.push(cloned);
            newSelectedIds.push(newId);
            newInitialPositions[newId] = { x: initPos.x, y: initPos.y };
          }

          if (clonedObjs.length > 0) {
            const cmd = new AddObjectsCommand(documentStore, clonedObjs);
            documentStore.executeCommand(cmd);
            setSelectedIds(newSelectedIds);
            dragMode.initialPositions = newInitialPositions;
            dragMode.hasDuplicated = true;
          }
        }

        let dx = worldPos.x - dragMode.startWorld.x;
        let dy = worldPos.y - dragMode.startWorld.y;

        // Dynamic Smart Alignment Snap Guides
        const movingKeys = Object.keys(dragMode.initialPositions);
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        for (const [id, initPos] of Object.entries(dragMode.initialPositions)) {
          const targetObj = boardState.objects[id];
          if (targetObj && 'width' in targetObj && 'height' in targetObj) {
            const rawX = initPos.x + dx;
            const rawY = initPos.y + dy;
            minX = Math.min(minX, rawX);
            minY = Math.min(minY, rawY);
            maxX = Math.max(maxX, rawX + targetObj.width);
            maxY = Math.max(maxY, rawY + targetObj.height);
          }
        }

        if (minX !== Infinity && !e.altKey) {
          const candidates = Object.values(boardState.objects).filter(
            (o): o is BoardObject & { x: number; y: number; width: number; height: number } =>
              Boolean(
                o &&
                !movingKeys.includes(o.id) &&
                o.type !== 'connector' &&
                'x' in o &&
                'y' in o &&
                'width' in o &&
                'height' in o
              )
          );

          const snapThreshold = 8 / viewport.zoom;
          const snapResult = calculateSnapGuides(
            { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
            candidates,
            snapThreshold
          );

          dx += snapResult.dx;
          dy += snapResult.dy;
          setActiveSnapGuides(snapResult.guides);
        } else {
          setActiveSnapGuides([]);
        }

        const nextTransientObjects: Record<string, BoardObject> = {};
        for (const [id, initPos] of Object.entries(dragMode.initialPositions)) {
          const targetObj = boardState.objects[id];
          if (targetObj && 'x' in targetObj && 'y' in targetObj) {
            nextTransientObjects[id] = {
              ...targetObj,
              x: Math.round(initPos.x + dx),
              y: Math.round(initPos.y + dy),
            } as BoardObject;
          }
        }
        setTransientObjects(nextTransientObjects);
        break;
      }

      case 'resize-swimlane-divider': {
        const sw = dragMode.initialSwimlane;
        const isHorizontal = (sw.orientation || 'horizontal') === 'horizontal';
        const layout = getSwimlaneLayout(sw);

        if (dragMode.dividerType === 'pool-header') {
          const dy = worldPos.y - dragMode.startWorld.y;
          const initialHeaderH = sw.headerSize ?? 34;
          const newHeaderH = Math.max(24, Math.min(100, Math.round(initialHeaderH + dy)));
          const diff = newHeaderH - initialHeaderH;
          updateObject(
            {
              ...sw,
              headerSize: newHeaderH,
              height: Math.max(100, Math.round(sw.height + diff)),
            },
            false
          );
        } else if (dragMode.dividerType === 'lane-header-col') {
          if (isHorizontal) {
            const dx = worldPos.x - dragMode.startWorld.x;
            const initialColW = sw.headerColSize ?? 130;
            const newColW = Math.max(60, Math.min(350, Math.round(initialColW + dx)));
            updateObject(
              {
                ...sw,
                headerColSize: newColW,
              },
              false
            );
          } else {
            const dy = worldPos.y - dragMode.startWorld.y;
            const initialColH = sw.headerColSize ?? 32;
            const newColH = Math.max(24, Math.min(100, Math.round(initialColH + dy)));
            updateObject(
              {
                ...sw,
                headerColSize: newColH,
              },
              false
            );
          }
        } else if (dragMode.dividerType === 'lane' && dragMode.laneIndex !== undefined) {
          const idx = dragMode.laneIndex;
          if (isHorizontal) {
            const dy = worldPos.y - dragMode.startWorld.y;
            const targetLaneLayout = layout.lanes[idx];
            const oldLaneH = targetLaneLayout.height;
            const newLaneH = Math.max(36, Math.round(oldLaneH + dy));
            const diff = newLaneH - oldLaneH;

            const nextLanes = sw.lanes.map((l, i) => {
              const currentComputedH = layout.lanes[i].height;
              if (i === idx) {
                return { ...l, size: newLaneH };
              }
              return { ...l, size: l.size ?? currentComputedH };
            });

            updateObject(
              {
                ...sw,
                height: Math.max(100, Math.round(sw.height + diff)),
                lanes: nextLanes,
              },
              false
            );
          } else {
            const dx = worldPos.x - dragMode.startWorld.x;
            const targetLaneLayout = layout.lanes[idx];
            const oldLaneW = targetLaneLayout.width;
            const newLaneW = Math.max(50, Math.round(oldLaneW + dx));
            const diff = newLaneW - oldLaneW;

            const nextLanes = sw.lanes.map((l, i) => {
              const currentComputedW = layout.lanes[i].width;
              if (i === idx) {
                return { ...l, size: newLaneW };
              }
              return { ...l, size: l.size ?? currentComputedW };
            });

            updateObject(
              {
                ...sw,
                width: Math.max(100, Math.round(sw.width + diff)),
                lanes: nextLanes,
              },
              false
            );
          }
        }
        break;
      }

      case 'resize': {
        const newBounds = calculateResize(
          dragMode.initialShape,
          dragMode.handle,
          worldPos,
          e.shiftKey
        );
        updateObject({
          ...dragMode.initialShape,
          ...newBounds,
        });
        break;
      }

      case 'rotate': {
        const newAngle = calculateRotation(
          dragMode.initialShape,
          worldPos,
          e.shiftKey
        );
        updateObject({
          ...dragMode.initialShape,
          rotation: newAngle,
        });
        break;
      }

      case 'create': {
        let width = Math.max(10, Math.abs(worldPos.x - dragMode.startWorld.x));
        let height = Math.max(10, Math.abs(worldPos.y - dragMode.startWorld.y));

        if (e.shiftKey) {
          const side = Math.max(width, height);
          width = side;
          height = side;
        }

        const minX =
          worldPos.x < dragMode.startWorld.x
            ? dragMode.startWorld.x - width
            : dragMode.startWorld.x;
        const minY =
          worldPos.y < dragMode.startWorld.y
            ? dragMode.startWorld.y - height
            : dragMode.startWorld.y;

        setCreationPreview({ x: minX, y: minY, width, height });
        break;
      }

      case 'marquee': {
        const minX = Math.min(dragMode.startWorld.x, worldPos.x);
        const minY = Math.min(dragMode.startWorld.y, worldPos.y);
        const maxX = Math.max(dragMode.startWorld.x, worldPos.x);
        const maxY = Math.max(dragMode.startWorld.y, worldPos.y);

        setMarqueeBox({ minX, minY, maxX, maxY });
        const foundIds = documentStore.getSpatialIndex().search({ minX, minY, maxX, maxY });
        setSelectedIds(foundIds);
        break;
      }

      case 'connector': {
        let targetSnap: { objectId: string; side: AnchorSide; pos: Point } | null = null;
        let bestDistance = Infinity;

        // 1. Check if hovering inside any connectable object (excluding sourceId)
        const hitId = documentStore
          .getSpatialIndex()
          .hitTest(worldPos, boardState.objects, boardState.order);
        if (hitId && hitId !== dragMode.sourceId && isConnectableObject(boardState.objects[hitId])) {
          const hitObj = boardState.objects[hitId] as ConnectableObject;
          const nearest = getNearestAnchor(
            worldPos,
            hitObj as any,
            Math.max(hitObj.width, hitObj.height) * 2
          );
          if (nearest) {
            targetSnap = { objectId: hitId, side: nearest.side, pos: nearest.pos };
            bestDistance = nearest.distance;
          }
        }

        // 2. Search all connectable objects for nearest anchor within snap distance
        const snapRadius = 55 / viewport.zoom;
        for (const id of getNearbyConnectableIds(worldPos, snapRadius)) {
          if (id === dragMode.sourceId) continue;
          const obj = boardState.objects[id];

          const nearest = getNearestAnchor(worldPos, obj as any, snapRadius);
          if (nearest && nearest.distance < bestDistance) {
            bestDistance = nearest.distance;
            targetSnap = { objectId: id, side: nearest.side, pos: nearest.pos };
          }
        }

        let finalPos = targetSnap ? targetSnap.pos : worldPos;
        const guides: SnapLine[] = [];

        // If not snapped to a shape anchor, snap to keep the connector straight (horizontal, vertical, or 45°)
        if (!targetSnap) {
          const startPt = dragMode.startWorld;
          const snapDist = 14 / viewport.zoom;
          const dx = worldPos.x - startPt.x;
          const dy = worldPos.y - startPt.y;

          if (e.shiftKey) {
            const angle = Math.atan2(dy, dx);
            const snappedAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
            const dist = Math.hypot(dx, dy);
            finalPos = {
              x: Math.round(startPt.x + dist * Math.cos(snappedAngle)),
              y: Math.round(startPt.y + dist * Math.sin(snappedAngle)),
            };
          } else {
            let sx = worldPos.x;
            let sy = worldPos.y;
            if (Math.abs(dy) <= snapDist) {
              sy = startPt.y;
              guides.push({
                orientation: 'horizontal',
                pos: startPt.y,
                start: Math.min(startPt.x, worldPos.x) - 40,
                end: Math.max(startPt.x, worldPos.x) + 40,
              });
            }
            if (Math.abs(dx) <= snapDist) {
              sx = startPt.x;
              guides.push({
                orientation: 'vertical',
                pos: startPt.x,
                start: Math.min(startPt.y, worldPos.y) - 40,
                end: Math.max(startPt.y, worldPos.y) + 40,
              });
            }
            finalPos = { x: Math.round(sx), y: Math.round(sy) };
          }
        }

        setActiveSnapGuides(guides);

        setDragMode({
          ...dragMode,
          currentWorld: finalPos,
          targetSnap,
        });
        break;
      }

      case 'reconnect-endpoint': {
        let targetSnap: { objectId: string; side: AnchorSide; pos: Point } | null = null;
        let bestDistance = Infinity;

        // 1. Check if hovering directly inside any connectable object (allow connecting to every dot on any shape)
        const hitId = documentStore
          .getSpatialIndex()
          .hitTest(worldPos, boardState.objects, boardState.order);
        if (hitId && isConnectableObject(boardState.objects[hitId])) {
          const hitObj = boardState.objects[hitId] as ConnectableObject;
          const nearest = getNearestAnchor(
            worldPos,
            hitObj as any,
            Math.max(hitObj.width, hitObj.height) * 2
          );
          if (nearest) {
            targetSnap = { objectId: hitId, side: nearest.side, pos: nearest.pos };
            bestDistance = nearest.distance;
          }
        }

        // 2. Search all connectable objects for nearest anchor within snap distance
        const snapRadius = 55 / viewport.zoom;
        for (const id of getNearbyConnectableIds(worldPos, snapRadius)) {
          const obj = boardState.objects[id];

          const nearest = getNearestAnchor(worldPos, obj as any, snapRadius);
          if (nearest && nearest.distance < bestDistance) {
            bestDistance = nearest.distance;
            targetSnap = { objectId: id, side: nearest.side, pos: nearest.pos };
          }
        }

        let finalPos = targetSnap ? targetSnap.pos : worldPos;
        const guides: SnapLine[] = [];

        // If not snapped to a shape, snap to keep the connector straight relative to the other endpoint
        if (!targetSnap) {
          const conn = boardState.objects[dragMode.connectorId] as ConnectorObject;
          if (conn) {
            const fixedEndpoint = dragMode.endpoint === 'from' ? conn.to : conn.from;
            const fixedAnchor = resolveEndpointAnchor(fixedEndpoint, boardState.objects, 'right');
            if (fixedAnchor) {
              const snapDist = 14 / viewport.zoom;
              const fixedPt = fixedAnchor.pos;
              const dx = worldPos.x - fixedPt.x;
              const dy = worldPos.y - fixedPt.y;

              if (e.shiftKey) {
                const angle = Math.atan2(dy, dx);
                const snappedAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
                const dist = Math.hypot(dx, dy);
                finalPos = {
                  x: Math.round(fixedPt.x + dist * Math.cos(snappedAngle)),
                  y: Math.round(fixedPt.y + dist * Math.sin(snappedAngle)),
                };
              } else {
                let sx = worldPos.x;
                let sy = worldPos.y;
                if (Math.abs(dy) <= snapDist) {
                  sy = fixedPt.y;
                  guides.push({
                    orientation: 'horizontal',
                    pos: fixedPt.y,
                    start: Math.min(fixedPt.x, worldPos.x) - 40,
                    end: Math.max(fixedPt.x, worldPos.x) + 40,
                  });
                }
                if (Math.abs(dx) <= snapDist) {
                  sx = fixedPt.x;
                  guides.push({
                    orientation: 'vertical',
                    pos: fixedPt.x,
                    start: Math.min(fixedPt.y, worldPos.y) - 40,
                    end: Math.max(fixedPt.y, worldPos.y) + 40,
                  });
                }
                finalPos = { x: Math.round(sx), y: Math.round(sy) };
              }
            }
          }
        }

        setActiveSnapGuides(guides);

        setDragMode({
          ...dragMode,
          currentWorld: finalPos,
          targetSnap,
        });
        break;
      }

      case 'draw': {
        const lastPt = dragMode.points[dragMode.points.length - 1];
        if (Math.hypot(worldPos.x - lastPt.x, worldPos.y - lastPt.y) > 2) {
          setDragMode({
            ...dragMode,
            points: [...dragMode.points, worldPos],
          });
        }
        break;
      }

      case 'move-waypoint': {
        const conn = boardState.objects[dragMode.connectorId] as ConnectorObject;
        if (!conn) break;
        const currentWaypoints = [...(conn.waypoints || [])];
        const idx = dragMode.waypointIndex;

        const fromAnchor = resolveEndpointAnchor(conn.from, boardState.objects, 'right');
        const toAnchor = resolveEndpointAnchor(conn.to, boardState.objects, 'left');
        const p1 = fromAnchor?.pos || { x: 0, y: 0 };
        const p2 = toAnchor?.pos || { x: 0, y: 0 };

        const prevPt: Point = idx > 0 ? currentWaypoints[idx - 1] : p1;
        const nextPt: Point = idx < currentWaypoints.length - 1 ? currentWaypoints[idx + 1] : p2;

        const snapDist = 14 / viewport.zoom;
        let snappedX = worldPos.x;
        let snappedY = worldPos.y;
        const guides: SnapLine[] = [];

        // 1. Collinear snap: only snap onto the direct chord if prevPt and nextPt already share the same axis (strictly straight)
        const isHorizChord = Math.abs(prevPt.y - nextPt.y) <= 2;
        const isVertChord = Math.abs(prevPt.x - nextPt.x) <= 2;

        let isCollinearSnapped = false;
        if (isHorizChord) {
          if (Math.abs(worldPos.y - prevPt.y) <= snapDist) {
            snappedY = prevPt.y;
            isCollinearSnapped = true;
            guides.push({
              orientation: 'horizontal',
              pos: prevPt.y,
              start: Math.min(prevPt.x, nextPt.x) - 40,
              end: Math.max(prevPt.x, nextPt.x) + 40,
            });
          }
        } else if (isVertChord) {
          if (Math.abs(worldPos.x - prevPt.x) <= snapDist) {
            snappedX = prevPt.x;
            isCollinearSnapped = true;
            guides.push({
              orientation: 'vertical',
              pos: prevPt.x,
              start: Math.min(prevPt.y, nextPt.y) - 40,
              end: Math.max(prevPt.y, nextPt.y) + 40,
            });
          }
        }

        // 2. Snap horizontally or vertically to keep individual segments straight
        if (!isCollinearSnapped) {
          // Snap horizontal with prevPt (makes segment prevPt -> W straight horizontal)
          if (Math.abs(worldPos.y - prevPt.y) <= snapDist) {
            snappedY = prevPt.y;
            guides.push({
              orientation: 'horizontal',
              pos: prevPt.y,
              start: Math.min(prevPt.x, worldPos.x) - 40,
              end: Math.max(prevPt.x, worldPos.x) + 40,
            });
          }
          // Snap horizontal with nextPt (makes segment W -> nextPt straight horizontal)
          else if (Math.abs(worldPos.y - nextPt.y) <= snapDist) {
            snappedY = nextPt.y;
            guides.push({
              orientation: 'horizontal',
              pos: nextPt.y,
              start: Math.min(nextPt.x, worldPos.x) - 40,
              end: Math.max(nextPt.x, worldPos.x) + 40,
            });
          }

          // Snap vertical with prevPt (makes segment prevPt -> W straight vertical)
          if (Math.abs(worldPos.x - prevPt.x) <= snapDist) {
            snappedX = prevPt.x;
            guides.push({
              orientation: 'vertical',
              pos: prevPt.x,
              start: Math.min(prevPt.y, worldPos.y) - 40,
              end: Math.max(prevPt.y, worldPos.y) + 40,
            });
          }
          // Snap vertical with nextPt (makes segment W -> nextPt straight vertical)
          else if (Math.abs(worldPos.x - nextPt.x) <= snapDist) {
            snappedX = nextPt.x;
            guides.push({
              orientation: 'vertical',
              pos: nextPt.x,
              start: Math.min(nextPt.y, worldPos.y) - 40,
              end: Math.max(nextPt.y, worldPos.y) + 40,
            });
          }

          // Terminal anchors alignment
          if (Math.abs(worldPos.x - p1.x) <= snapDist && Math.abs(snappedX - p1.x) > 0.1) {
            snappedX = p1.x;
            guides.push({
              orientation: 'vertical',
              pos: p1.x,
              start: Math.min(p1.y, worldPos.y) - 40,
              end: Math.max(p1.y, worldPos.y) + 40,
            });
          }
          if (Math.abs(worldPos.y - p1.y) <= snapDist && Math.abs(snappedY - p1.y) > 0.1) {
            snappedY = p1.y;
            guides.push({
              orientation: 'horizontal',
              pos: p1.y,
              start: Math.min(p1.x, worldPos.x) - 40,
              end: Math.max(p1.x, worldPos.x) + 40,
            });
          }
          if (Math.abs(worldPos.x - p2.x) <= snapDist && Math.abs(snappedX - p2.x) > 0.1) {
            snappedX = p2.x;
            guides.push({
              orientation: 'vertical',
              pos: p2.x,
              start: Math.min(p2.y, worldPos.y) - 40,
              end: Math.max(p2.y, worldPos.y) + 40,
            });
          }
          if (Math.abs(worldPos.y - p2.y) <= snapDist && Math.abs(snappedY - p2.y) > 0.1) {
            snappedY = p2.y;
            guides.push({
              orientation: 'horizontal',
              pos: p2.y,
              start: Math.min(p2.x, worldPos.x) - 40,
              end: Math.max(p2.x, worldPos.x) + 40,
            });
          }

          // Snap with other waypoints on the connector (snap to same line or combine)
          for (let j = 0; j < currentWaypoints.length; j++) {
            if (j === idx) continue;
            const otherWp = currentWaypoints[j];
            // Snap to same horizontal line
            if (Math.abs(worldPos.y - otherWp.y) <= snapDist) {
              snappedY = otherWp.y;
              guides.push({
                orientation: 'horizontal',
                pos: otherWp.y,
                start: Math.min(otherWp.x, worldPos.x) - 40,
                end: Math.max(otherWp.x, worldPos.x) + 40,
              });
            }
            // Snap to same vertical line
            if (Math.abs(worldPos.x - otherWp.x) <= snapDist) {
              snappedX = otherWp.x;
              guides.push({
                orientation: 'vertical',
                pos: otherWp.x,
                start: Math.min(otherWp.y, worldPos.y) - 40,
                end: Math.max(otherWp.y, worldPos.y) + 40,
              });
            }
            // Snap directly to other waypoint to combine them (Rule 3)
            if (Math.hypot(worldPos.x - otherWp.x, worldPos.y - otherWp.y) <= snapDist * 1.8) {
              snappedX = otherWp.x;
              snappedY = otherWp.y;
            }
          }
        }

        // Rule 3: Snap directly to start or end terminal endpoint to absorb and delete the waypoint
        const terminalMergeDist = 28 / viewport.zoom;
        if (Math.hypot(worldPos.x - p1.x, worldPos.y - p1.y) <= terminalMergeDist) {
          snappedX = p1.x;
          snappedY = p1.y;
        } else if (Math.hypot(worldPos.x - p2.x, worldPos.y - p2.y) <= terminalMergeDist) {
          snappedX = p2.x;
          snappedY = p2.y;
        }

        setActiveSnapGuides(guides);

        currentWaypoints[idx] = {
          x: Math.round(snappedX),
          y: Math.round(snappedY),
        };
        updateObject(
          {
            ...conn,
            waypoints: currentWaypoints,
          },
          false
        );
        break;
      }

      case 'erase': {
        eraseAt(worldPos);
        break;
      }
    }
  };

  // Pointer Up
  const handlePointerUp = (e: React.PointerEvent) => {
    const screenPos = getScreenCoords(e);
    const worldPos = screenToWorld(screenPos, viewport);

    if (dragMode.type === 'resize-swimlane-divider') {
      const currentSw = boardState.objects[dragMode.swimlaneId] as SwimlaneObject;
      if (currentSw) {
        const cmd = new UpdateObjectsCommand(documentStore, [dragMode.initialSwimlane], [currentSw]);
        documentStore.executeCommand(cmd);
      }
      setDragMode({ type: 'idle' });
      return;
    }

    if (dragMode.type === 'create' && creationPreview) {
      const isTinyClick = creationPreview.width <= 25 && creationPreview.height <= 25;
      const defaultW =
        activeShapeKind === 'diamond' || activeShapeKind === 'triangle'
          ? 130
          : activeShapeKind === 'cylinder'
          ? 140
          : 180;
      const defaultH =
        activeShapeKind === 'diamond' || activeShapeKind === 'triangle'
          ? 110
          : activeShapeKind === 'cylinder'
          ? 120
          : 90;

      const w = isTinyClick ? defaultW : Math.max(creationPreview.width, 30);
      const h = isTinyClick ? defaultH : Math.max(creationPreview.height, 30);

      if (tool === 'shape') {
        if ((activeShapeKind as any) === 'swimlane') {
          const swW = isTinyClick ? 680 : Math.max(w, 240);
          const swH = isTinyClick ? 360 : Math.max(h, 160);
          addSwimlane(creationPreview.x, creationPreview.y, swW, swH);
        } else {
          addShape(activeShapeKind as any, creationPreview.x, creationPreview.y, w, h);
        }
      } else if (tool === 'swimlane') {
        const swW = isTinyClick ? 680 : Math.max(w, 240);
        const swH = isTinyClick ? 360 : Math.max(h, 160);
        addSwimlane(creationPreview.x, creationPreview.y, swW, swH);
      } else if (tool === 'sticky') {
        const stickySize = isTinyClick ? 140 : Math.max(w, h);
        addSticky(creationPreview.x, creationPreview.y, activeStickyColor, stickySize, stickySize);
      } else if (tool === 'text') {
        addText(creationPreview.x, creationPreview.y);
      } else if (tool === 'frame') {
        const frameW = isTinyClick ? 320 : Math.max(w, 120);
        const frameH = isTinyClick ? 240 : Math.max(h, 120);
        addFrame(creationPreview.x, creationPreview.y, frameW, frameH);
      }

      setCreationPreview(null);
    } else if (dragMode.type === 'connector') {
      let targetId: string | null = null;
      let targetSide: AnchorSide = 'left';

      if (dragMode.targetSnap) {
        targetId = dragMode.targetSnap.objectId;
        targetSide = dragMode.targetSnap.side;
      } else {
        targetId = documentStore
          .getSpatialIndex()
          .hitTest(worldPos, boardState.objects, boardState.order);

        if (!targetId) {
          for (const id of getNearbyConnectableIds(worldPos, 45 / viewport.zoom)) {
            if (id === dragMode.sourceId) continue;
            const obj = boardState.objects[id];
            const nearest = getNearestAnchor(worldPos, obj as any, 45 / viewport.zoom);
            if (nearest) {
              targetId = id;
              targetSide = nearest.side;
              break;
            }
          }
        } else if (targetId && targetId !== dragMode.sourceId) {
          const targetObj = boardState.objects[targetId];
          if (targetObj && isConnectableObject(targetObj)) {
            const nearest = getNearestAnchor(worldPos, targetObj as any, 50 / viewport.zoom);
            if (nearest) targetSide = nearest.side;
          }
        }
      }

      const dist = Math.hypot(worldPos.x - dragMode.startWorld.x, worldPos.y - dragMode.startWorld.y);
      if (dist > 15 || (targetId && targetId !== dragMode.sourceId)) {
        const fromEndpoint: ConnectorEndpoint = dragMode.sourceId
          ? { objectId: dragMode.sourceId, anchor: dragMode.sourceAnchor || 'right' }
          : { x: Math.round(dragMode.startWorld.x), y: Math.round(dragMode.startWorld.y) };

        const toEndpoint: ConnectorEndpoint = targetId && targetId !== dragMode.sourceId
          ? { objectId: targetId, anchor: targetSide }
          : { x: Math.round(worldPos.x), y: Math.round(worldPos.y) };

        const newConnId = addConnector(fromEndpoint, toEndpoint, activeRouting, '', {
          endArrowhead: activeArrowheadType,
        });
        selectObject(newConnId);
      }
    } else if (dragMode.type === 'reconnect-endpoint') {
      const conn = boardState.objects[dragMode.connectorId] as ConnectorObject;
      if (conn) {
        let newEndpoint: ConnectorEndpoint | null = null;
        if (dragMode.targetSnap) {
          newEndpoint = {
            objectId: dragMode.targetSnap.objectId,
            anchor: dragMode.targetSnap.side,
          };
        } else {
          // If cursor was dropped inside a connectable object
          const hitId = documentStore
            .getSpatialIndex()
            .hitTest(worldPos, boardState.objects, boardState.order);
          if (hitId && isConnectableObject(boardState.objects[hitId])) {
            const hitObj = boardState.objects[hitId] as ConnectableObject;
            const nearest = getNearestAnchor(
              worldPos,
              hitObj as any,
              Math.max(hitObj.width, hitObj.height) * 2
            );
            newEndpoint = {
              objectId: hitId,
              anchor: nearest ? nearest.side : 'left',
            };
          } else {
            // Check snap radius across all objects
            let nearestAny: { objectId: string; side: AnchorSide } | null = null;
            let minD = 55 / viewport.zoom;
            for (const id of getNearbyConnectableIds(worldPos, minD)) {
              const obj = boardState.objects[id];
              const n = getNearestAnchor(worldPos, obj as any, minD);
              if (n && n.distance < minD) {
                minD = n.distance;
                nearestAny = { objectId: id, side: n.side };
              }
            }
            if (nearestAny) {
              newEndpoint = { objectId: nearestAny.objectId, anchor: nearestAny.side };
            } else {
              newEndpoint = { x: worldPos.x, y: worldPos.y };
            }
          }
        }

        if (newEndpoint) {
          const updated: ConnectorObject = {
            ...conn,
            waypoints: [],
            [dragMode.endpoint]: newEndpoint,
          };
          updateObject(updated, true);
        }
      }
    } else if (dragMode.type === 'draw') {
      if (dragMode.points.length > 1) {
        addDrawing(
          dragMode.points,
          dragMode.isHighlighter ? '#facc15' : activeDrawingColor,
          activeDrawingWidth,
          dragMode.isHighlighter
        );
      }
    } else if (dragMode.type === 'erase') {
      setDragMode({ type: 'idle' });
      return;
    } else if (dragMode.type === 'move') {
      const state = documentStore.getState();
      const transient = transientObjectsRef.current;
      const frames = Object.values(state.objects).filter((o): o is FrameObject => o.type === 'frame');
      const prevObjs: BoardObject[] = [];
      const nextObjs: BoardObject[] = [];

      for (const [id, initPos] of Object.entries(dragMode.initialPositions)) {
        const curObj = transient[id] || state.objects[id];
        if (!curObj || !('x' in curObj && 'y' in curObj)) continue;
        const hasMoved = curObj.x !== initPos.x || curObj.y !== initPos.y;

        const prev = JSON.parse(JSON.stringify(curObj));
        prev.x = initPos.x;
        prev.y = initPos.y;

        const updated = { ...curObj };
        if (curObj.type !== 'frame' && 'width' in curObj && 'height' in curObj) {
          const cx = curObj.x + curObj.width / 2;
          const cy = curObj.y + curObj.height / 2;
          const containingFrame = frames.find(
            (f) => cx >= f.x && cx <= f.x + f.width && cy >= f.y && cy <= f.y + f.height
          );
          if (containingFrame) {
            updated.frameId = containingFrame.id;
          } else if (updated.frameId) {
            delete updated.frameId;
          }
        }

        if (hasMoved || updated.frameId !== curObj.frameId) {
          prevObjs.push(prev);
          nextObjs.push(updated);
        }
      }

      if (nextObjs.length > 0) {
        const cmd = new UpdateObjectsCommand(documentStore, prevObjs, nextObjs);
        documentStore.executeCommand(cmd);
      }
      clearTransientObjects();
    } else if (dragMode.type === 'move-waypoint') {
      const finalConn = boardState.objects[dragMode.connectorId] as ConnectorObject;
      if (finalConn) {
        const fromAnchor = resolveEndpointAnchor(finalConn.from, boardState.objects, 'right');
        const toAnchor = resolveEndpointAnchor(finalConn.to, boardState.objects, 'left');
        const p1 = fromAnchor?.pos || { x: 0, y: 0 };
        const p2 = toAnchor?.pos || { x: 0, y: 0 };

        // Automatically combine parallel anchors on the same line or redundant collinear points
        const combinedWps = combineParallelAnchors(finalConn.waypoints || [], p1, p2);
        const updatedConn: ConnectorObject = {
          ...finalConn,
          waypoints: combinedWps.length > 0 ? combinedWps : undefined,
        };

        if (JSON.stringify(dragMode.initialConnector) !== JSON.stringify(updatedConn)) {
          updateObject(updatedConn, false);
          const cmd = new UpdateObjectsCommand(documentStore, [dragMode.initialConnector], [updatedConn]);
          documentStore.executeCommand(cmd);
        }
      }
    }

    if (panRafRef.current) {
      cancelAnimationFrame(panRafRef.current);
      panRafRef.current = null;
    }
    latestPanPosRef.current = null;

    try {
      if ((e as any).pointerId && containerRef.current?.hasPointerCapture?.((e as any).pointerId)) {
        containerRef.current?.releasePointerCapture?.((e as any).pointerId);
      }
    } catch {
      // ignore
    }

    setMarqueeBox(null);
    setActiveSnapGuides([]);
    setDragMode({ type: 'idle' });
  };

  // Double Click for Inline Text Editing
  const handleDoubleClick = (e: React.MouseEvent) => {
    const screenPos = getScreenCoords(e);
    const worldPos = screenToWorld(screenPos, viewport);

    const hitId = documentStore
      .getSpatialIndex()
      .hitTest(worldPos, boardState.objects, boardState.order);

    if (hitId) {
      setEditingTextId(hitId);
    }

  };


  // Start connector drag from ShapeAnchorsOverlay dot
  const handleStartConnectorDrag = (
    e: React.PointerEvent,
    sourceId: string,
    anchor: AnchorSide
  ) => {
    const screenPos = getScreenCoords(e);
    const worldPos = screenToWorld(screenPos, viewport);
    const sourceObj = boardState.objects[sourceId];
    if (!sourceObj || !('x' in sourceObj)) return;

    const sourceAnchorPoint = getShapeAnchors(sourceObj as any)[anchor];

    setDragMode({
      type: 'connector',
      sourceId,
      sourceAnchor: anchor,
      startWorld: sourceAnchorPoint.pos,
      currentWorld: worldPos,
      targetSnap: null,
    });
  };

  // Handle pointer down on connector endpoint handle to reconnect
  const handleConnectorEndpointPointerDown = (
    e: React.PointerEvent,
    connectorId: string,
    endpoint: 'from' | 'to'
  ) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    try {
      containerRef.current?.setPointerCapture?.(e.pointerId);
    } catch {
      // ignore
    }
    const screenPos = getScreenCoords(e);
    const worldPos = screenToWorld(screenPos, viewport);

    setDragMode({
      type: 'reconnect-endpoint',
      connectorId,
      endpoint,
      currentWorld: worldPos,
      targetSnap: null,
    });
  };

  // Handle dragging an existing waypoint anchor
  const handleWaypointPointerDown = (
    e: React.PointerEvent,
    connectorId: string,
    waypointIndex: number
  ) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const conn = boardState.objects[connectorId] as ConnectorObject;
    if (!conn) return;
    try {
      containerRef.current?.setPointerCapture?.(e.pointerId);
    } catch {
      // ignore
    }
    setDragMode({
      type: 'move-waypoint',
      connectorId,
      waypointIndex,
      initialConnector: JSON.parse(JSON.stringify(conn)),
    });
  };

  // Handle clicking & dragging the midpoint to create and move a new anchor
  const handleAddWaypointPointerDown = (
    e: React.PointerEvent,
    connectorId: string,
    point: Point,
    insertIndex: number = 0
  ) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const conn = boardState.objects[connectorId] as ConnectorObject;
    if (!conn) return;
    try {
      containerRef.current?.setPointerCapture?.(e.pointerId);
    } catch {
      // ignore
    }
    const currentWaypoints = [...(conn.waypoints || [])];
    currentWaypoints.splice(insertIndex, 0, point);
    const updatedConn: ConnectorObject = {
      ...conn,
      waypoints: currentWaypoints,
    };
    updateObject(updatedConn, false);
    setDragMode({
      type: 'move-waypoint',
      connectorId,
      waypointIndex: insertIndex,
      initialConnector: JSON.parse(JSON.stringify(conn)),
    });
  };

  // Handle double-clicking an existing waypoint to remove it
  const handleRemoveWaypoint = (
    e: React.MouseEvent,
    connectorId: string,
    waypointIndex: number
  ) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const conn = boardState.objects[connectorId] as ConnectorObject;
    if (!conn || !conn.waypoints) return;
    const currentWaypoints = conn.waypoints.filter((_, idx) => idx !== waypointIndex);
    const updatedConn: ConnectorObject = {
      ...conn,
      waypoints: currentWaypoints.length > 0 ? currentWaypoints : undefined,
    };
    const cmd = new UpdateObjectsCommand(documentStore, [conn], [updatedConn]);
    documentStore.executeCommand(cmd);
  };

  // Handle pointer down on Selection Overlay handles
  const handleSelectionHandlePointerDown = (
    e: React.PointerEvent,
    handleType: ResizeHandleType
  ) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    if (selectedObjects.length === 0) return;

    const primary = selectedObjects[0];
    if (primary.isLocked) return;

    if (handleType === 'rotate') {
      setDragMode({
        type: 'rotate',
        initialShape: { ...primary },
      });
    } else {
      setDragMode({
        type: 'resize',
        handle: handleType,
        initialShape: { ...primary },
      });
    }
  };

  const getCanvasCursor = () => {
    if (dragMode.type === 'pan') return 'grabbing';
    if (isSpacePressed || tool === 'hand') return 'grab';
    if (isAltPressed && dragMode.type === 'idle') {
      return hoveredShapeId ? 'copy' : 'grab';
    }
    if (tool === 'pen' || tool === 'highlighter' || tool === 'eraser') return 'crosshair';
    if (tool === 'shape' || tool === 'sticky' || tool === 'text' || tool === 'frame' || tool === 'connector')
      return 'crosshair';
    if (dragMode.type === 'move') return 'move';
    return 'default';
  };

  // Selected connector, if a single connector is currently selected
  const selectedConnector =
    selectedIds.length === 1 && boardState.objects[selectedIds[0]]?.type === 'connector'
      ? (boardState.objects[selectedIds[0]] as ConnectorObject)
      : null;

  // Resolve anchor coordinates for selected connector endpoints
  const resolveAnchor = (
    endpoint: { objectId: string; anchor: AnchorSide } | { x: number; y: number },
    defaultSide: AnchorSide = 'right'
  ): AnchorPoint | null => {
    if ('objectId' in endpoint) {
      const obj = boardState.objects[endpoint.objectId];
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

  const selectedConnectorFromAnchor = selectedConnector
    ? resolveAnchor(selectedConnector.from, 'right')
    : null;
  const selectedConnectorToAnchor = selectedConnector
    ? resolveAnchor(selectedConnector.to, 'left')
    : null;

  // Determine active object for anchor overlay (DISABLED whenever a connector is selected so dots don't block the arrow anchor)
  const activeAnchorObject =
    !selectedConnector && hoveredShapeId && isConnectableObject(boardState.objects[hoveredShapeId])
      ? (boardState.objects[hoveredShapeId] as ConnectableObject)
      : !selectedConnector && selectedIds.length === 1 && isConnectableObject(boardState.objects[selectedIds[0]])
      ? (boardState.objects[selectedIds[0]] as ConnectableObject)
      : null;

  // Candidate target object when dragging a connector or reconnecting
  const candidateTargetObject =
    (dragMode.type === 'connector' || dragMode.type === 'reconnect-endpoint') && dragMode.targetSnap
      ? (boardState.objects[dragMode.targetSnap.objectId] as ConnectableObject)
      : null;

  return (
    <div
      className="relative w-full h-full overflow-hidden"
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }}
      onDrop={(e) => {
        e.preventDefault();
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
          for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.type.startsWith('image/')) {
              const screenPos = getScreenCoords(e);
              const worldPos = screenToWorld(screenPos, viewport);
              const reader = new FileReader();
              reader.onload = (event) => {
                const src = event.target?.result as string;
                if (!src) return;
                const img = new Image();
                img.onload = () => {
                  let w = img.naturalWidth || 300;
                  let h = img.naturalHeight || 200;
                  const maxDim = 450;
                  if (w > maxDim || h > maxDim) {
                    const ratio = Math.min(maxDim / w, maxDim / h);
                    w = Math.round(w * ratio);
                    h = Math.round(h * ratio);
                  }
                  addImage(src, Math.round(worldPos.x - w / 2), Math.round(worldPos.y - h / 2), w, h);
                };
                img.src = src;
              };
              reader.readAsDataURL(file);
            }
          }
        }
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <svg
        ref={containerRef}
        className="w-full h-full bg-slate-50 touch-none select-none overflow-hidden"
        style={{ cursor: getCanvasCursor() }}
        onContextMenu={(e) => e.preventDefault()}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleDoubleClick}
      >
      <defs>
        {/* Adaptive Dots Grid Pattern */}
        <pattern
          id="canvas-grid-pattern"
          width={gridParams.step * viewport.zoom}
          height={gridParams.step * viewport.zoom}
          patternUnits="userSpaceOnUse"
          x={viewport.x % (gridParams.step * viewport.zoom)}
          y={viewport.y % (gridParams.step * viewport.zoom)}
        >
          <circle
            cx={1}
            cy={1}
            r={Math.max(1, 1.2 * Math.min(viewport.zoom, 1.5))}
            fill="#94a3b8"
            opacity={gridParams.opacity}
          />
        </pattern>

        {/* Drop shadow filters */}
        <filter id="shape-shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow
            dx="0"
            dy="3"
            stdDeviation="4"
            floodColor="#0f172a"
            floodOpacity="0.08"
          />
        </filter>

        <filter id="sticky-shadow" x="-15%" y="-15%" width="130%" height="130%">
          <feDropShadow
            dx="1"
            dy="4"
            stdDeviation="5"
            floodColor="#0f172a"
            floodOpacity="0.12"
          />
        </filter>
      </defs>

      {/* Infinite Grid Background */}
      <rect
        width="100%"
        height="100%"
        fill="url(#canvas-grid-pattern)"
        className="pointer-events-none"
      />

      {/* World Transform Layer */}
      <g transform={`translate(${viewport.x}, ${viewport.y}) scale(${viewport.zoom})`}>
        {/* 1. Render Board Objects in z-order */}
        {boardState.order.map((id) => {
          const obj = boardState.objects[id];
          if (!obj || obj.type === 'connector') return null;

          const isSelected = selectedIds.includes(id);

          // A. Frame Object
          if (obj.type === 'frame') {
            return (
              <g
                key={obj.id}
                className="transition-opacity"
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setEditingTextId(obj.id);
                }}
              >
                <rect
                  x={obj.x}
                  y={obj.y - 24}
                  width={Math.min(obj.width, 140)}
                  height={24}
                  rx={4}
                  fill="#f1f5f9"
                  stroke="#cbd5e1"
                  strokeWidth={1}
                />
                <text
                  x={obj.x + 8}
                  y={obj.y - 8}
                  fill="#475569"
                  fontSize={11}
                  fontWeight={600}
                  className="font-sans pointer-events-none"
                >
                  {obj.name}
                </text>
                <rect
                  x={obj.x}
                  y={obj.y}
                  width={obj.width}
                  height={obj.height}
                  rx={8}
                  fill="#f8fafc"
                  stroke={isSelected ? '#3b82f6' : '#cbd5e1'}
                  strokeWidth={1.5}
                  strokeDasharray="6 4"
                />
              </g>
            );
          }

          // A2. Swimlane Object
          if (obj.type === 'swimlane') {
            const rot = obj.rotation ?? 0;
            const cx = obj.x + obj.width / 2;
            const cy = obj.y + obj.height / 2;
            const layout = getSwimlaneLayout(obj as SwimlaneObject);
            const isHorizontal = (obj.orientation || 'horizontal') === 'horizontal';
            const radius = obj.style?.cornerRadius ?? 8;
            const fill = obj.style?.fill || '#ffffff';
            const stroke = isSelected ? '#3b82f6' : obj.style?.stroke || '#64748b';
            const strokeW = obj.style?.strokeWidth || 2;
            const clipId = `swimlane-clip-${obj.id}`;

            return (
              <g
                key={obj.id}
                transform={rot !== 0 ? `rotate(${rot} ${cx} ${cy})` : undefined}
                className="transition-opacity"
              >
                <defs>
                  <clipPath id={clipId}>
                    <rect
                      x={obj.x}
                      y={obj.y}
                      width={layout.totalWidth}
                      height={layout.totalHeight}
                      rx={radius}
                      ry={radius}
                    />
                  </clipPath>
                </defs>

                {/* Base Pool Container */}
                <rect
                  x={obj.x}
                  y={obj.y}
                  width={layout.totalWidth}
                  height={layout.totalHeight}
                  rx={radius}
                  ry={radius}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={strokeW}
                  opacity={obj.style?.opacity ?? 1}
                  filter={obj.style?.shadow ? 'url(#shape-shadow)' : undefined}
                />

                {/* Clipped Lanes and Headers Content */}
                <g clipPath={`url(#${clipId})`} opacity={obj.style?.opacity ?? 1}>
                  {/* Pool Title Bar */}
                  <rect
                    x={layout.headerBar.x}
                    y={layout.headerBar.y}
                    width={layout.headerBar.width}
                    height={layout.headerBar.height}
                    fill="#f1f5f9"
                    className="cursor-pointer"
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setEditingTextId(obj.id);
                    }}
                  />
                  <line
                    x1={layout.headerBar.x}
                    y1={layout.headerBar.y + layout.headerBar.height}
                    x2={layout.headerBar.x + layout.headerBar.width}
                    y2={layout.headerBar.y + layout.headerBar.height}
                    stroke="#cbd5e1"
                    strokeWidth={1.5}
                  />
                  <text
                    x={layout.headerBar.x + 14}
                    y={layout.headerBar.y + layout.headerBar.height / 2 + 5}
                    fontSize={13}
                    fontWeight={700}
                    fill="#1e293b"
                    className="font-sans select-none tracking-wide pointer-events-none"
                  >
                    {obj.headerTitle || 'Swimlane Diagram'}
                  </text>

                  {/* Lanes rendering */}
                  {layout.lanes.map((lane) => {
                    const isEven = lane.index % 2 === 0;
                    const isBeingEdited = editingLane?.swimlaneId === obj.id && editingLane?.laneId === lane.id;

                    return (
                      <g key={lane.id}>
                        {/* Lane Body Background */}
                        <rect
                          x={lane.bodyBounds.x}
                          y={lane.bodyBounds.y}
                          width={lane.bodyBounds.width}
                          height={lane.bodyBounds.height}
                          fill={isEven ? '#ffffff' : '#f8fafc'}
                        />

                        {/* Lane Header */}
                        <rect
                          x={lane.headerBounds.x}
                          y={lane.headerBounds.y}
                          width={lane.headerBounds.width}
                          height={lane.headerBounds.height}
                          fill={isEven ? '#f8fafc' : '#f1f5f9'}
                          className="cursor-pointer hover:fill-slate-100 transition-colors"
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            setEditingLane({ swimlaneId: obj.id, laneId: lane.id });
                          }}
                        />

                        {/* Lane Color Accent Strip */}
                        {lane.color && (
                          <rect
                            x={lane.headerBounds.x}
                            y={lane.headerBounds.y}
                            width={isHorizontal ? 4 : lane.headerBounds.width}
                            height={isHorizontal ? lane.headerBounds.height : 3}
                            fill={lane.color}
                          />
                        )}

                        {/* Lane Header Separator Line */}
                        {isHorizontal ? (
                          <line
                            x1={lane.bodyBounds.x}
                            y1={lane.headerBounds.y}
                            x2={lane.bodyBounds.x}
                            y2={lane.headerBounds.y + lane.headerBounds.height}
                            stroke="#cbd5e1"
                            strokeWidth={1.5}
                          />
                        ) : (
                          <line
                            x1={lane.headerBounds.x}
                            y1={lane.bodyBounds.y}
                            x2={lane.headerBounds.x + lane.headerBounds.width}
                            y2={lane.bodyBounds.y}
                            stroke="#cbd5e1"
                            strokeWidth={1.5}
                          />
                        )}

                        {/* Lane Title Text (hidden when editing in DOM overlay) */}
                        {!isBeingEdited && (
                          <text
                            x={lane.headerBounds.x + lane.headerBounds.width / 2}
                            y={lane.headerBounds.y + lane.headerBounds.height / 2 + 4}
                            textAnchor="middle"
                            fontSize={12}
                            fontWeight={600}
                            fill="#475569"
                            className="font-sans select-none pointer-events-none"
                          >
                            {lane.title}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </g>

                {/* Interactive Partial Resizing Dividers */}
                {layout.dividers.map((div) => {
                  const isHovered = hoveredDivider?.swimlaneId === obj.id && hoveredDivider?.dividerId === div.id;
                  const isDraggingThis =
                    dragMode.type === 'resize-swimlane-divider' &&
                    dragMode.swimlaneId === obj.id &&
                    dragMode.dividerId === div.id;
                  const active = isHovered || isDraggingThis;

                  return (
                    <g key={div.id}>
                      {/* Visible divider stroke */}
                      <line
                        x1={div.x1}
                        y1={div.y1}
                        x2={div.x2}
                        y2={div.y2}
                        stroke={active ? '#3b82f6' : '#cbd5e1'}
                        strokeWidth={active ? 2.5 : (div.type === 'lane' ? 1 : 1.5)}
                        strokeDasharray={div.type === 'lane' && !active ? '4 2' : undefined}
                        pointerEvents="none"
                      />
                      {/* Generous hit-testing grab zone */}
                      <line
                        x1={div.x1}
                        y1={div.y1}
                        x2={div.x2}
                        y2={div.y2}
                        stroke="transparent"
                        strokeWidth={12}
                        style={{ cursor: div.orientation === 'horizontal' ? 'row-resize' : 'col-resize' }}
                        onPointerEnter={() => setHoveredDivider({ swimlaneId: obj.id, dividerId: div.id })}
                        onPointerLeave={() => setHoveredDivider(null)}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          setDragMode({
                            type: 'resize-swimlane-divider',
                            swimlaneId: obj.id,
                            dividerId: div.id,
                            dividerType: div.type,
                            laneIndex: div.laneIndex,
                            startScreen: { x: e.clientX, y: e.clientY },
                            startWorld: screenToWorld({ x: e.clientX, y: e.clientY }, viewport),
                            initialSwimlane: JSON.parse(JSON.stringify(obj)),
                          });
                        }}
                      />
                    </g>
                  );
                })}

                {/* On-Canvas "+ Add Lane" Interactive Button when Swimlane is Selected or Hovered */}
                {(isSelected || hoveredShapeId === obj.id) && (
                  <g
                    className="cursor-pointer pointer-events-auto group"
                    style={{ cursor: 'pointer' }}
                    onPointerEnter={() => setHoveredShapeId(obj.id)}
                    onPointerDown={(e) => {
                      if (e.button !== 0) return;
                      e.stopPropagation();
                      e.preventDefault();
                      addSwimlaneLane(obj.id);
                      selectObject(obj.id);
                    }}
                    onPointerUp={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                  >
                    <title>Add another lane to this diagram</title>
                    {isHorizontal ? (
                      <g
                        transform={`translate(${obj.x + Math.max(8, Math.round((layout.headerColSize - 104) / 2))}, ${
                          obj.y + layout.totalHeight + 8
                        })`}
                      >
                        <rect
                          x={0}
                          y={0}
                          width={104}
                          height={28}
                          rx={14}
                          fill="#2563eb"
                          className="group-hover:fill-blue-600 transition-colors shadow-md"
                        />
                        {/* Plus Icon */}
                        <line
                          x1={18}
                          y1={14}
                          x2={28}
                          y2={14}
                          stroke="#ffffff"
                          strokeWidth={2.2}
                          strokeLinecap="round"
                          pointerEvents="none"
                        />
                        <line
                          x1={23}
                          y1={9}
                          x2={23}
                          y2={19}
                          stroke="#ffffff"
                          strokeWidth={2.2}
                          strokeLinecap="round"
                          pointerEvents="none"
                        />
                        <text
                          x={60}
                          y={18}
                          textAnchor="middle"
                          fill="#ffffff"
                          fontSize={11.5}
                          fontWeight={600}
                          className="font-sans select-none pointer-events-none"
                        >
                          Add Lane
                        </text>
                      </g>
                    ) : (
                      <g
                        transform={`translate(${obj.x + layout.totalWidth + 8}, ${
                          obj.y + layout.headerBar.height + Math.max(2, Math.round((layout.headerColSize - 28) / 2))
                        })`}
                      >
                        <rect
                          x={0}
                          y={0}
                          width={104}
                          height={28}
                          rx={14}
                          fill="#2563eb"
                          className="group-hover:fill-blue-600 transition-colors shadow-md"
                        />
                        {/* Plus Icon */}
                        <line
                          x1={18}
                          y1={14}
                          x2={28}
                          y2={14}
                          stroke="#ffffff"
                          strokeWidth={2.2}
                          strokeLinecap="round"
                          pointerEvents="none"
                        />
                        <line
                          x1={23}
                          y1={9}
                          x2={23}
                          y2={19}
                          stroke="#ffffff"
                          strokeWidth={2.2}
                          strokeLinecap="round"
                          pointerEvents="none"
                        />
                        <text
                          x={60}
                          y={18}
                          textAnchor="middle"
                          fill="#ffffff"
                          fontSize={11.5}
                          fontWeight={600}
                          className="font-sans select-none pointer-events-none"
                        >
                          Add Lane
                        </text>
                      </g>
                    )}
                  </g>
                )}
              </g>
            );
          }

          // B. Shape Object (10 Kinds)
          if (obj.type === 'shape') {
            const rot = obj.rotation ?? 0;
            const cx = obj.x + obj.width / 2;
            const cy = obj.y + obj.height / 2;
            const svgData = getShapeSvgData(
              obj.kind,
              obj.x,
              obj.y,
              obj.width,
              obj.height,
              obj.style.cornerRadius
            );

            return (
              <g
                key={obj.id}
                transform={rot !== 0 ? `rotate(${rot} ${cx} ${cy})` : undefined}
                className="transition-opacity"
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setEditingTextId(obj.id);
                }}
              >
                {svgData.type === 'rect' ? (
                  <rect
                    x={obj.x}
                    y={obj.y}
                    width={obj.width}
                    height={obj.height}
                    rx={obj.kind === 'rounded-rectangle' ? (obj.style.cornerRadius ?? 10) : 0}
                    ry={obj.kind === 'rounded-rectangle' ? (obj.style.cornerRadius ?? 10) : 0}
                    fill={obj.style.fill}
                    stroke={isSelected ? '#3b82f6' : obj.style.stroke}
                    strokeWidth={obj.style.strokeWidth}
                    strokeDasharray={
                      obj.style.strokeDash === 'dashed'
                        ? '6 4'
                        : obj.style.strokeDash === 'dotted'
                        ? '2 3'
                        : undefined
                    }
                    opacity={obj.style.opacity}
                    filter={obj.style.shadow ? 'url(#shape-shadow)' : undefined}
                  />
                ) : svgData.type === 'ellipse' ? (
                  <ellipse
                    cx={cx}
                    cy={cy}
                    rx={obj.width / 2}
                    ry={obj.height / 2}
                    fill={obj.style.fill}
                    stroke={isSelected ? '#3b82f6' : obj.style.stroke}
                    strokeWidth={obj.style.strokeWidth}
                    opacity={obj.style.opacity}
                    filter={obj.style.shadow ? 'url(#shape-shadow)' : undefined}
                  />
                ) : (
                  <path
                    d={svgData.pathData}
                    fill={obj.style.fill}
                    stroke={isSelected ? '#3b82f6' : obj.style.stroke}
                    strokeWidth={obj.style.strokeWidth}
                    opacity={obj.style.opacity}
                    filter={obj.style.shadow ? 'url(#shape-shadow)' : undefined}
                  />
                )}

                {/* Text Label */}
                {obj.text && editingTextId !== obj.id && (
                  <RichSvgText
                    text={obj.text}
                    x={obj.x}
                    y={obj.y}
                    width={obj.width}
                    height={obj.height}
                    cx={cx}
                    cy={cy}
                    textStyle={obj.textStyle}
                    defaultFontSize={14}
                    defaultAlign="center"
                    defaultFontWeight={500}
                    defaultColor="#1e293b"
                    paddingX={14}
                    verticalAlign="middle"
                  />
                )}
              </g>
            );
          }

          // C. Sticky Note (Miro Style)
          if (obj.type === 'sticky') {
            const rot = obj.rotation ?? 0;
            const cx = obj.x + obj.width / 2;
            const cy = obj.y + obj.height / 2;
            const colorMeta = STICKY_COLOR_MAP[obj.color] || STICKY_COLOR_MAP.yellow;
            const dogEarSize = 16;

            return (
              <g
                key={obj.id}
                transform={rot !== 0 ? `rotate(${rot} ${cx} ${cy})` : undefined}
                className="transition-opacity"
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setEditingTextId(obj.id);
                }}
              >
                {/* Main Body */}
                <rect
                  x={obj.x}
                  y={obj.y}
                  width={obj.width}
                  height={obj.height}
                  rx={6}
                  fill={colorMeta.bg}
                  stroke={isSelected ? '#3b82f6' : colorMeta.border}
                  strokeWidth={isSelected ? 2 : 1}
                  filter="url(#sticky-shadow)"
                />

                {/* Miro Folded Corner (Dog-Ear on bottom right) */}
                <polygon
                  points={`${obj.x + obj.width - dogEarSize},${obj.y + obj.height} ${obj.x + obj.width},${obj.y + obj.height - dogEarSize} ${obj.x + obj.width - dogEarSize},${obj.y + obj.height - dogEarSize}`}
                  fill="rgba(0,0,0,0.08)"
                />
                <polygon
                  points={`${obj.x + obj.width - dogEarSize},${obj.y + obj.height} ${obj.x + obj.width},${obj.y + obj.height - dogEarSize} ${obj.x + obj.width},${obj.y + obj.height}`}
                  fill="#f8fafc"
                />

                {/* Optional Tag Badge */}
                {obj.tag && (
                  <g transform={`translate(${obj.x + obj.width - 78}, ${obj.y + 8})`}>
                    <rect width={68} height={16} rx={4} fill={colorMeta.border} opacity={0.35} />
                    <text x={34} y={11.5} textAnchor="middle" fill={colorMeta.text} fontSize={9} fontWeight={600} className="font-sans">
                      {obj.tag}
                    </text>
                  </g>
                )}

                {/* Optional Reaction Emoji Bubble */}
                {obj.reaction && (
                  <g transform={`translate(${obj.x + obj.width - 28}, ${obj.y + obj.height - 24})`}>
                    <circle cx={10} cy={10} r={10} fill="#ffffff" stroke={colorMeta.border} strokeWidth={1} />
                    <text x={10} y={14} textAnchor="middle" fontSize={11}>
                      {obj.reaction}
                    </text>
                  </g>
                )}

                {/* Optional Author Tag */}
                {obj.author && (
                  <text
                    x={obj.x + 12}
                    y={obj.y + obj.height - 8}
                    fill={colorMeta.text}
                    fontSize={10}
                    fontWeight={600}
                    opacity={0.65}
                    className="pointer-events-none select-none font-sans"
                  >
                    @{obj.author}
                  </text>
                )}

                {obj.text && editingTextId !== obj.id && (
                  <RichSvgText
                    text={obj.text}
                    x={obj.x}
                    y={obj.y}
                    width={obj.width}
                    height={obj.height}
                    cx={cx}
                    cy={cy}
                    textStyle={obj.textStyle}
                    defaultFontSize={13}
                    defaultAlign="left"
                    defaultFontWeight="normal"
                    defaultColor={colorMeta.text}
                    paddingX={14}
                    verticalAlign="top"
                  />
                )}
              </g>
            );
          }

          // D. Standalone Text Box
          if (obj.type === 'text') {
            const rot = obj.rotation ?? 0;
            const cx = obj.x + obj.width / 2;
            const cy = obj.y + obj.height / 2;

            return (
              <g
                key={obj.id}
                transform={rot !== 0 ? `rotate(${rot} ${cx} ${cy})` : undefined}
                className="transition-opacity"
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setEditingTextId(obj.id);
                }}
              >
                <rect
                  x={obj.x}
                  y={obj.y}
                  width={obj.width}
                  height={obj.height}
                  fill="transparent"
                  stroke={isSelected ? '#3b82f6' : 'transparent'}
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />
                {obj.text && editingTextId !== obj.id && (
                  <RichSvgText
                    text={obj.text}
                    x={obj.x}
                    y={obj.y}
                    width={obj.width}
                    height={obj.height}
                    cx={cx}
                    cy={cy}
                    textStyle={obj.textStyle}
                    defaultFontSize={16}
                    defaultAlign="left"
                    defaultFontWeight="normal"
                    defaultColor="#1e293b"
                    paddingX={6}
                    verticalAlign="middle"
                  />
                )}
              </g>
            );
          }

          // E. Freehand Drawing / Pen / Highlighter
          if (obj.type === 'drawing') {
            const isSelected = selectedIds.includes(obj.id);
            return (
              <g key={obj.id} className="transition-opacity">
                <path
                  d={pointsToSvgPath(obj.points)}
                  stroke={isSelected ? '#3b82f6' : obj.stroke}
                  strokeWidth={obj.strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  opacity={obj.opacity || 1}
                  className="cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    selectObject(obj.id);
                  }}
                />
              </g>
            );
          }

          // F. Image Object
          if (obj.type === 'image') {
            const rot = obj.rotation ?? 0;
            const cx = obj.x + obj.width / 2;
            const cy = obj.y + obj.height / 2;
            return (
              <g
                key={obj.id}
                transform={rot !== 0 ? `rotate(${rot} ${cx} ${cy})` : undefined}
                className="transition-opacity"
              >
                <image
                  href={obj.src}
                  x={obj.x}
                  y={obj.y}
                  width={obj.width}
                  height={obj.height}
                  preserveAspectRatio="none"
                  opacity={obj.style?.opacity ?? 1}
                  className="pointer-events-auto select-none"
                />
              </g>
            );
          }

          return null;
        })}

        {/* 2. Connectors Layer (Rendered on top of shapes so arrows are never covered) */}
        <ConnectorLayer
          connectors={connectors}
          objects={boardState.objects}
          boardVersion={boardVersion}
          selectedIds={selectedIds}
          zoom={viewport.zoom}
          reconnectingConnectorId={dragMode.type === 'reconnect-endpoint' ? dragMode.connectorId : null}
          onSelectConnector={(id, e) => {
            e.stopPropagation();
            selectObject(id);
          }}
          onDoubleClickConnector={(id, e) => {
            e.stopPropagation();
            selectObject(id);
            setEditingTextId(id);
          }}
          onEndpointPointerDown={handleConnectorEndpointPointerDown}
        />

        {/* Live Freehand Drawing Preview */}
        {dragMode.type === 'draw' && dragMode.points.length > 0 && (
          <path
            d={pointsToSvgPath(dragMode.points)}
            stroke={dragMode.isHighlighter ? '#facc15' : activeDrawingColor}
            strokeWidth={dragMode.isHighlighter ? 20 : activeDrawingWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            opacity={dragMode.isHighlighter ? 0.4 : 1}
            className="pointer-events-none"
          />
        )}

        {/* Live Connector Drag Preview */}
        {dragMode.type === 'connector' && (() => {
          const fromNormal =
            dragMode.sourceId && dragMode.sourceAnchor
              ? getSideNormal(dragMode.sourceAnchor)
              : { x: 0, y: 0 };
          const fromAnchor: AnchorPoint = {
            side: dragMode.sourceAnchor || 'right',
            pos: dragMode.startWorld,
            normal: fromNormal,
          };
          const toSide: AnchorSide = dragMode.targetSnap
            ? dragMode.targetSnap.side
            : (dragMode.sourceAnchor === 'right' ? 'left' : dragMode.sourceAnchor === 'left' ? 'right' : dragMode.sourceAnchor === 'top' ? 'bottom' : 'top');
          const toNormal = dragMode.targetSnap
            ? getSideNormal(dragMode.targetSnap.side)
            : { x: 0, y: 0 };
          const toAnchor: AnchorPoint = {
            side: toSide,
            pos: dragMode.currentWorld,
            normal: toNormal,
          };
          const srcObj = dragMode.sourceId ? boardState.objects[dragMode.sourceId] : null;
          const targetObj = dragMode.targetSnap?.objectId ? boardState.objects[dragMode.targetSnap.objectId] : null;
          const previewObstacles = boardObstacles.filter((b) => {
            if (srcObj && 'x' in srcObj && b.minX === srcObj.x && b.minY === srcObj.y) return false;
            if (targetObj && 'x' in targetObj && b.minX === targetObj.x && b.minY === targetObj.y) return false;
            return true;
          });
          const { svgPath } = calculateConnectorRoute(
            fromAnchor,
            toAnchor,
            activeRouting || 'orthogonal',
            [],
            false,
            undefined,
            previewObstacles
          );

          return (
            <path
              d={svgPath}
              fill="none"
              stroke="#3b82f6"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray="5 3"
              markerEnd={
                activeArrowheadType !== 'none'
                  ? `url(#marker-${activeArrowheadType}-end-3b82f6)`
                  : undefined
              }
              className="pointer-events-none"
            />
          );
        })()}

        {/* Live Reconnect Endpoint Preview */}
        {dragMode.type === 'reconnect-endpoint' && (() => {
          const conn = boardState.objects[dragMode.connectorId] as ConnectorObject;
          if (!conn) return null;
          const fixedEndpoint = dragMode.endpoint === 'from' ? conn.to : conn.from;
          let fixedAnchor: AnchorPoint | null = null;
          let fixedObj: BoardObject | null = null;
          if ('objectId' in fixedEndpoint) {
            fixedObj = boardState.objects[fixedEndpoint.objectId];
            if (fixedObj && 'x' in fixedObj) {
              fixedAnchor = getShapeAnchors(fixedObj as any)[fixedEndpoint.anchor];
            }
          } else {
            fixedAnchor = { side: 'right', pos: fixedEndpoint, normal: { x: 0, y: 0 } };
          }
          if (!fixedAnchor) return null;

          const movingSide: AnchorSide = dragMode.targetSnap
            ? dragMode.targetSnap.side
            : (fixedAnchor.side === 'right'
                ? 'left'
                : fixedAnchor.side === 'left'
                ? 'right'
                : fixedAnchor.side === 'top'
                ? 'bottom'
                : 'top');
          const movingNormal = dragMode.targetSnap
            ? getSideNormal(dragMode.targetSnap.side)
            : { x: 0, y: 0 };
          const movingAnchor: AnchorPoint = {
            side: movingSide,
            pos: dragMode.currentWorld,
            normal: movingNormal,
          };

          const from = dragMode.endpoint === 'from' ? movingAnchor : fixedAnchor;
          const to = dragMode.endpoint === 'from' ? fixedAnchor : movingAnchor;
          const targetObj = dragMode.targetSnap?.objectId ? boardState.objects[dragMode.targetSnap.objectId] : null;
          const reconnectObstacles = boardObstacles.filter((b) => {
            if (fixedObj && 'x' in fixedObj && b.minX === fixedObj.x && b.minY === fixedObj.y) return false;
            if (targetObj && 'x' in targetObj && b.minX === targetObj.x && b.minY === targetObj.y) return false;
            return true;
          });
          const { svgPath } = calculateConnectorRoute(
            from,
            to,
            conn.routing || activeRouting || 'orthogonal',
            [],
            false,
            undefined,
            reconnectObstacles
          );

          const strokeColor = conn.style?.stroke || '#3b82f6';
          const colorKey = strokeColor.replace(/[^a-zA-Z0-9]/g, '');

          return (
            <g className="reconnect-preview pointer-events-none">
              <path
                d={svgPath}
                fill="none"
                stroke={strokeColor}
                strokeWidth={(conn.style?.strokeWidth || 2) * 1.25}
                strokeLinejoin="round"
                strokeLinecap="round"
                strokeDasharray="5 3"
                markerEnd={
                  conn.style?.endArrowhead && conn.style.endArrowhead !== 'none'
                    ? `url(#marker-${conn.style.endArrowhead}-end-${colorKey})`
                    : undefined
                }
                markerStart={
                  conn.style?.startArrowhead && conn.style.startArrowhead !== 'none'
                    ? `url(#marker-${conn.style.startArrowhead}-start-${colorKey})`
                    : undefined
                }
              />
              {/* Endpoint drag handle following cursor / snap point */}
              <circle
                cx={dragMode.currentWorld.x}
                cy={dragMode.currentWorld.y}
                r={Math.max(6, 7 / Math.sqrt(viewport.zoom))}
                fill="#ffffff"
                stroke="#3b82f6"
                strokeWidth={2.5 / viewport.zoom}
                className="shadow-md"
              />
            </g>
          );
        })()}

        {/* Render Anchor Overlays */}
        {/* Case A: Reconnecting an arrow or dragging a new connector -> Show anchor dots on ALL connectable shapes */}
        {(dragMode.type === 'reconnect-endpoint' || dragMode.type === 'connector') &&
          boardState.order.map((id) => {
            const obj = boardState.objects[id];
            if (!isConnectableObject(obj)) return null;
            const isSnappedTarget = dragMode.targetSnap?.objectId === id;
            return (
              <ShapeAnchorsOverlay
                key={`snap-preview-${id}`}
                shape={obj as ConnectableObject}
                zoom={viewport.zoom}
                isTargetPreview={true}
                snappedSide={isSnappedTarget ? dragMode.targetSnap?.side : null}
              />
            );
          })}

        {/* Selected Connector Top-Level Draggable Endpoint & Waypoint Handles */}
        {selectedConnector &&
          (dragMode.type === 'idle' || dragMode.type === 'move-waypoint') &&
          selectedConnectorFromAnchor &&
          selectedConnectorToAnchor && (() => {
            const isSelfLoop =
              'objectId' in selectedConnector.from &&
              'objectId' in selectedConnector.to &&
              selectedConnector.from.objectId === selectedConnector.to.objectId;
            const fromObj = 'objectId' in selectedConnector.from ? boardState.objects[selectedConnector.from.objectId] : null;
            const selfBounds =
              isSelfLoop && fromObj && 'x' in fromObj
                ? {
                    minX: fromObj.x,
                    minY: fromObj.y,
                    maxX: fromObj.x + (fromObj as any).width,
                    maxY: fromObj.y + (fromObj as any).height,
                  }
                : undefined;

            const route = calculateConnectorRoute(
              selectedConnectorFromAnchor,
              selectedConnectorToAnchor,
              selectedConnector.routing || 'orthogonal',
              selectedConnector.waypoints || [],
              isSelfLoop,
              selfBounds,
              boardObstacles
            );

            const handleR = Math.max(6, 7 / Math.sqrt(viewport.zoom));
            const wpHandleR = Math.max(5.5, 6.5 / Math.sqrt(viewport.zoom));
            const midHandleR = Math.max(5, 6 / Math.sqrt(viewport.zoom));
            const strokeW = 2.5 / viewport.zoom;

            return (
              <g className="connector-endpoint-handles pointer-events-auto">
                {/* From Endpoint Handle */}
                <g
                  className="cursor-move pointer-events-auto group"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    handleConnectorEndpointPointerDown(e, selectedConnector.id, 'from');
                  }}
                >
                  <title>Drag to reconnect start</title>
                  <circle
                    cx={selectedConnectorFromAnchor.pos.x}
                    cy={selectedConnectorFromAnchor.pos.y}
                    r={handleR * 2.5}
                    fill="transparent"
                  />
                  <circle
                    cx={selectedConnectorFromAnchor.pos.x}
                    cy={selectedConnectorFromAnchor.pos.y}
                    r={handleR * 1.5}
                    fill="#3b82f6"
                    fillOpacity={0.2}
                    className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                  />
                  <circle
                    cx={selectedConnectorFromAnchor.pos.x}
                    cy={selectedConnectorFromAnchor.pos.y}
                    r={handleR}
                    fill="#ffffff"
                    stroke="#3b82f6"
                    strokeWidth={strokeW}
                    className="group-hover:fill-blue-50 group-hover:stroke-blue-600 transition-colors shadow-md pointer-events-none"
                  />
                </g>

                {/* To Endpoint Handle */}
                <g
                  className="cursor-move pointer-events-auto group"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    handleConnectorEndpointPointerDown(e, selectedConnector.id, 'to');
                  }}
                >
                  <title>Drag to reconnect end</title>
                  <circle
                    cx={selectedConnectorToAnchor.pos.x}
                    cy={selectedConnectorToAnchor.pos.y}
                    r={handleR * 2.5}
                    fill="transparent"
                  />
                  <circle
                    cx={selectedConnectorToAnchor.pos.x}
                    cy={selectedConnectorToAnchor.pos.y}
                    r={handleR * 1.5}
                    fill="#3b82f6"
                    fillOpacity={0.2}
                    className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                  />
                  <circle
                    cx={selectedConnectorToAnchor.pos.x}
                    cy={selectedConnectorToAnchor.pos.y}
                    r={handleR}
                    fill="#ffffff"
                    stroke="#3b82f6"
                    strokeWidth={strokeW}
                    className="group-hover:fill-blue-50 group-hover:stroke-blue-600 transition-colors shadow-md pointer-events-none"
                  />
                </g>

                {/* Existing Waypoint Bend Anchors */}
                {selectedConnector.waypoints?.map((wp, idx) => (
                  <g
                    key={`wp-${idx}`}
                    className="cursor-move pointer-events-auto group"
                    onPointerDown={(e) => handleWaypointPointerDown(e, selectedConnector.id, idx)}
                    onDoubleClick={(e) => handleRemoveWaypoint(e, selectedConnector.id, idx)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleRemoveWaypoint(e, selectedConnector.id, idx);
                    }}
                  >
                    <title>Drag to move anchor • Double-click or Right-click to remove</title>
                    <circle
                      cx={wp.x}
                      cy={wp.y}
                      r={wpHandleR * 2.5}
                      fill="transparent"
                    />
                    <circle
                      cx={wp.x}
                      cy={wp.y}
                      r={wpHandleR * 1.5}
                      fill="#3b82f6"
                      fillOpacity={0.25}
                      className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                    />
                    <circle
                      cx={wp.x}
                      cy={wp.y}
                      r={wpHandleR}
                      fill="#3b82f6"
                      stroke="#ffffff"
                      strokeWidth={strokeW}
                      className="group-hover:fill-blue-700 transition-colors shadow-md pointer-events-none"
                    />
                    <circle
                      cx={wp.x}
                      cy={wp.y}
                      r={2 / viewport.zoom}
                      fill="#ffffff"
                      className="pointer-events-none"
                    />
                  </g>
                ))}

                {/* Multi-Segment Midpoint Bend Handles (Add new anchor by dragging middle of any segment) */}
                {dragMode.type === 'idle' && (() => {
                  const pts: Point[] =
                    route.points && route.points.length >= 2
                      ? route.points
                      : [selectedConnectorFromAnchor.pos, selectedConnectorToAnchor.pos];

                  // Helper: find cumulative distance of a point projected along polyline
                  const getDistAlongPolyline = (target: Point, polyline: Point[]): number => {
                    let bestDistOnPoly = 0;
                    let minPerpDist = Infinity;
                    let cumulative = 0;
                    for (let s = 0; s < polyline.length - 1; s++) {
                      const a = polyline[s];
                      const b = polyline[s + 1];
                      const dx = b.x - a.x;
                      const dy = b.y - a.y;
                      const lenSq = dx * dx + dy * dy;
                      const segLen = Math.sqrt(lenSq);
                      if (segLen < 1e-6) continue;
                      const t = Math.max(0, Math.min(1, ((target.x - a.x) * dx + (target.y - a.y) * dy) / lenSq));
                      const projX = a.x + t * dx;
                      const projY = a.y + t * dy;
                      const perpDist = Math.hypot(target.x - projX, target.y - projY);
                      if (perpDist < minPerpDist) {
                        minPerpDist = perpDist;
                        bestDistOnPoly = cumulative + t * segLen;
                      }
                      cumulative += segLen;
                    }
                    return bestDistOnPoly;
                  };

                  const existingWpDistances = (selectedConnector.waypoints || []).map((wp) =>
                    getDistAlongPolyline(wp, pts)
                  );

                  let cumulativeDistance = 0;
                  const segments: Array<{ midpoint: Point; insertIndex: number; key: string }> = [];

                  for (let i = 0; i < pts.length - 1; i++) {
                    const v1 = pts[i];
                    const v2 = pts[i + 1];
                    const segLen = Math.hypot(v2.x - v1.x, v2.y - v1.y);
                    const midDist = cumulativeDistance + 0.5 * segLen;
                    cumulativeDistance += segLen;

                    // Skip tiny segments (< 36px on screen)
                    if (segLen < 36 / viewport.zoom) continue;

                    const mx = (v1.x + v2.x) / 2;
                    const my = (v1.y + v2.y) / 2;

                    // Ensure midpoint is NOT inside any shape obstacle
                    const isInsideObstacle = boardObstacles.some(
                      (obs) =>
                        mx >= obs.minX - 1 &&
                        mx <= obs.maxX + 1 &&
                        my >= obs.minY - 1 &&
                        my <= obs.maxY + 1
                    );
                    if (isInsideObstacle) continue;

                    // Do not show midpoint handle if too close to terminals or existing waypoints
                    const minClearance = 24 / viewport.zoom;
                    if (
                      Math.hypot(mx - selectedConnectorFromAnchor.pos.x, my - selectedConnectorFromAnchor.pos.y) < minClearance ||
                      Math.hypot(mx - selectedConnectorToAnchor.pos.x, my - selectedConnectorToAnchor.pos.y) < minClearance
                    ) {
                      continue;
                    }
                    if (
                      (selectedConnector.waypoints || []).some(
                        (wp) => Math.hypot(mx - wp.x, my - wp.y) < minClearance
                      )
                    ) {
                      continue;
                    }

                    // Count how many existing waypoints appear before this midpoint along the route
                    const insertIndex = existingWpDistances.filter((d) => d <= midDist).length;

                    segments.push({
                      midpoint: { x: mx, y: my },
                      insertIndex,
                      key: `mid-${i}-${Math.round(mx)}-${Math.round(my)}`,
                    });
                  }

                  return segments.map((seg) => (
                    <g
                      key={seg.key}
                      className="cursor-grab pointer-events-auto group"
                      onPointerDown={(e) =>
                        handleAddWaypointPointerDown(
                          e,
                          selectedConnector.id,
                          seg.midpoint,
                          seg.insertIndex
                        )
                      }
                    >
                      <title>Drag to add bend anchor</title>
                      <circle
                        cx={seg.midpoint.x}
                        cy={seg.midpoint.y}
                        r={midHandleR * 2.8}
                        fill="transparent"
                      />
                      <circle
                        cx={seg.midpoint.x}
                        cy={seg.midpoint.y}
                        r={midHandleR * 1.6}
                        fill="#3b82f6"
                        fillOpacity={0.2}
                        className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                      />
                      <circle
                        cx={seg.midpoint.x}
                        cy={seg.midpoint.y}
                        r={midHandleR}
                        fill="#ffffff"
                        stroke="#3b82f6"
                        strokeWidth={1.75 / viewport.zoom}
                        strokeDasharray={`${3 / viewport.zoom} ${2 / viewport.zoom}`}
                        className="group-hover:stroke-blue-700 group-hover:fill-blue-50 transition-colors shadow-xs pointer-events-none"
                      />
                      <circle
                        cx={seg.midpoint.x}
                        cy={seg.midpoint.y}
                        r={2.2 / viewport.zoom}
                        fill="#3b82f6"
                        className="group-hover:fill-blue-700 transition-colors pointer-events-none"
                      />
                    </g>
                  ));
                })()}
              </g>
            );
          })()}


        {/* Shape Hover / Selection: ONLY when idle and NO connector is selected */}
        {activeAnchorObject && !editingTextId && dragMode.type === 'idle' && (
          <ShapeAnchorsOverlay
            shape={activeAnchorObject}
            zoom={viewport.zoom}
            onStartConnectorDrag={handleStartConnectorDrag}
          />
        )}

        {/* Real-time Object Creation Preview with Accurate Shape Geometry */}
        {creationPreview && (
          <g className="pointer-events-none animate-in fade-in duration-75">
            {tool === 'swimlane' || (tool === 'shape' && (activeShapeKind as any) === 'swimlane') ? (() => {
              const headerH = 28;
              const laneCount = 3;
              const laneH = Math.max(10, (creationPreview.height - headerH) / laneCount);
              return (
                <g className="pointer-events-none">
                  <rect
                    x={creationPreview.x}
                    y={creationPreview.y}
                    width={creationPreview.width}
                    height={creationPreview.height}
                    rx={8}
                    fill="#ffffff"
                    fillOpacity={0.7}
                    stroke="#3b82f6"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                  />
                  <rect
                    x={creationPreview.x}
                    y={creationPreview.y}
                    width={creationPreview.width}
                    height={headerH}
                    fill="#e2e8f0"
                    fillOpacity={0.7}
                  />
                  {Array.from({ length: laneCount - 1 }).map((_, i) => (
                    <line
                      key={i}
                      x1={creationPreview.x}
                      y1={creationPreview.y + headerH + (i + 1) * laneH}
                      x2={creationPreview.x + creationPreview.width}
                      y2={creationPreview.y + headerH + (i + 1) * laneH}
                      stroke="#94a3b8"
                      strokeWidth={1}
                      strokeDasharray="3 3"
                    />
                  ))}
                </g>
              );
            })() : tool === 'shape' ? (() => {
              const svgData = getShapeSvgData(
                activeShapeKind === 'swimlane' ? 'rectangle' : activeShapeKind,
                creationPreview.x,
                creationPreview.y,
                creationPreview.width,
                creationPreview.height,
                10
              );
              const previewProps = {
                fill: '#ffffff',
                fillOpacity: 0.6,
                stroke: '#3b82f6',
                strokeWidth: 2,
                strokeDasharray: '4 4',
                className: 'pointer-events-none',
              };

              if (svgData.type === 'rect') {
                return (
                  <rect
                    x={creationPreview.x}
                    y={creationPreview.y}
                    width={creationPreview.width}
                    height={creationPreview.height}
                    rx={activeShapeKind === 'rounded-rectangle' ? 10 : 0}
                    ry={activeShapeKind === 'rounded-rectangle' ? 10 : 0}
                    {...previewProps}
                  />
                );
              }
              if (svgData.type === 'ellipse') {
                return (
                  <ellipse
                    cx={creationPreview.x + creationPreview.width / 2}
                    cy={creationPreview.y + creationPreview.height / 2}
                    rx={creationPreview.width / 2}
                    ry={creationPreview.height / 2}
                    {...previewProps}
                  />
                );
              }
              return (
                <path
                  d={svgData.pathData}
                  {...previewProps}
                />
              );
            })() : tool === 'sticky' ? (
              <rect
                x={creationPreview.x}
                y={creationPreview.y}
                width={creationPreview.width}
                height={creationPreview.height}
                rx={6}
                fill={STICKY_COLOR_MAP[activeStickyColor]?.bg || '#fef08a'}
                fillOpacity={0.7}
                stroke="#3b82f6"
                strokeWidth={2}
                strokeDasharray="4 4"
                className="pointer-events-none"
              />
            ) : tool === 'frame' ? (
              <rect
                x={creationPreview.x}
                y={creationPreview.y}
                width={creationPreview.width}
                height={creationPreview.height}
                fill="#f8fafc"
                fillOpacity={0.5}
                stroke="#64748b"
                strokeWidth={2}
                strokeDasharray="4 4"
                className="pointer-events-none"
              />
            ) : (
              <rect
                x={creationPreview.x}
                y={creationPreview.y}
                width={creationPreview.width}
                height={creationPreview.height}
                rx={4}
                fill="#3b82f6"
                fillOpacity={0.08}
                stroke="#3b82f6"
                strokeWidth={1.5}
                strokeDasharray="3 3"
                className="pointer-events-none"
              />
            )}
          </g>
        )}

        {/* Selection Marquee Box */}
        {marqueeBox && (
          <rect
            x={marqueeBox.minX}
            y={marqueeBox.minY}
            width={marqueeBox.maxX - marqueeBox.minX}
            height={marqueeBox.maxY - marqueeBox.minY}
            fill="#3b82f6"
            fillOpacity={0.08}
            stroke="#3b82f6"
            strokeWidth={1 / viewport.zoom}
            className="pointer-events-none"
          />
        )}

        {/* Dynamic Smart Alignment Snap Guides */}
        {activeSnapGuides.length > 0 && (
          <g className="snap-guides pointer-events-none">
            {activeSnapGuides.map((guide, idx) => {
              const isVert = guide.orientation === 'vertical';
              const x1 = isVert ? guide.pos : guide.start;
              const y1 = isVert ? guide.start : guide.pos;
              const x2 = isVert ? guide.pos : guide.end;
              const y2 = isVert ? guide.end : guide.pos;
              const strokeW = 1.25 / viewport.zoom;
              const dotR = 2.5 / viewport.zoom;

              return (
                <g key={`snap-guide-${idx}`}>
                  {/* Underlay glow line for contrast */}
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="#ffffff"
                    strokeWidth={strokeW * 2.5}
                    opacity={0.85}
                  />
                  {/* Vibrant magenta guide line */}
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="#ec4899"
                    strokeWidth={strokeW}
                    strokeDasharray={`${4 / viewport.zoom} ${3 / viewport.zoom}`}
                  />
                  {/* Terminal indicators */}
                  <circle cx={x1} cy={y1} r={dotR} fill="#ec4899" stroke="#ffffff" strokeWidth={0.75 / viewport.zoom} />
                  <circle cx={x2} cy={y2} r={dotR} fill="#ec4899" stroke="#ffffff" strokeWidth={0.75 / viewport.zoom} />
                </g>
              );
            })}
          </g>
        )}

        {/* Selection Overlay (Handles & Bounding Box) */}
        {selectedObjects.length > 0 && !editingTextId && (
          <SelectionOverlay
            objects={selectedObjects}
            zoom={viewport.zoom}
            onHandlePointerDown={handleSelectionHandlePointerDown}
          />
        )}
      </g>
    </svg>

    {/* Absolute HTML Floating Text Editor Overlay */}
    {editingObject && (
      <InlineTextEditor
        object={
          editingObject.type === 'swimlane'
            ? ({
                ...editingObject,
                text: (editingObject as any).headerTitle || 'Swimlane Diagram',
                height: (editingObject as any).headerSize ?? 34,
              } as any)
            : editingObject
        }
        viewport={viewport}
        onChangeText={(newText) => {
          const targetObj = documentStore.getState().objects[editingObject.id];
          if (targetObj) {
            if (targetObj.type === 'frame') {
              updateObject({ ...targetObj, name: newText }, false);
            } else if (targetObj.type === 'connector') {
              updateObject({ ...targetObj, label: newText }, false);
            } else if (targetObj.type === 'swimlane') {
              updateObject({ ...targetObj, headerTitle: newText }, false);
            } else {
              updateObject({ ...targetObj, text: newText } as BoardObject, false);
            }
          }
        }}
        onChangeStyle={(newStyle) => {
          const targetObj = documentStore.getState().objects[editingObject.id];
          if (targetObj && 'textStyle' in targetObj) {
            updateObject(
              {
                ...targetObj,
                textStyle: { ...(targetObj as any).textStyle, ...newStyle },
              } as BoardObject,
              false
            );
          }
        }}
        onFinish={(newText) => {
          const targetObj = documentStore.getState().objects[editingObject.id];
          if (targetObj) {
            if (targetObj.type === 'frame') {
              updateObject({ ...targetObj, name: newText }, false);
            } else if (targetObj.type === 'connector') {
              updateObject({ ...targetObj, label: newText }, false);
            } else if (targetObj.type === 'swimlane') {
              updateObject({ ...targetObj, headerTitle: newText }, false);
            } else {
              updateObject({ ...targetObj, text: newText } as BoardObject, false);
            }
          }
          commitEditingText();
        }}
      />
    )}

    {/* Absolute HTML Floating Lane Title Editor Overlay */}
    {editingLane && (() => {
      const swObj = boardState.objects[editingLane.swimlaneId];
      if (swObj && swObj.type === 'swimlane') {
        const layout = getSwimlaneLayout(swObj as SwimlaneObject);
        const targetLane = layout.lanes.find((l) => l.id === editingLane.laneId);
        if (targetLane) {
          return (
            <InlineLaneTitleEditor
              swimlane={swObj as SwimlaneObject}
              lane={targetLane}
              viewport={viewport}
              onCommit={(newTitle) => {
                updateSwimlaneLane(swObj.id, targetLane.id, { title: newTitle });
                setEditingLane(null);
              }}
              onCancel={() => setEditingLane(null)}
            />
          );
        }
      }
      return null;
    })()}

    {/* Floating In-Context Toolbar for Selected Arrow/Connector (Miro-Grade) */}
    {selectedConnector &&
      dragMode.type === 'idle' &&
      !editingTextId &&
      selectedConnectorFromAnchor &&
      selectedConnectorToAnchor && (() => {
        const isSelfLoop =
          'objectId' in selectedConnector.from &&
          'objectId' in selectedConnector.to &&
          selectedConnector.from.objectId === selectedConnector.to.objectId;
        const fromObj = 'objectId' in selectedConnector.from ? boardState.objects[selectedConnector.from.objectId] : null;
        const selfBounds =
          isSelfLoop && fromObj && 'x' in fromObj
            ? {
                minX: fromObj.x,
                minY: fromObj.y,
                maxX: fromObj.x + (fromObj as any).width,
                maxY: fromObj.y + (fromObj as any).height,
              }
            : undefined;

        const route = calculateConnectorRoute(
          selectedConnectorFromAnchor,
          selectedConnectorToAnchor,
          selectedConnector.routing || 'orthogonal',
          selectedConnector.waypoints || [],
          isSelfLoop,
          selfBounds,
          boardObstacles
        );

        // Gather all geometric points along the connector (route points, user waypoints, anchor endpoints)
        const pts = [
          selectedConnectorFromAnchor.pos,
          selectedConnectorToAnchor.pos,
          ...(selectedConnector.waypoints || []),
          ...(route.points || []),
        ];

        const minX = Math.min(...pts.map((p) => p.x));
        const maxX = Math.max(...pts.map((p) => p.x));
        const minY = Math.min(...pts.map((p) => p.y));
        const maxY = Math.max(...pts.map((p) => p.y));
        const centerX = (minX + maxX) / 2;

        const topCenterScreen = worldToScreen({ x: centerX, y: minY }, viewport);
        const bottomCenterScreen = worldToScreen({ x: centerX, y: maxY }, viewport);

        // Generous clearance (32px) so the toolbar never touches or blocks the line/handles
        const clearancePx = 32;
        const estimatedToolbarHeight = 44;

        // If placing above would collide with top header (y < 70) or go off-screen, place below instead
        const wouldClipTop = topCenterScreen.y - clearancePx - estimatedToolbarHeight < 70;
        const placement: 'top' | 'bottom' = wouldClipTop ? 'bottom' : 'top';

        // Clamp horizontally so toolbar stays completely visible within window
        const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
        const clampedX = Math.max(240, Math.min(screenWidth - 240, topCenterScreen.x));
        const screenPos = {
          x: clampedX,
          y: placement === 'bottom' ? bottomCenterScreen.y + clearancePx : topCenterScreen.y - clearancePx,
        };

        return (
          <FloatingConnectorToolbar
            connector={selectedConnector}
            position={screenPos}
            placement={placement}
            onUpdate={(updates) => {
              const updated = { ...selectedConnector, ...updates };
              const cmd = new UpdateObjectsCommand(documentStore, [selectedConnector], [updated]);
              documentStore.executeCommand(cmd);
            }}
            onEditLabel={() => {
              setEditingTextId(selectedConnector.id);
            }}
            onDelete={() => {
              deleteSelected();
            }}
          />
        );
      })()}

    {/* Floating Interactive Canvas Scrollbars that adjust to trackpad / mouse navigation */}
    <CanvasScrollbars />

  </div>
  );
};
