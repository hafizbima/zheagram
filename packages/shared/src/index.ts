export interface Point {
  x: number;
  y: number;
}

export interface ViewportTransform {
  x: number;
  y: number;
  zoom: number;
}

export type ResizeHandleType =
  | 'nw'
  | 'ne'
  | 'se'
  | 'sw'
  | 'n'
  | 'e'
  | 's'
  | 'w'
  | 'rotate';

export type ShapeKind =
  | 'rectangle'
  | 'rounded-rectangle'
  | 'ellipse'
  | 'diamond'
  | 'triangle'
  | 'parallelogram'
  | 'cylinder'
  | 'document'
  | 'hexagon'
  | 'cloud';

export type StickyColor =
  | 'yellow'
  | 'blue'
  | 'green'
  | 'pink'
  | 'purple'
  | 'orange'
  | 'gray'
  | 'mint'
  | 'peach';

export type RoutingType = 'curved' | 'orthogonal' | 'straight';

export type ArrowheadType = 'none' | 'arrow' | 'triangle' | 'circle' | 'diamond';

export type AnchorSide = 'top' | 'right' | 'bottom' | 'left';

export interface BaseObjectStyle {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  strokeDash?: 'solid' | 'dashed' | 'dotted';
  cornerRadius?: number;
  opacity?: number;
  shadow?: boolean;
}

export interface TextStyle {
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  fontStyle?: 'normal' | 'italic';
  textAlign?: 'left' | 'center' | 'right';
  textColor?: string;
}

export interface ConnectorStyle {
  stroke?: string;
  strokeWidth?: number;
  strokeDash?: 'solid' | 'dashed' | 'dotted';
  startArrowhead?: ArrowheadType;
  endArrowhead?: ArrowheadType;
}

export type ConnectorEndpoint =
  | { objectId: string; anchor: AnchorSide }
  | { x: number; y: number };

export interface BaseBoardObject {
  id: string;
  type: 'shape' | 'sticky' | 'text' | 'frame' | 'connector' | 'drawing' | 'image' | 'swimlane';
  rotation?: number;
  zIndex?: number;
  frameId?: string | null;
  groupId?: string | null;
  isLocked?: boolean;
  createdAt?: number;
  updatedAt?: number;
}

export interface ShapeObject extends BaseBoardObject {
  type: 'shape';
  kind: ShapeKind;
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  style: BaseObjectStyle;
  textStyle: TextStyle;
}

export interface StickyObject extends BaseBoardObject {
  type: 'sticky';
  x: number;
  y: number;
  width: number;
  height: number;
  color: StickyColor;
  text: string;
  textStyle: TextStyle;
  author?: string;
  tag?: string;
  reaction?: string;
}

export interface TextObject extends BaseBoardObject {
  type: 'text';
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  textStyle: TextStyle;
}

export interface FrameObject extends BaseBoardObject {
  type: 'frame';
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
  style?: BaseObjectStyle;
}

export interface ConnectorObject extends BaseBoardObject {
  type: 'connector';
  from: ConnectorEndpoint;
  to: ConnectorEndpoint;
  routing: RoutingType;
  label?: string;
  style: ConnectorStyle;
  waypoints?: Point[];
}

export interface DrawingPoint {
  x: number;
  y: number;
  pressure?: number;
}

export interface DrawingObject extends BaseBoardObject {
  type: 'drawing';
  points: DrawingPoint[];
  stroke: string;
  strokeWidth: number;
  isHighlighter?: boolean;
  opacity?: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ImageObject extends BaseBoardObject {
  type: 'image';
  x: number;
  y: number;
  width: number;
  height: number;
  src: string;
  style?: BaseObjectStyle;
}

export interface SwimlaneLane {
  id: string;
  title: string;
  color?: string;
  size?: number;
}

export interface SwimlaneObject extends BaseBoardObject {
  type: 'swimlane';
  x: number;
  y: number;
  width: number;
  height: number;
  headerTitle?: string;
  headerSize?: number;
  headerColSize?: number;
  orientation: 'horizontal' | 'vertical';
  lanes: SwimlaneLane[];
  style?: BaseObjectStyle;
  textStyle?: TextStyle;
}

export type BoardObject =
  | ShapeObject
  | StickyObject
  | TextObject
  | FrameObject
  | ConnectorObject
  | DrawingObject
  | ImageObject
  | SwimlaneObject;

export interface BoardState {
  id: string;
  title: string;
  objects: Record<string, BoardObject>;
  order: string[];
}
