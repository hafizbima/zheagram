import { create } from 'zustand';
import {
  ViewportTransform,
  BoardObject,
  ShapeObject,
  StickyObject,
  TextObject,
  FrameObject,
  ConnectorObject,
  DrawingObject,
  DrawingPoint,
  ImageObject,
  ConnectorEndpoint,
  RoutingType,
  ArrowheadType,
  AnchorSide,
  ShapeKind,
  StickyColor,
  BaseObjectStyle,
  TextStyle,
  ConnectorStyle,
  SwimlaneObject,
  SwimlaneLane,
} from '@diagrammer/shared';
import {
  DocumentStore,
  zoomAtScreenPoint,
  clampZoom,
  AlignmentType,
  DistributionType,
  calculateAlignment,
  calculateDistribution,
  AddObjectsCommand,
  DeleteObjectsCommand,
  UpdateObjectsCommand,
  ReorderCommand,
  computeDrawingBounds,
  getSwimlaneLayout,
} from '@diagrammer/engine';
import { TEMPLATES } from './templates';

export type CanvasTool =
  | 'select'
  | 'hand'
  | 'shape'
  | 'sticky'
  | 'text'
  | 'frame'
  | 'connector'
  | 'pen'
  | 'highlighter'
  | 'eraser'
  | 'swimlane';

export const STICKY_COLOR_MAP: Record<StickyColor, { bg: string; border: string; text: string }> = {
  yellow: { bg: '#fef08a', border: '#facc15', text: '#713f12' },
  blue: { bg: '#bae6fd', border: '#38bdf8', text: '#0c4a6e' },
  green: { bg: '#bbf7d0', border: '#4ade80', text: '#14532d' },
  pink: { bg: '#fbcfe8', border: '#f472b6', text: '#831843' },
  purple: { bg: '#e9d5ff', border: '#c084fc', text: '#581c87' },
  orange: { bg: '#fed7aa', border: '#fb923c', text: '#7c2d12' },
  gray: { bg: '#f1f5f9', border: '#cbd5e1', text: '#334155' },
  mint: { bg: '#ccfbf1', border: '#5eead4', text: '#115e59' },
  peach: { bg: '#ffedd5', border: '#fdba74', text: '#9a3412' },
};

interface CanvasStoreState {
  tool: CanvasTool;
  activeShapeKind: ShapeKind | 'swimlane';
  activeStickyColor: StickyColor;
  activeRouting: RoutingType;
  activeArrowheadType: ArrowheadType;
  viewport: ViewportTransform;
  selectedIds: string[];
  hoveredShapeId: string | null;
  isSpacePressed: boolean;
  editingTextId: string | null;
  navigationMode: 'auto' | 'trackpad' | 'mouse';
  clipboard: BoardObject[];
  documentStore: DocumentStore;
  boardVersion: number;

  setTool: (tool: CanvasTool) => void;
  setActiveShapeKind: (kind: ShapeKind | 'swimlane') => void;
  setActiveStickyColor: (color: StickyColor) => void;
  setActiveRouting: (routing: RoutingType) => void;
  setActiveArrowheadType: (type: ArrowheadType) => void;
  setViewport: (viewport: ViewportTransform | ((prev: ViewportTransform) => ViewportTransform)) => void;
  setHoveredShapeId: (id: string | null) => void;
  setIsSpacePressed: (pressed: boolean) => void;
  setEditingTextId: (id: string | null) => void;
  setNavigationMode: (mode: 'auto' | 'trackpad' | 'mouse') => void;

  // Selection
  selectObject: (id: string | null) => void;
  toggleSelectId: (id: string) => void;
  setSelectedIds: (ids: string[]) => void;
  selectAll: () => void;

  // Viewport actions
  panBy: (dx: number, dy: number) => void;
  zoomAt: (screenAnchor: { x: number; y: number }, factor: number) => void;
  resetZoom: () => void;
  zoomToFit: (containerWidth: number, containerHeight: number) => void;

  // Object creation
  addShape: (kind: ShapeKind, x: number, y: number, width?: number, height?: number) => string;
  addSticky: (x: number, y: number, color?: StickyColor, width?: number, height?: number) => string;
  addText: (x: number, y: number, text?: string) => string;
  addFrame: (x: number, y: number, width?: number, height?: number, name?: string) => string;
  addSwimlane: (
    x: number,
    y: number,
    width?: number,
    height?: number,
    orientation?: 'horizontal' | 'vertical',
    headerTitle?: string,
    lanes?: SwimlaneLane[]
  ) => string;
  addSwimlaneLane: (swimlaneId: string, title?: string) => void;
  removeSwimlaneLane: (swimlaneId: string, laneId: string) => void;
  updateSwimlaneLane: (swimlaneId: string, laneId: string, patch: Partial<SwimlaneLane>) => void;
  updateSwimlaneTitle: (swimlaneId: string, title: string) => void;
  setSwimlaneOrientation: (swimlaneId: string, orientation: 'horizontal' | 'vertical') => void;
  resizeSwimlaneLane: (swimlaneId: string, laneId: string, newSize: number) => void;
  resizeSwimlaneHeader: (swimlaneId: string, headerSize?: number, headerColSize?: number) => void;
  addConnector: (
    from: ConnectorEndpoint,
    to: ConnectorEndpoint,
    routing?: RoutingType,
    label?: string,
    style?: Partial<ConnectorStyle>
  ) => string;
  addImage: (src: string, x: number, y: number, width?: number, height?: number) => string;

