import {
  Point,
  ShapeKind,
  AnchorSide,
  ShapeObject,
  BoardObject,
  ResizeHandleType,
} from '@diagrammer/shared';

export interface AnchorPoint {
  side: AnchorSide;
  pos: Point;
  normal?: Point;
}

export type AlignmentType =
  | 'left'
  | 'center'
  | 'right'
  | 'top'
  | 'middle'
  | 'bottom';

export type DistributionType = 'horizontal' | 'vertical';

export const ROTATION_HANDLE_OFFSET = 24;

export function getShapeSvgData(
  kind: ShapeKind,
  x: number,
  y: number,
  width: number,
  height: number,
  cornerRadius: number = 8
):
  | { type: 'rect' }
  | { type: 'ellipse' }
  | { type: 'path'; pathData: string } {
  if (kind === 'rectangle' || kind === 'rounded-rectangle') {
    return { type: 'rect' };
  }

  if (kind === 'ellipse') {
    return { type: 'ellipse' };
  }

  let pathData = '';

  switch (kind) {
    case 'diamond': {
      const cx = x + width / 2;
      const cy = y + height / 2;
      pathData = `M ${cx} ${y} L ${x + width} ${cy} L ${cx} ${y + height} L ${x} ${cy} Z`;
      break;
    }

    case 'triangle': {
      pathData = `M ${x + width / 2} ${y} L ${x + width} ${y + height} L ${x} ${y + height} Z`;
      break;
    }

    case 'parallelogram': {
      const offset = width * 0.2;
      pathData = `M ${x + offset} ${y} L ${x + width} ${y} L ${x + width - offset} ${y + height} L ${x} ${y + height} Z`;
      break;
    }

    case 'cylinder': {
      const ry = Math.min(16, height * 0.2);
      pathData = `
        M ${x} ${y + ry}
        A ${width / 2} ${ry} 0 0 1 ${x + width} ${y + ry}
        L ${x + width} ${y + height - ry}
        A ${width / 2} ${ry} 0 0 1 ${x} ${y + height - ry}
        Z
        M ${x} ${y + ry}
        A ${width / 2} ${ry} 0 0 0 ${x + width} ${y + ry}
      `;
      break;
    }

    case 'document': {
      const wave = Math.min(14, height * 0.15);
      pathData = `
        M ${x} ${y}
        L ${x + width} ${y}
        L ${x + width} ${y + height - wave}
        Q ${x + width * 0.75} ${y + height} ${x + width * 0.5} ${y + height - wave}
        T ${x} ${y + height - wave}
        Z
      `;
      break;
    }

    case 'hexagon': {
      const dx = width * 0.25;
      pathData = `
        M ${x + dx} ${y}
        L ${x + width - dx} ${y}
        L ${x + width} ${y + height / 2}
        L ${x + width - dx} ${y + height}
        L ${x + dx} ${y + height}
        L ${x} ${y + height / 2}
        Z
      `;
      break;
    }

    case 'cloud': {
      const r = width / 6;
      pathData = `
        M ${x + r * 1.5} ${y + height - r}
        A ${r} ${r} 0 0 1 ${x + r * 0.5} ${y + height * 0.5}
        A ${r * 1.2} ${r * 1.2} 0 0 1 ${x + r * 2.5} ${y + height * 0.2}
        A ${r * 1.4} ${r * 1.4} 0 0 1 ${x + r * 4.5} ${y + height * 0.25}
        A ${r * 1.1} ${r * 1.1} 0 0 1 ${x + width - r * 0.5} ${y + height * 0.55}
        A ${r} ${r} 0 0 1 ${x + width - r * 1.5} ${y + height - r}
        Z
      `;
      break;
    }

    default:
      pathData = `M ${x} ${y} h ${width} v ${height} h ${-width} Z`;
  }

  return { type: 'path', pathData };
}

export function getShapeAnchors(shape: ShapeObject): Record<AnchorSide, AnchorPoint> {
  const { x, y, width, height } = shape;
  const rot = (shape.rotation || 0) * (Math.PI / 180);
  const cx = x + width / 2;
  const cy = y + height / 2;

  const rotatePoint = (pt: Point): Point => {
    if (rot === 0) return pt;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    const dx = pt.x - cx;
    const dy = pt.y - cy;
    return {
      x: cx + dx * cos - dy * sin,
      y: cy + dx * sin + dy * cos,
    };
  };

  return {
    top: {
      side: 'top',
      pos: rotatePoint({ x: cx, y }),
      normal: { x: 0, y: -1 },
    },
    right: {
      side: 'right',
      pos: rotatePoint({ x: x + width, y: cy }),
      normal: { x: 1, y: 0 },
    },
    bottom: {
      side: 'bottom',
      pos: rotatePoint({ x: cx, y: y + height }),
      normal: { x: 0, y: 1 },
    },
    left: {
      side: 'left',
      pos: rotatePoint({ x, y: cy }),
      normal: { x: -1, y: 0 },
    },
  };
}

export function getNearestAnchor(
  pt: Point,
  shape: ShapeObject,
  maxDistance: number = 40
): (AnchorPoint & { distance: number }) | null {
  const anchors = getShapeAnchors(shape);
  let best: (AnchorPoint & { distance: number }) | null = null;
  let minDistance = maxDistance;

  for (const side of ['top', 'right', 'bottom', 'left'] as AnchorSide[]) {
    const a = anchors[side];
    const dist = Math.hypot(pt.x - a.pos.x, pt.y - a.pos.y);
    if (dist <= minDistance) {
      minDistance = dist;
      best = { ...a, distance: dist };
    }
  }

  return best;
}

export function getShapeHandles(obj: {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}): Array<{ type: ResizeHandleType | 'rotate'; worldPos: Point; cursor: string }> {
  const { x, y, width, height } = obj;
  const rot = (obj.rotation || 0) * (Math.PI / 180);
  const cx = x + width / 2;
  const cy = y + height / 2;

  const rotatePoint = (pt: Point): Point => {
    if (rot === 0) return pt;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    const dx = pt.x - cx;
    const dy = pt.y - cy;
    return {
      x: cx + dx * cos - dy * sin,
      y: cy + dx * sin + dy * cos,
    };
  };

  return [
    { type: 'nw', worldPos: rotatePoint({ x, y }), cursor: 'nwse-resize' },
    { type: 'n', worldPos: rotatePoint({ x: cx, y }), cursor: 'ns-resize' },
    { type: 'ne', worldPos: rotatePoint({ x: x + width, y }), cursor: 'nesw-resize' },
    { type: 'e', worldPos: rotatePoint({ x: x + width, y: cy }), cursor: 'ew-resize' },
    { type: 'se', worldPos: rotatePoint({ x: x + width, y: y + height }), cursor: 'nwse-resize' },
    { type: 's', worldPos: rotatePoint({ x: cx, y: y + height }), cursor: 'ns-resize' },
    { type: 'sw', worldPos: rotatePoint({ x, y: y + height }), cursor: 'nesw-resize' },
    { type: 'w', worldPos: rotatePoint({ x, y: cy }), cursor: 'ew-resize' },
    {
      type: 'rotate',
      worldPos: rotatePoint({ x: cx, y: y - ROTATION_HANDLE_OFFSET }),
      cursor: 'grab',
    },
  ];
}

export function calculateResize(
  initialShape: { x: number; y: number; width: number; height: number; rotation?: number },
  handle: ResizeHandleType,
  worldPos: Point,
  keepAspect: boolean = false
): { x: number; y: number; width: number; height: number } {
  let { x, y, width, height } = initialShape;
  const minSize = 20;

  let right = x + width;
  let bottom = y + height;

  if (handle.includes('e')) {
    right = Math.max(x + minSize, worldPos.x);
  }
  if (handle.includes('s')) {
    bottom = Math.max(y + minSize, worldPos.y);
  }
  if (handle.includes('w')) {
    x = Math.min(right - minSize, worldPos.x);
  }
  if (handle.includes('n')) {
    y = Math.min(bottom - minSize, worldPos.y);
  }

  width = right - x;
  height = bottom - y;

  if (keepAspect && initialShape.width > 0 && initialShape.height > 0) {
    const ratio = initialShape.width / initialShape.height;
    if (width / height > ratio) {
      width = height * ratio;
    } else {
      height = width / ratio;
    }
  }

  return { x, y, width, height };
}

export function calculateRotation(
  initialShape: { x: number; y: number; width: number; height: number },
  worldPos: Point,
  snap15: boolean = false
): number {
  const cx = initialShape.x + initialShape.width / 2;
  const cy = initialShape.y + initialShape.height / 2;
  const dx = worldPos.x - cx;
  const dy = worldPos.y - cy;

  let deg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
  deg = (deg + 360) % 360;

  if (snap15) {
    deg = Math.round(deg / 15) * 15;
  }

  return Math.round(deg);
}

export function calculateAlignment(
  objects: Array<BoardObject & { x: number; y: number; width: number; height: number }>,
  type: AlignmentType
): Array<{ id: string; x: number; y: number }> {
  if (objects.length < 2) return [];

  const minX = Math.min(...objects.map((o) => o.x));
  const maxX = Math.max(...objects.map((o) => o.x + o.width));
  const minY = Math.min(...objects.map((o) => o.y));
  const maxY = Math.max(...objects.map((o) => o.y + o.height));

  return objects.map((o) => {
    let nx = o.x;
    let ny = o.y;

    switch (type) {
      case 'left':
        nx = minX;
        break;
      case 'center':
        nx = minX + (maxX - minX) / 2 - o.width / 2;
        break;
      case 'right':
        nx = maxX - o.width;
        break;
      case 'top':
        ny = minY;
        break;
      case 'middle':
        ny = minY + (maxY - minY) / 2 - o.height / 2;
        break;
      case 'bottom':
        ny = maxY - o.height;
        break;
    }

    return { id: o.id, x: Math.round(nx), y: Math.round(ny) };
  });
}

export function calculateDistribution(
  objects: Array<BoardObject & { x: number; y: number; width: number; height: number }>,
  type: DistributionType
): Array<{ id: string; x: number; y: number }> {
  if (objects.length < 3) return [];

  const sorted = [...objects].sort((a, b) =>
    type === 'horizontal' ? a.x - b.x : a.y - b.y
  );

  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  if (type === 'horizontal') {
    const totalSpan = last.x + last.width - first.x;
    const totalObjectWidth = sorted.reduce((acc, o) => acc + o.width, 0);
    const gap = (totalSpan - totalObjectWidth) / (sorted.length - 1);

    let curX = first.x;
    return sorted.map((o) => {
      const res = { id: o.id, x: Math.round(curX), y: o.y };
      curX += o.width + gap;
      return res;
    });
  } else {
    const totalSpan = last.y + last.height - first.y;
    const totalObjectHeight = sorted.reduce((acc, o) => acc + o.height, 0);
    const gap = (totalSpan - totalObjectHeight) / (sorted.length - 1);

    let curY = first.y;
    return sorted.map((o) => {
      const res = { id: o.id, x: o.x, y: Math.round(curY) };
      curY += o.height + gap;
      return res;
    });
  }
}