  // Whimsical Fast-Flowchart
  quickCreateConnectedNode: (
    sourceId: string,
    direction: 'right' | 'bottom' | 'left' | 'top'
  ) => string | null;

  // Document actions
  updateObject: (obj: BoardObject, recordHistory?: boolean) => void;
  updateSelectedProperties: (
    stylePatch?: Partial<BaseObjectStyle>,
    textPatch?: Partial<TextStyle>,
    extra?: Record<string, any>
  ) => void;
  updateSelectedConnector: (patch: Partial<ConnectorObject>) => void;
  deleteSelected: () => void;
  duplicateSelected: () => void;
  copySelected: () => void;
  pasteSelected: () => void;
  toggleLockSelected: () => void;
  groupSelected: () => void;
  ungroupSelected: () => void;

  // Alignment & Z-Order
  alignSelected: (type: AlignmentType) => void;
  distributeSelected: (type: DistributionType) => void;
  bringForward: () => void;
  sendBackward: () => void;
  bringToFront: () => void;
  sendToBack: () => void;

  // History
  undo: () => void;
  redo: () => void;

  // Drawing & Pen
  activeDrawingColor: string;
  activeDrawingWidth: number;
  setActiveDrawingColor: (color: string) => void;
  setActiveDrawingWidth: (width: number) => void;
  addDrawing: (
    points: DrawingPoint[],
    stroke?: string,
    strokeWidth?: number,
    isHighlighter?: boolean
  ) => string;

  // Templates
  insertTemplate: (templateKey: string) => void;

  // Board persistence & switching
  loadBoardState: (board: {
    id: string;
    title: string;
    objects: Record<string, BoardObject>;
    order: string[];
  }) => void;

  // Multiplayer Collaborators
  isMultiplayerEnabled: boolean;
  toggleMultiplayer: () => void;
  collaborators: Array<{
    id: string;
    name: string;
    role: string;
    color: string;
    x: number;
    y: number;
    activeObjectId?: string | null;
  }>;
}

const initialDocumentStore = new DocumentStore();

// Seed initial items connected with a smart connector
initialDocumentStore.addObject(
  {
    id: 'demo-rect-1',
    type: 'shape',
    kind: 'rounded-rectangle',
    x: 140,
    y: 180,
    width: 180,
    height: 90,
    rotation: 0,
    text: 'User Login',
    style: {
      fill: '#ffffff',
      stroke: '#3b82f6',
      strokeWidth: 2,
      cornerRadius: 10,
      opacity: 1,
      shadow: true,
    },
    textStyle: {
      fontSize: 14,
      fontWeight: '600',
      textAlign: 'center',
      textColor: '#1e293b',
    },
  },
  false
);

initialDocumentStore.addObject(
  {
    id: 'demo-diamond-1',
    type: 'shape',
    kind: 'diamond',
    x: 440,
    y: 165,
    width: 140,
    height: 120,
    rotation: 0,
    text: 'Password Valid?',
    style: {
      fill: '#f0fdf4',
      stroke: '#22c55e',
      strokeWidth: 2,
      opacity: 1,
      shadow: true,
    },
    textStyle: {
      fontSize: 13,
      fontWeight: '600',
      textAlign: 'center',
      textColor: '#14532d',
    },
  },
  false
);

initialDocumentStore.addObject(
  {
    id: 'demo-rect-2',
    type: 'shape',
    kind: 'rounded-rectangle',
    x: 700,
    y: 180,
    width: 180,
    height: 90,
    rotation: 0,
    text: 'Access Dashboard',
    style: {
      fill: '#ffffff',
      stroke: '#3b82f6',
      strokeWidth: 2,
      cornerRadius: 10,
      opacity: 1,
      shadow: true,
    },
    textStyle: {
      fontSize: 14,
      fontWeight: '600',
      textAlign: 'center',
      textColor: '#1e293b',
    },
  },
  false
);

initialDocumentStore.addObject(

  {
    id: 'demo-sticky-1',
    type: 'sticky',
    x: 180,
    y: 340,

    width: 150,
    height: 150,
    rotation: -1,
    color: 'yellow',
    text: 'Sticky Note:\nDouble click or press Enter to edit me!',
    author: 'Sarah K.',
    textStyle: {
      fontSize: 13,
      fontWeight: 'normal',
      textAlign: 'left',
      textColor: '#854d0e',
    },
  },
  false
);

// Initial Connectors

initialDocumentStore.addObject(
  {
    id: 'conn-1',
    type: 'connector',
    from: { objectId: 'demo-rect-1', anchor: 'right' },
    to: { objectId: 'demo-diamond-1', anchor: 'left' },
    routing: 'orthogonal',
    style: {
      stroke: '#64748b',
      strokeWidth: 2,
      strokeDash: 'solid',
      endArrowhead: 'arrow',
    },
  },
  false
);

initialDocumentStore.addObject(
  {
    id: 'conn-2',
    type: 'connector',
    from: { objectId: 'demo-diamond-1', anchor: 'right' },
    to: { objectId: 'demo-rect-2', anchor: 'left' },
    routing: 'orthogonal',
    label: 'Yes',
    style: {
      stroke: '#22c55e',
      strokeWidth: 2,
      strokeDash: 'solid',
      endArrowhead: 'arrow',
    },
  },
  false
);

export const useCanvasStore = create<CanvasStoreState>((set, get) => {
  initialDocumentStore.subscribe(() => {
    set((state) => ({ boardVersion: state.boardVersion + 1 }));
  });

  return {
    tool: 'select',
    activeShapeKind: 'rounded-rectangle',
    activeStickyColor: 'yellow',
    activeRouting: 'orthogonal',
    activeArrowheadType: 'arrow',
    viewport: { x: 0, y: 0, zoom: 1 },
    selectedIds: ['demo-rect-1'],
    hoveredShapeId: null,
    isSpacePressed: false,
    editingTextId: null,
    navigationMode: 'auto',
    clipboard: [],
    documentStore: initialDocumentStore,
    boardVersion: 0,

    setTool: (tool) => set({ tool }),
    setActiveShapeKind: (activeShapeKind) => set({ activeShapeKind, tool: 'shape' }),
    setActiveStickyColor: (activeStickyColor) => set({ activeStickyColor, tool: 'sticky' }),
    setActiveRouting: (activeRouting) => set({ activeRouting }),
    setActiveArrowheadType: (activeArrowheadType) => set({ activeArrowheadType }),
    setViewport: (updater) =>
      set((state) => ({
        viewport: typeof updater === 'function' ? updater(state.viewport) : updater,
      })),
    setHoveredShapeId: (hoveredShapeId) => set({ hoveredShapeId }),
    setIsSpacePressed: (pressed) => set({ isSpacePressed: pressed }),
    setEditingTextId: (id) => set({ editingTextId: id }),
    setNavigationMode: (navigationMode) => set({ navigationMode }),



    selectObject: (id) => set({ selectedIds: id ? [id] : [] }),
    toggleSelectId: (id) =>
      set((state) => {
        const exists = state.selectedIds.includes(id);
        return {
          selectedIds: exists
            ? state.selectedIds.filter((item) => item !== id)
            : [...state.selectedIds, id],
        };
      }),
    setSelectedIds: (selectedIds) => set({ selectedIds }),
    selectAll: () => {
      const state = get();
      set({ selectedIds: [...state.documentStore.getState().order] });
    },

    panBy: (dx, dy) =>
      set((state) => ({
        viewport: {
          ...state.viewport,
          x: state.viewport.x + dx,
          y: state.viewport.y + dy,
        },
      })),

    zoomAt: (screenAnchor, factor) =>
      set((state) => ({
        viewport: zoomAtScreenPoint(state.viewport, screenAnchor, factor),
      })),

    resetZoom: () =>
      set((state) => ({
        viewport: {
          ...state.viewport,
          zoom: 1.0,
        },
      })),

    zoomToFit: (containerWidth, containerHeight) => {
      const state = get();
      const objects = Object.values(state.documentStore.getState().objects);
      if (objects.length === 0) return;

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

      if (minX === Infinity) return;

      const padding = 120;
      const contentWidth = maxX - minX;
      const contentHeight = maxY - minY;
      if (contentWidth <= 0 || contentHeight <= 0) return;

      const scaleX = (containerWidth - padding * 2) / contentWidth;
      const scaleY = (containerHeight - padding * 2) / contentHeight;
      const targetZoom = clampZoom(Math.min(scaleX, scaleY), 0.2, 2.0);

      const contentCenterX = minX + contentWidth / 2;
      const contentCenterY = minY + contentHeight / 2;

      set({
        viewport: {
          zoom: targetZoom,
          x: containerWidth / 2 - contentCenterX * targetZoom,
          y: containerHeight / 2 - contentCenterY * targetZoom,
        },
      });
    },

    addShape: (kind, x, y, width = 180, height = 90) => {
      const id = `shape-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const shape: ShapeObject = {
        id,
        type: 'shape',
        kind,
        x,
        y,
        width,
        height,
        rotation: 0,
        text: kind === 'diamond' ? 'Decision' : kind === 'cylinder' ? 'Database' : 'New Step',
        style: {
          fill: '#ffffff',
          stroke: '#64748b',
          strokeWidth: 2,
          cornerRadius: kind === 'rounded-rectangle' ? 10 : 6,
          opacity: 1,
          shadow: true,
        },
        textStyle: {
          fontSize: 14,
          textAlign: 'center',
          textColor: '#1e293b',
        },
      };

      const cmd = new AddObjectsCommand(get().documentStore, [shape]);
      get().documentStore.executeCommand(cmd);
      set({ selectedIds: [id], tool: 'select', editingTextId: id });
      return id;
    },

    addSticky: (x, y, color = 'yellow', width = 150, height = 150) => {
      const id = `sticky-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const sticky: StickyObject = {
        id,
        type: 'sticky',
        x,
        y,
        width,
        height,
        rotation: 0,
        color,
        text: 'New thought...',
        textStyle: {
          fontSize: 14,
          textAlign: 'left',
          textColor: STICKY_COLOR_MAP[color].text,
        },
      };

      const cmd = new AddObjectsCommand(get().documentStore, [sticky]);
      get().documentStore.executeCommand(cmd);
      set({ selectedIds: [id], tool: 'select', editingTextId: id });
      return id;
    },

    addText: (x, y, text = 'Type something...') => {
      const id = `text-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const textObj: TextObject = {
        id,
        type: 'text',
        x,
        y,
        width: 160,
        height: 40,
        rotation: 0,
        text,
        textStyle: {
          fontSize: 16,
          fontWeight: 'normal',
          textAlign: 'left',
          textColor: '#1e293b',
        },
      };

      const cmd = new AddObjectsCommand(get().documentStore, [textObj]);
      get().documentStore.executeCommand(cmd);
      set({ selectedIds: [id], tool: 'select', editingTextId: id });
      return id;
    },

    addFrame: (x, y, width = 400, height = 300, name = 'Frame 1') => {
      const id = `frame-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const frame: FrameObject = {
        id,
        type: 'frame',
        name,
        x,
        y,
        width,
        height,
        rotation: 0,
        style: {
          fill: '#f8fafc',
          stroke: '#94a3b8',
          strokeWidth: 1.5,
          strokeDash: 'dashed',
          opacity: 1,
        },
      };

      const cmd = new AddObjectsCommand(get().documentStore, [frame]);
      get().documentStore.executeCommand(cmd);
      set({ selectedIds: [id], tool: 'select' });
      return id;
    },

    addSwimlane: (
      x,
      y,
      width = 680,
      height = 360,
      orientation = 'horizontal',
      headerTitle = 'Swimlane Diagram',
      lanes
    ) => {
      const id = `swimlane-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const defaultLanes: SwimlaneLane[] =
        lanes && lanes.length > 0
          ? lanes
          : [
              { id: `lane-${Date.now()}-1`, title: 'Lane 1' },
              { id: `lane-${Date.now()}-2`, title: 'Lane 2' },
              { id: `lane-${Date.now()}-3`, title: 'Lane 3' },
            ];

      const swimlane: SwimlaneObject = {
        id,
        type: 'swimlane',
        x,
        y,
        width,
        height,
        rotation: 0,
        headerTitle,
        orientation,
        lanes: defaultLanes,
        style: {
          fill: '#ffffff',
          stroke: '#64748b',
          strokeWidth: 2,
          cornerRadius: 8,
          opacity: 1,
          shadow: true,
        },
        textStyle: {
          fontSize: 14,
          fontWeight: 'bold',
          textColor: '#1e293b',
          textAlign: 'center',
        },
      };

      const cmd = new AddObjectsCommand(get().documentStore, [swimlane]);
      get().documentStore.executeCommand(cmd);
      set({ selectedIds: [id], tool: 'select' });
      return id;
    },

    addSwimlaneLane: (swimlaneId, title) => {
      const { documentStore } = get();
      const state = documentStore.getState();
      const obj = state.objects[swimlaneId];
      if (!obj || obj.type !== 'swimlane') return;

      const prev = JSON.parse(JSON.stringify(obj)) as SwimlaneObject;
      const next = JSON.parse(JSON.stringify(obj)) as SwimlaneObject;
      const layout = getSwimlaneLayout(prev);
      const isHoriz = (next.orientation || 'horizontal') === 'horizontal';

      const avgSize =
        layout.lanes.length > 0
          ? Math.round(
              layout.lanes.reduce((sum, l) => sum + (isHoriz ? l.height : l.width), 0) /
                layout.lanes.length
            )
          : isHoriz
          ? 90
          : 140;
      const newLaneSize = Math.max(isHoriz ? 60 : 80, avgSize);

      const newLaneIndex = next.lanes.length + 1;
      const newLane: SwimlaneLane = {
        id: `lane-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        title: title || `Lane ${newLaneIndex}`,
        size: newLaneSize,
      };

      // Preserve existing computed lane sizes so they don't shrink or shift
      next.lanes = layout.lanes.map((l) => {
        const raw = prev.lanes.find((p) => p.id === l.id);
        return {
          id: l.id,
          title: l.title,
          color: l.color,
          size: raw?.size ?? Math.round(isHoriz ? l.height : l.width),
        };
      });
      next.lanes.push(newLane);

      if (isHoriz) {
        next.height = Math.round(layout.totalHeight + newLaneSize);
      } else {
        next.width = Math.round(layout.totalWidth + newLaneSize);
      }

      const cmd = new UpdateObjectsCommand(documentStore, [prev], [next]);
      documentStore.executeCommand(cmd);
      set({ selectedIds: [swimlaneId] });
    },

    removeSwimlaneLane: (swimlaneId, laneId) => {
      const { documentStore } = get();
      const state = documentStore.getState();
      const obj = state.objects[swimlaneId];
      if (!obj || obj.type !== 'swimlane') return;
      if (obj.lanes.length <= 1) return; // Keep at least 1 lane

      const prev = JSON.parse(JSON.stringify(obj)) as SwimlaneObject;
      const next = JSON.parse(JSON.stringify(obj)) as SwimlaneObject;
      const layout = getSwimlaneLayout(prev);
      const removedLane = layout.lanes.find((l) => l.id === laneId);
      const isHoriz = (next.orientation || 'horizontal') === 'horizontal';
      const removedSize = removedLane
        ? isHoriz
          ? removedLane.height
          : removedLane.width
        : isHoriz
        ? 90
        : 140;

      next.lanes = next.lanes.filter((l) => l.id !== laneId);

      if (isHoriz) {
        next.height = Math.max(120, Math.round(layout.totalHeight - removedSize));
      } else {
        next.width = Math.max(150, Math.round(layout.totalWidth - removedSize));
      }

      const cmd = new UpdateObjectsCommand(documentStore, [prev], [next]);
      documentStore.executeCommand(cmd);
      set({ selectedIds: [swimlaneId] });
    },

    updateSwimlaneLane: (swimlaneId, laneId, patch) => {
      const { documentStore } = get();
      const state = documentStore.getState();
      const obj = state.objects[swimlaneId];
      if (!obj || obj.type !== 'swimlane') return;

      const prev = JSON.parse(JSON.stringify(obj)) as SwimlaneObject;
      const next = JSON.parse(JSON.stringify(obj)) as SwimlaneObject;

      next.lanes = next.lanes.map((l) => (l.id === laneId ? { ...l, ...patch } : l));

      const cmd = new UpdateObjectsCommand(documentStore, [prev], [next]);
      documentStore.executeCommand(cmd);
    },

    updateSwimlaneTitle: (swimlaneId, title) => {
      const { documentStore } = get();
      const state = documentStore.getState();
      const obj = state.objects[swimlaneId];
      if (!obj || obj.type !== 'swimlane') return;

      const prev = JSON.parse(JSON.stringify(obj)) as SwimlaneObject;
      const next = JSON.parse(JSON.stringify(obj)) as SwimlaneObject;

      next.headerTitle = title;

      const cmd = new UpdateObjectsCommand(documentStore, [prev], [next]);
      documentStore.executeCommand(cmd);
    },

    setSwimlaneOrientation: (swimlaneId, orientation) => {
      const { documentStore } = get();
      const state = documentStore.getState();
      const obj = state.objects[swimlaneId];
      if (!obj || obj.type !== 'swimlane') return;
      if (obj.orientation === orientation) return;

      const prev = JSON.parse(JSON.stringify(obj)) as SwimlaneObject;
      const next = JSON.parse(JSON.stringify(obj)) as SwimlaneObject;

      next.orientation = orientation;
      const oldW = next.width;
      const oldH = next.height;
      next.width = oldH;
      next.height = oldW;

      const cmd = new UpdateObjectsCommand(documentStore, [prev], [next]);
      documentStore.executeCommand(cmd);
    },

    resizeSwimlaneLane: (swimlaneId, laneId, newSize) => {
      const { documentStore } = get();
      const state = documentStore.getState();
      const obj = state.objects[swimlaneId];
      if (!obj || obj.type !== 'swimlane') return;

      const prev = JSON.parse(JSON.stringify(obj)) as SwimlaneObject;
      const next = JSON.parse(JSON.stringify(obj)) as SwimlaneObject;

      const layout = getSwimlaneLayout(prev);
      const targetLane = layout.lanes.find((l) => l.id === laneId);
      if (!targetLane) return;

      const minSize = next.orientation === 'vertical' ? 50 : 36;
      const clampedSize = Math.max(minSize, Math.round(newSize));
      const oldSize = next.orientation === 'vertical' ? targetLane.width : targetLane.height;
      const diff = clampedSize - oldSize;

      next.lanes = next.lanes.map((l) => (l.id === laneId ? { ...l, size: clampedSize } : l));
      if (next.orientation === 'vertical') {
        next.width = Math.max(100, Math.round(next.width + diff));
      } else {
        next.height = Math.max(100, Math.round(next.height + diff));
      }

      const cmd = new UpdateObjectsCommand(documentStore, [prev], [next]);
      documentStore.executeCommand(cmd);
    },

    resizeSwimlaneHeader: (swimlaneId, headerSize, headerColSize) => {
      const { documentStore } = get();
      const state = documentStore.getState();
      const obj = state.objects[swimlaneId];
      if (!obj || obj.type !== 'swimlane') return;

      const prev = JSON.parse(JSON.stringify(obj)) as SwimlaneObject;
      const next = JSON.parse(JSON.stringify(obj)) as SwimlaneObject;

      if (headerSize !== undefined) {
        const clampedH = Math.max(24, Math.min(120, Math.round(headerSize)));
        const oldH = prev.headerSize ?? 34;
        const diff = clampedH - oldH;
        next.headerSize = clampedH;
        next.height = Math.max(100, Math.round(next.height + diff));
      }

      if (headerColSize !== undefined) {
        const isHoriz = (next.orientation || 'horizontal') === 'horizontal';
        const minW = isHoriz ? 60 : 24;
        const maxW = isHoriz ? 350 : 100;
        next.headerColSize = Math.max(minW, Math.min(maxW, Math.round(headerColSize)));
      }

      const cmd = new UpdateObjectsCommand(documentStore, [prev], [next]);
      documentStore.executeCommand(cmd);
    },

    addConnector: (
      from,
      to,
      routing: RoutingType = 'orthogonal',
      label = '',
      style?: Partial<ConnectorStyle>
    ) => {
      const id = `conn-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const connector: ConnectorObject = {
        id,
        type: 'connector',
        from,
        to,
        routing,
        label: label || undefined,
        style: {
          stroke: '#64748b',
          strokeWidth: 2,
          strokeDash: 'solid',
          endArrowhead: get().activeArrowheadType || 'arrow',
          ...style,
        },
      };

      const cmd = new AddObjectsCommand(get().documentStore, [connector]);
      get().documentStore.executeCommand(cmd);
      set({ selectedIds: [id] });
      return id;
    },

    addImage: (src, x, y, width = 300, height = 200) => {
      const id = `image-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const imgObj: ImageObject = {
        id,
        type: 'image',
        src,
        x,
        y,
        width,
        height,
        rotation: 0,
        style: {
          opacity: 1,
        },
      };

      const cmd = new AddObjectsCommand(get().documentStore, [imgObj]);
      get().documentStore.executeCommand(cmd);
      set({ selectedIds: [id], tool: 'select' });
      return id;
    },

    quickCreateConnectedNode: (sourceId, direction) => {
      const { documentStore, addShape, addSticky, addText, addFrame, addConnector, activeRouting } = get();
      const state = documentStore.getState();
      const source = state.objects[sourceId];
      if (!source || !('x' in source && 'y' in source && 'width' in source && 'height' in source)) {
        return null;
      }

      const spacing = 120;
      let newX = source.x;
      let newY = source.y;
      let fromAnchor: AnchorSide = 'right';
      let toAnchor: AnchorSide = 'left';

      switch (direction) {
        case 'right':
          newX = source.x + source.width + spacing;
          newY = source.y;
          fromAnchor = 'right';
          toAnchor = 'left';
          break;
        case 'bottom':
          newX = source.x;
          newY = source.y + source.height + spacing;
          fromAnchor = 'bottom';
          toAnchor = 'top';
          break;
        case 'left':
          newX = source.x - source.width - spacing;
          newY = source.y;
          fromAnchor = 'left';
          toAnchor = 'right';
          break;
        case 'top':
          newX = source.x;
          newY = source.y - source.height - spacing;
          fromAnchor = 'top';
          toAnchor = 'bottom';
          break;
      }

      // Context-aware node creation matching parent type
      let newId: string;
      if (source.type === 'sticky') {
        newId = addSticky(newX, newY, (source as any).color || 'yellow', source.width, source.height);
      } else if (source.type === 'frame') {
        newId = addFrame(newX, newY, source.width, source.height, 'Frame');
      } else if (source.type === 'text') {
        newId = addText(newX, newY, 'Text');
      } else {
        const kind = source.type === 'shape' ? source.kind : 'rounded-rectangle';
        newId = addShape(kind, newX, newY, source.width, source.height);
      }

      // Create connector between them
      addConnector(
        { objectId: sourceId, anchor: fromAnchor },
        { objectId: newId, anchor: toAnchor },
        activeRouting || 'orthogonal'
      );

      set({ selectedIds: [newId] });
      return newId;
    },

    updateObject: (obj, recordHistory = false) => {
      get().documentStore.updateObject(obj, recordHistory);
      set((state) => ({ boardVersion: state.boardVersion + 1 }));
    },

    updateSelectedProperties: (stylePatch, textPatch, extra) => {
      const { selectedIds, documentStore } = get();
      if (selectedIds.length === 0) return;

      const state = documentStore.getState();
      const prevObjs: BoardObject[] = [];
      const nextObjs: BoardObject[] = [];

      for (const id of selectedIds) {
        const obj = state.objects[id];
        if (!obj) continue;

        prevObjs.push(JSON.parse(JSON.stringify(obj)));
        const next = { ...obj } as any;

        if (stylePatch && 'style' in next) {
          next.style = { ...next.style, ...stylePatch };
        }
        if (textPatch) {
          next.textStyle = { ...(next.textStyle || {}), ...textPatch };
        }
        if (extra) {
          Object.assign(next, extra);
        }

        nextObjs.push(next);
      }

      if (nextObjs.length > 0) {
        const cmd = new UpdateObjectsCommand(documentStore, prevObjs, nextObjs);
        documentStore.executeCommand(cmd);
      }
    },

    updateSelectedConnector: (patch) => {
      const { selectedIds, documentStore } = get();
      if (selectedIds.length === 0) return;

      const state = documentStore.getState();
      const prevObjs: BoardObject[] = [];
      const nextObjs: BoardObject[] = [];

      for (const id of selectedIds) {
        const obj = state.objects[id];
        if (obj && obj.type === 'connector') {
          prevObjs.push(JSON.parse(JSON.stringify(obj)));
          nextObjs.push({ ...obj, ...patch });
        }
      }

      if (nextObjs.length > 0) {
        const cmd = new UpdateObjectsCommand(documentStore, prevObjs, nextObjs);
        documentStore.executeCommand(cmd);
      }
    },

    deleteSelected: () => {
      const { selectedIds, documentStore } = get();
      if (selectedIds.length === 0) return;

      const state = documentStore.getState();
      const unlockedSelected = selectedIds.filter((id) => !state.objects[id]?.isLocked);
      if (unlockedSelected.length === 0) return;

      const toDelete = new Set(unlockedSelected);

      // Cascading deletion: remove any connectors linked to the deleted shapes
      for (const obj of Object.values(state.objects)) {
        if (obj.type === 'connector') {
          const fromId = 'objectId' in obj.from ? obj.from.objectId : null;
          const toId = 'objectId' in obj.to ? obj.to.objectId : null;
          if ((fromId && toDelete.has(fromId)) || (toId && toDelete.has(toId))) {
            toDelete.add(obj.id);
          }
        }
      }

      const cmd = new DeleteObjectsCommand(documentStore, Array.from(toDelete));
      documentStore.executeCommand(cmd);
      set({ selectedIds: [], editingTextId: null });
    },

    duplicateSelected: () => {
      const { selectedIds, documentStore } = get();
      if (selectedIds.length === 0) return;

      const state = documentStore.getState();
      const newObjects: BoardObject[] = [];
      const newIds: string[] = [];

      for (const id of selectedIds) {
        const obj = state.objects[id];
        if (!obj || obj.type === 'connector') continue;

        const newId = `${obj.type}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const clone = JSON.parse(JSON.stringify(obj)) as any;
        clone.id = newId;
        delete clone.isLocked;
        if ('x' in clone && 'y' in clone) {
          clone.x += 24;
          clone.y += 24;
        }
        if (clone.type === 'swimlane' && Array.isArray(clone.lanes)) {
          clone.lanes = clone.lanes.map((l: any, i: number) => ({
            ...l,
            id: `lane-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
          }));
        }
        newObjects.push(clone);
        newIds.push(newId);
      }

      if (newObjects.length > 0) {
        const cmd = new AddObjectsCommand(documentStore, newObjects);
        documentStore.executeCommand(cmd);
        set({ selectedIds: newIds });
      }
    },

    copySelected: () => {
      const { selectedIds, documentStore } = get();
      const state = documentStore.getState();
      const copied = selectedIds
        .map((id) => state.objects[id])
        .filter((o): o is BoardObject => Boolean(o && o.type !== 'connector'));
      set({ clipboard: JSON.parse(JSON.stringify(copied)) });
    },

    pasteSelected: () => {
      const { clipboard, documentStore } = get();
      if (clipboard.length === 0) return;

      const newObjects: BoardObject[] = [];
      const newIds: string[] = [];

      for (const obj of clipboard) {
        const newId = `${obj.type}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const clone = JSON.parse(JSON.stringify(obj)) as any;
        clone.id = newId;
        delete clone.isLocked;
        if ('x' in clone && 'y' in clone) {
          clone.x += 24;
          clone.y += 24;
        }
        newObjects.push(clone);
        newIds.push(newId);
      }

      const cmd = new AddObjectsCommand(documentStore, newObjects);
      documentStore.executeCommand(cmd);
      set({ selectedIds: newIds });
    },

    toggleLockSelected: () => {
      const { selectedIds, documentStore } = get();
      if (selectedIds.length === 0) return;

      const state = documentStore.getState();
      const hasUnlocked = selectedIds.some((id) => !state.objects[id]?.isLocked);
      const prevObjs: BoardObject[] = [];
      const nextObjs: BoardObject[] = [];

      for (const id of selectedIds) {
        const obj = state.objects[id];
        if (obj) {
          prevObjs.push(JSON.parse(JSON.stringify(obj)));
          nextObjs.push({ ...obj, isLocked: hasUnlocked });
        }
      }

      if (nextObjs.length > 0) {
        const cmd = new UpdateObjectsCommand(documentStore, prevObjs, nextObjs);
        documentStore.executeCommand(cmd);
        set((s) => ({ boardVersion: s.boardVersion + 1 }));
      }
    },

    groupSelected: () => {
      const { selectedIds, documentStore } = get();
      if (selectedIds.length < 2) return;

      const state = documentStore.getState();
      const newGroupId = `group-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const prevObjs: BoardObject[] = [];
      const nextObjs: BoardObject[] = [];

      for (const id of selectedIds) {
        const obj = state.objects[id];
        if (obj && !obj.isLocked) {
          prevObjs.push(JSON.parse(JSON.stringify(obj)));
          nextObjs.push({ ...obj, groupId: newGroupId });
        }
      }

      if (nextObjs.length > 0) {
        const cmd = new UpdateObjectsCommand(documentStore, prevObjs, nextObjs);
        documentStore.executeCommand(cmd);
        set((s) => ({ boardVersion: s.boardVersion + 1 }));
      }
    },

    ungroupSelected: () => {
      const { selectedIds, documentStore } = get();
      if (selectedIds.length === 0) return;

      const state = documentStore.getState();
      const prevObjs: BoardObject[] = [];
      const nextObjs: BoardObject[] = [];

      for (const id of selectedIds) {
        const obj = state.objects[id];
        if (obj && obj.groupId && !obj.isLocked) {
          prevObjs.push(JSON.parse(JSON.stringify(obj)));
          const clone = { ...obj };
          delete clone.groupId;
          nextObjs.push(clone);
        }
      }

      if (nextObjs.length > 0) {
        const cmd = new UpdateObjectsCommand(documentStore, prevObjs, nextObjs);
        documentStore.executeCommand(cmd);
        set((s) => ({ boardVersion: s.boardVersion + 1 }));
      }
    },

    alignSelected: (type) => {
      const { selectedIds, documentStore } = get();
      if (selectedIds.length < 2) return;

      const state = documentStore.getState();
      const alignables = selectedIds
        .map((id) => state.objects[id])
        .filter((o): o is BoardObject & { x: number; y: number; width: number; height: number } =>
          Boolean(o && 'x' in o && 'y' in o && 'width' in o && 'height' in o)
        );

      const alignedCoords = calculateAlignment(alignables, type);
      const prevObjs: BoardObject[] = [];
      const nextObjs: BoardObject[] = [];

      for (const pos of alignedCoords) {
        const obj = state.objects[pos.id];
        if (!obj) continue;
        prevObjs.push(JSON.parse(JSON.stringify(obj)));
        nextObjs.push({ ...obj, x: pos.x, y: pos.y } as any);
      }

      if (nextObjs.length > 0) {
        const cmd = new UpdateObjectsCommand(documentStore, prevObjs, nextObjs);
        documentStore.executeCommand(cmd);
      }
    },

    distributeSelected: (type) => {
      const { selectedIds, documentStore } = get();
      if (selectedIds.length < 3) return;

      const state = documentStore.getState();
      const alignables = selectedIds
        .map((id) => state.objects[id])
        .filter((o): o is BoardObject & { x: number; y: number; width: number; height: number } =>
          Boolean(o && 'x' in o && 'y' in o && 'width' in o && 'height' in o)
        );

      const distributedCoords = calculateDistribution(alignables, type);
      const prevObjs: BoardObject[] = [];
      const nextObjs: BoardObject[] = [];

      for (const pos of distributedCoords) {
        const obj = state.objects[pos.id];
        if (!obj) continue;
        prevObjs.push(JSON.parse(JSON.stringify(obj)));
        nextObjs.push({ ...obj, x: pos.x, y: pos.y } as any);
      }

      if (nextObjs.length > 0) {
        const cmd = new UpdateObjectsCommand(documentStore, prevObjs, nextObjs);
        documentStore.executeCommand(cmd);
      }
    },

    bringForward: () => {
      const { selectedIds, documentStore } = get();
      if (selectedIds.length === 0) return;

      const state = documentStore.getState();
      const currentOrder = [...state.order];
      const prevOrder = [...currentOrder];

      for (let i = currentOrder.length - 2; i >= 0; i--) {
        if (selectedIds.includes(currentOrder[i]) && !selectedIds.includes(currentOrder[i + 1])) {
          const temp = currentOrder[i];
          currentOrder[i] = currentOrder[i + 1];
          currentOrder[i + 1] = temp;
        }
      }

      const cmd = new ReorderCommand(documentStore, prevOrder, currentOrder);
      documentStore.executeCommand(cmd);
    },

    sendBackward: () => {
      const { selectedIds, documentStore } = get();
      if (selectedIds.length === 0) return;

      const state = documentStore.getState();
      const currentOrder = [...state.order];
      const prevOrder = [...currentOrder];

      for (let i = 1; i < currentOrder.length; i++) {
        if (selectedIds.includes(currentOrder[i]) && !selectedIds.includes(currentOrder[i - 1])) {
          const temp = currentOrder[i];
          currentOrder[i] = currentOrder[i - 1];
          currentOrder[i - 1] = temp;
        }
      }

      const cmd = new ReorderCommand(documentStore, prevOrder, currentOrder);
      documentStore.executeCommand(cmd);
    },

    bringToFront: () => {
      const { selectedIds, documentStore } = get();
      if (selectedIds.length === 0) return;

      const state = documentStore.getState();
      const unselected = state.order.filter((id) => !selectedIds.includes(id));
      const selected = state.order.filter((id) => selectedIds.includes(id));
      const nextOrder = [...unselected, ...selected];

      const cmd = new ReorderCommand(documentStore, state.order, nextOrder);
      documentStore.executeCommand(cmd);
    },

    sendToBack: () => {
      const { selectedIds, documentStore } = get();
      if (selectedIds.length === 0) return;

      const state = documentStore.getState();
      const unselected = state.order.filter((id) => !selectedIds.includes(id));
      const selected = state.order.filter((id) => selectedIds.includes(id));
      const nextOrder = [...selected, ...unselected];

      const cmd = new ReorderCommand(documentStore, state.order, nextOrder);
      documentStore.executeCommand(cmd);
    },

    undo: () => {
      get().documentStore.undo();
      set((state) => ({ boardVersion: state.boardVersion + 1 }));
    },

    redo: () => {
      get().documentStore.redo();
      set((state) => ({ boardVersion: state.boardVersion + 1 }));
    },

    // Drawing & Pen State
    activeDrawingColor: '#3b82f6',
    activeDrawingWidth: 3,
    setActiveDrawingColor: (color) => set({ activeDrawingColor: color }),
    setActiveDrawingWidth: (width) => set({ activeDrawingWidth: width }),
    addDrawing: (points, stroke = get().activeDrawingColor, strokeWidth = get().activeDrawingWidth, isHighlighter = false) => {
      const id = `draw-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const bounds = computeDrawingBounds(points);
      const drawing: DrawingObject = {
        id,
        type: 'drawing',
        points,
        stroke: isHighlighter ? (stroke || '#facc15') : stroke,
        strokeWidth: isHighlighter ? Math.max(strokeWidth, 18) : strokeWidth,
        isHighlighter,
        opacity: isHighlighter ? 0.35 : 1,
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
      };

      const cmd = new AddObjectsCommand(get().documentStore, [drawing]);
      get().documentStore.executeCommand(cmd);
      set({ selectedIds: [id] });
      return id;
    },

    // Templates
    insertTemplate: (templateKey: string) => {
      const tmpl = TEMPLATES[templateKey];
      if (!tmpl) return;

      const { viewport } = get();
      const cx = -viewport.x / viewport.zoom + 120;
      const cy = -viewport.y / viewport.zoom + 120;

      const newObjects = tmpl.generate(cx, cy);
      const cmd = new AddObjectsCommand(get().documentStore, newObjects);
      get().documentStore.executeCommand(cmd);

      set({
        selectedIds: newObjects.map((o) => o.id),
        tool: 'select',
      });
    },

    // Board persistence & switching
    loadBoardState: (board) => {
      const { documentStore } = get();
      documentStore.loadState({
        id: board.id,
        title: board.title,
        objects: board.objects || {},
        order: board.order || [],
      });

      set((prev) => ({
        selectedIds: [],
        editingTextId: null,
      }));
    },

    // Multiplayer
    isMultiplayerEnabled: true,
    toggleMultiplayer: () => set((state) => ({ isMultiplayerEnabled: !state.isMultiplayerEnabled })),
    collaborators: [
      { id: 'collab-1', name: 'Sarah (UX)', role: 'Product Designer', color: '#ec4899', x: 280, y: 340, activeObjectId: 'demo-rect-1' },
      { id: 'collab-2', name: 'Budi (PM)', role: 'Product Manager', color: '#10b981', x: 550, y: 120, activeObjectId: 'demo-diamond-1' },
      { id: 'collab-3', name: 'Ken (Eng)', role: 'Tech Lead', color: '#f59e0b', x: 740, y: 310, activeObjectId: 'demo-rect-2' },
    ],
  };
});
