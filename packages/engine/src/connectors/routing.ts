import { Point, RoutingType, AnchorSide } from '@diagrammer/shared';
import { AnchorPoint } from '../geometry/shapes';

export interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface ConnectorRouteResult {
  svgPath: string;
  labelPosition: Point;
  midpoint: Point;
  points: Point[];
}

export function calculateConnectorRoute(
  fromAnchor: AnchorPoint,
  toAnchor: AnchorPoint,
  routing: RoutingType = 'curved',
  waypoints: Point[] = [],
  isSelfLoop?: boolean,
  selfBounds?: Box,
  obstacles?: Box[]
): ConnectorRouteResult {
  const p1 = fromAnchor.pos;
  const p2 = toAnchor.pos;

  // Handle self-loop (connector connecting object to itself)
  if (isSelfLoop && selfBounds) {
    const margin = 35;
    const points = getSelfLoopPoints(fromAnchor, toAnchor, selfBounds, margin);
    const midpoint = getPolylineMidpoint(points);

    return {
      svgPath: pointsToFilletPath(points, 8),
      labelPosition: { x: midpoint.x, y: midpoint.y - 12 },
      midpoint,
      points,
    };
  }

  // Combine parallel anchors if more than 1 anchor is parallel on the same line
  const effectiveWaypoints =
    waypoints && waypoints.length > 0
      ? combineParallelAnchors(waypoints, p1, p2)
      : waypoints;

  // 1. Straight line
  if (routing === 'straight') {
    if (effectiveWaypoints && effectiveWaypoints.length > 0) {
      let path = `M ${p1.x} ${p1.y}`;
      const pts = [p1, ...effectiveWaypoints, p2];
      for (const wp of effectiveWaypoints) {
        path += ` L ${wp.x} ${wp.y}`;
      }
      path += ` L ${p2.x} ${p2.y}`;
      const centerWp = effectiveWaypoints[Math.floor(effectiveWaypoints.length / 2)];
      return {
        svgPath: path,
        labelPosition: { x: centerWp.x, y: centerWp.y - 12 },
        midpoint: centerWp,
        points: pts,
      };
    }

    const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    const path = `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`;
    return {
      svgPath: path,
      labelPosition: { x: mid.x, y: mid.y - 12 },
      midpoint: mid,
      points: [p1, p2],
    };
  }

  // 2. Orthogonal (Manhattan Routing with Obstacle Avoidance)
  if (routing === 'orthogonal') {
    const fromSide = fromAnchor.side;
    const toSide = toAnchor.side;

    const points = routeOrthogonalThroughWaypoints(
      p1,
      fromSide,
      p2,
      toSide,
      effectiveWaypoints || [],
      obstacles || [],
      fromAnchor.normal,
      toAnchor.normal
    );
    const path = pointsToFilletPath(points, 8);

    const midIdx = Math.floor(points.length / 2);
    const midPoint =
      effectiveWaypoints && effectiveWaypoints.length > 0
        ? effectiveWaypoints[Math.floor(effectiveWaypoints.length / 2)]
        : points.length >= 2
        ? {
            x: (points[midIdx - 1].x + points[midIdx].x) / 2,
            y: (points[midIdx - 1].y + points[midIdx].y) / 2,
          }
        : p1;

    const labelPos = {
      x: midPoint.x,
      y: midPoint.y - 12,
    };

    return { svgPath: path, labelPosition: labelPos, midpoint: midPoint, points };
  }


  // 3. Curved (Smooth Cubic or Waypoint Bezier)
  if (effectiveWaypoints && effectiveWaypoints.length > 0) {
    const W = effectiveWaypoints[0];
    const cx = 2 * W.x - 0.5 * (p1.x + p2.x);
    const cy = 2 * W.y - 0.5 * (p1.y + p2.y);
    const path = `M ${p1.x} ${p1.y} Q ${cx} ${cy} ${p2.x} ${p2.y}`;

    return {
      svgPath: path,
      labelPosition: { x: W.x, y: W.y - 14 },
      midpoint: W,
      points: [p1, W, p2],
    };
  }

  const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  const curvature = Math.max(40, Math.min(dist * 0.45, 180));

  const n1 = getSideNormal(fromAnchor.side);
  const n2 = getSideNormal(toAnchor.side);

  const cp1 = {
    x: p1.x + n1.x * curvature,
    y: p1.y + n1.y * curvature,
  };
  const cp2 = {
    x: p2.x + n2.x * curvature,
    y: p2.y + n2.y * curvature,
  };

  const path = `M ${p1.x} ${p1.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${p2.x} ${p2.y}`;

  // Cubic Bezier mid-point at t=0.5
  const midX = 0.125 * p1.x + 0.375 * cp1.x + 0.375 * cp2.x + 0.125 * p2.x;
  const midY = 0.125 * p1.y + 0.375 * cp1.y + 0.375 * cp2.y + 0.125 * p2.y;

  return {
    svgPath: path,
    labelPosition: { x: midX, y: midY - 14 },
    midpoint: { x: midX, y: midY },
    points: [p1, { x: midX, y: midY }, p2],
  };
}

function getSelfLoopPoints(
  fromAnchor: AnchorPoint,
  toAnchor: AnchorPoint,
  bounds: Box,
  margin: number
): Point[] {
  const p1 = fromAnchor.pos;
  const p2 = toAnchor.pos;
  const fromSide = fromAnchor.side;
  const toSide = toAnchor.side;

  // Keep the loop outside the side used by either endpoint. This preserves the
  // anchor normal and avoids routing through the object itself.
  const side =
    fromSide === toSide
      ? fromSide
      : (fromSide === 'left' && toSide === 'right') || (fromSide === 'right' && toSide === 'left')
      ? 'top'
      : (fromSide === 'top' && toSide === 'bottom') || (fromSide === 'bottom' && toSide === 'top')
      ? 'left'
      : fromSide === 'top' || fromSide === 'bottom'
      ? fromSide
      : toSide === 'top' || toSide === 'bottom'
      ? toSide
      : fromSide;

  if (side === 'left' || side === 'right') {
    const loopX = side === 'left' ? bounds.minX - margin : bounds.maxX + margin;
    if (Math.abs(p1.y - p2.y) < 0.5) {
      const loopY = p1.y <= (bounds.minY + bounds.maxY) / 2
        ? bounds.minY - margin
        : bounds.maxY + margin;
      const farX = side === 'left' ? loopX - margin : loopX + margin;
      return [
        p1,
        { x: loopX, y: p1.y },
        { x: loopX, y: loopY },
        { x: farX, y: loopY },
        { x: farX, y: p2.y },
        { x: loopX, y: p2.y },
        p2,
      ];
    }

    return [p1, { x: loopX, y: p1.y }, { x: loopX, y: p2.y }, p2];
  }

  const loopY = side === 'top' ? bounds.minY - margin : bounds.maxY + margin;
  if (Math.abs(p1.x - p2.x) < 0.5) {
    const loopX = p1.x <= (bounds.minX + bounds.maxX) / 2
      ? bounds.minX - margin
      : bounds.maxX + margin;
    const farY = side === 'top' ? loopY - margin : loopY + margin;
    return [
      p1,
      { x: p1.x, y: loopY },
      { x: loopX, y: loopY },
      { x: loopX, y: farY },
      { x: p2.x, y: farY },
      { x: p2.x, y: loopY },
      p2,
    ];
  }

  return [p1, { x: p1.x, y: loopY }, { x: p2.x, y: loopY }, p2];
}

function getPolylineMidpoint(points: Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return points[0];

  let totalLength = 0;
  for (let i = 1; i < points.length; i++) {
    totalLength += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }

  let remaining = totalLength / 2;
  for (let i = 1; i < points.length; i++) {
    const start = points[i - 1];
    const end = points[i];
    const segmentLength = Math.hypot(end.x - start.x, end.y - start.y);
    if (remaining <= segmentLength || segmentLength === 0) {
      const ratio = segmentLength === 0 ? 0 : remaining / segmentLength;
      return {
        x: start.x + (end.x - start.x) * ratio,
        y: start.y + (end.y - start.y) * ratio,
      };
    }
    remaining -= segmentLength;
  }

  return points[points.length - 1];
}

/**
 * Checks if a segment intersects the strict interior of a box.
 */
export function segmentIntersectsBox(p1: Point, p2: Point, box: Box, tolerance = 1): boolean {
  const bMinX = box.minX + tolerance;
  const bMaxX = box.maxX - tolerance;
  const bMinY = box.minY + tolerance;
  const bMaxY = box.maxY - tolerance;

  if (bMaxX <= bMinX || bMaxY <= bMinY) return false;

  // Horizontal segment
  if (Math.abs(p1.y - p2.y) < 0.001) {
    const y = p1.y;
    if (y <= bMinY || y >= bMaxY) return false;
    const minX = Math.min(p1.x, p2.x);
    const maxX = Math.max(p1.x, p2.x);
    return maxX > bMinX && minX < bMaxX;
  }

  // Vertical segment
  if (Math.abs(p1.x - p2.x) < 0.001) {
    const x = p1.x;
    if (x <= bMinX || x >= bMaxX) return false;
    const minY = Math.min(p1.y, p2.y);
    const maxY = Math.max(p1.y, p2.y);
    return maxY > bMinY && minY < bMaxY;
  }

  // General bounding box check
  const minX = Math.min(p1.x, p2.x);
  const maxX = Math.max(p1.x, p2.x);
  const minY = Math.min(p1.y, p2.y);
  const maxY = Math.max(p1.y, p2.y);

  if (maxX <= bMinX || minX >= bMaxX || maxY <= bMinY || minY >= bMaxY) {
    return false;
  }

  // Parametric clipping (Liang-Barsky / slab method)
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;

  let tMin = 0;
  let tMax = 1;

  if (dx !== 0) {
    const t1 = (bMinX - p1.x) / dx;
    const t2 = (bMaxX - p1.x) / dx;
    tMin = Math.max(tMin, Math.min(t1, t2));
    tMax = Math.min(tMax, Math.max(t1, t2));
  }
  if (dy !== 0) {
    const t1 = (bMinY - p1.y) / dy;
    const t2 = (bMaxY - p1.y) / dy;
    tMin = Math.max(tMin, Math.min(t1, t2));
    tMax = Math.min(tMax, Math.max(t1, t2));
  }

  return tMax > tMin && tMax > 0 && tMin < 1;
}

/**
 * Remove consecutive collinear points along straight lines
 */
export function simplifyCollinear(points: Point[]): Point[] {
  if (points.length <= 2) return points;
  const result: Point[] = [points[0]];

  for (let i = 1; i < points.length - 1; i++) {
    const prev = result[result.length - 1];
    const curr = points[i];
    const next = points[i + 1];

    const isHoriz =
      Math.abs(prev.y - curr.y) < 0.5 &&
      Math.abs(curr.y - next.y) < 0.5 &&
      (curr.x - prev.x) * (next.x - curr.x) > 0;
    const isVert =
      Math.abs(prev.x - curr.x) < 0.5 &&
      Math.abs(curr.x - next.x) < 0.5 &&
      (curr.y - prev.y) * (next.y - curr.y) > 0;

    if (isHoriz || isVert) {
      continue;
    }
    result.push(curr);
  }

  result.push(points[points.length - 1]);
  return result;
}

/**
 * Combines multiple anchors if more than 1 anchor is parallel / collinear on the same line,
 * or if they are duplicate / nearly coincident, and absorbs anchors dragged near terminals.
 */
export function combineParallelAnchors(
  waypoints: Point[],
  p1: Point,
  p2: Point,
  tolerance = 8
): Point[] {
  if (!waypoints || waypoints.length === 0) return [];

  const mergeDist = 28;

  // Step 0: Terminal Absorption - remove any waypoints within mergeDist of terminal endpoints p1 or p2
  let list = waypoints.filter((w) => {
    const distToP1 = Math.hypot(w.x - p1.x, w.y - p1.y);
    const distToP2 = Math.hypot(w.x - p2.x, w.y - p2.y);
    return distToP1 > mergeDist && distToP2 > mergeDist;
  });

  if (list.length === 0) return [];

  // Step 1: Merge adjacent anchors that are close together (distance <= 28px)
  let merged: Point[] = [];
  for (let i = 0; i < list.length; i++) {
    const pt = list[i];
    if (merged.length > 0) {
      const prev = merged[merged.length - 1];
      if (Math.hypot(pt.x - prev.x, pt.y - prev.y) <= mergeDist) {
        merged[merged.length - 1] = {
          x: Math.round((prev.x + pt.x) / 2),
          y: Math.round((prev.y + pt.y) / 2),
        };
        continue;
      }
    }
    merged.push(pt);
  }

  // Step 2: Combine consecutive anchors that lie on the same horizontal or vertical line,
  // or along the same collinear line
  let changed = true;
  while (changed && merged.length > 1) {
    changed = false;
    for (let i = 0; i < merged.length - 1; i++) {
      const w1 = merged[i];
      const w2 = merged[i + 1];

      const sameH = Math.abs(w1.y - w2.y) <= tolerance;
      const sameV = Math.abs(w1.x - w2.x) <= tolerance;

      if (sameH || sameV) {
        const combined: Point = {
          x: Math.round((w1.x + w2.x) / 2),
          y: Math.round((w1.y + w2.y) / 2),
        };
        merged.splice(i, 2, combined);
        changed = true;
        break;
      }

      // Check diagonal collinearity between w1 and w2 relative to preceding and succeeding points
      const prevPt = i > 0 ? merged[i - 1] : p1;
      const nextPt = i + 2 < merged.length ? merged[i + 2] : p2;
      const dxC = nextPt.x - prevPt.x;
      const dyC = nextPt.y - prevPt.y;
      const lenSq = dxC * dxC + dyC * dyC;
      if (lenSq > 1e-4) {
        const t1 = ((w1.x - prevPt.x) * dxC + (w1.y - prevPt.y) * dyC) / lenSq;
        const d1 = Math.hypot(w1.x - (prevPt.x + t1 * dxC), w1.y - (prevPt.y + t1 * dyC));
        const t2 = ((w2.x - prevPt.x) * dxC + (w2.y - prevPt.y) * dyC) / lenSq;
        const d2 = Math.hypot(w2.x - (prevPt.x + t2 * dxC), w2.y - (prevPt.y + t2 * dyC));
        if (d1 <= tolerance && d2 <= tolerance) {
          const combined: Point = {
            x: Math.round((w1.x + w2.x) / 2),
            y: Math.round((w1.y + w2.y) / 2),
          };
          merged.splice(i, 2, combined);
          changed = true;
          break;
        }
      }
    }
  }

  // Step 2.5: Remove intermediate waypoints that lie directly collinear between their immediate neighbors (prevPt -> W -> nextPt)
  let removedCollinear = false;
  do {
    removedCollinear = false;
    for (let i = 0; i < merged.length; i++) {
      const prevPt = i > 0 ? merged[i - 1] : p1;
      const curr = merged[i];
      const nextPt = i < merged.length - 1 ? merged[i + 1] : p2;

      const isHorizCollinear =
        Math.abs(prevPt.y - curr.y) <= tolerance &&
        Math.abs(curr.y - nextPt.y) <= tolerance &&
        curr.x >= Math.min(prevPt.x, nextPt.x) - tolerance &&
        curr.x <= Math.max(prevPt.x, nextPt.x) + tolerance;

      const isVertCollinear =
        Math.abs(prevPt.x - curr.x) <= tolerance &&
        Math.abs(curr.x - nextPt.x) <= tolerance &&
        curr.y >= Math.min(prevPt.y, nextPt.y) - tolerance &&
        curr.y <= Math.max(prevPt.y, nextPt.y) + tolerance;

      if (isHorizCollinear || isVertCollinear) {
        merged.splice(i, 1);
        removedCollinear = true;
        break;
      }
    }
  } while (removedCollinear);

  // Step 3: Check if all remaining anchors are collinear with p1 and p2 along a flat horizontal or vertical line
  const isSameH = Math.abs(p1.y - p2.y) <= tolerance;
  const isSameV = Math.abs(p1.x - p2.x) <= tolerance;

  if (isSameH) {
    const allOnH = merged.every((w) => Math.abs(w.y - p1.y) <= tolerance);
    if (allOnH) {
      return []; // All anchors on the same horizontal line as terminals dissolve into a straight line
    }
  }

  if (isSameV) {
    const allOnV = merged.every((w) => Math.abs(w.x - p1.x) <= tolerance);
    if (allOnV) {
      return []; // All anchors on the same vertical line as terminals dissolve into a straight line
    }
  }

  // Final terminal clearance check after merges
  return merged.filter((w) => {
    const distToP1 = Math.hypot(w.x - p1.x, w.y - p1.y);
    const distToP2 = Math.hypot(w.x - p2.x, w.y - p2.y);
    return distToP1 > mergeDist && distToP2 > mergeDist;
  });
}

/**
 * Direct Manhattan stepped route that strictly respects anchor outward normal directions
 * and never penetrates shape bodies even when no obstacles are explicitly provided.
 */
export function getDirectOrthogonalPath(
  p1: Point,
  fromSide: AnchorSide,
  p2: Point,
  toSide: AnchorSide,
  offset: number = 24,
  fromNormal?: Point,
  toNormal?: Point
): Point[] {
  const n1 = fromNormal || getSideNormal(fromSide);
  const n2 = toNormal || getSideNormal(toSide);
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;

  const isP1Free = n1.x === 0 && n1.y === 0;
  const isP2Free = n2.x === 0 && n2.y === 0;

  // Case 0a: Both endpoints are free points in open canvas
  if (isP1Free && isP2Free) {
    if (Math.abs(dx) <= 2) {
      return [p1, { x: p1.x, y: p2.y }];
    }
    if (Math.abs(dy) <= 2) {
      return [p1, { x: p2.x, y: p1.y }];
    }
    // Different axes -> keep line always straight with a single 90° corner
    return [p1, { x: p2.x, y: p1.y }, p2];
  }

  // Case 0b: p1 is free in open canvas, p2 is attached to a shape anchor
  if (isP1Free && !isP2Free) {
    if (n2.x !== 0) {
      if (Math.abs(dy) <= 2 && (n2.x > 0 ? p1.x >= p2.x : p1.x <= p2.x)) {
        return [p1, p2];
      }
      if (n2.x > 0 ? p1.x >= p2.x : p1.x <= p2.x) {
        return [p1, { x: p1.x, y: p2.y }, p2];
      }
      return [p1, { x: p2.x + n2.x * offset, y: p1.y }, { x: p2.x + n2.x * offset, y: p2.y }, p2];
    } else {
      if (Math.abs(dx) <= 2 && (n2.y > 0 ? p1.y >= p2.y : p1.y <= p2.y)) {
        return [p1, p2];
      }
      if (n2.y > 0 ? p1.y >= p2.y : p1.y <= p2.y) {
        return [p1, { x: p2.x, y: p1.y }, p2];
      }
      return [p1, { x: p1.x, y: p2.y + n2.y * offset }, { x: p2.x, y: p2.y + n2.y * offset }, p2];
    }
  }

  // Case 0c: p1 is attached to a shape anchor, p2 is free in open canvas
  if (!isP1Free && isP2Free) {
    if (n1.x !== 0) {
      if (Math.abs(dy) <= 2 && (n1.x > 0 ? p2.x >= p1.x : p2.x <= p1.x)) {
        return [p1, p2];
      }
      if (n1.x > 0 ? p2.x >= p1.x : p2.x <= p1.x) {
        return [p1, { x: p2.x, y: p1.y }, p2];
      }
      return [p1, { x: p1.x + n1.x * offset, y: p1.y }, { x: p1.x + n1.x * offset, y: p2.y }, p2];
    } else {
      if (Math.abs(dx) <= 2 && (n1.y > 0 ? p2.y >= p1.y : p2.y <= p1.y)) {
        return [p1, p2];
      }
      if (n1.y > 0 ? p2.y >= p1.y : p2.y <= p1.y) {
        return [p1, { x: p1.x, y: p2.y }, p2];
      }
      return [p1, { x: p1.x, y: p1.y + n1.y * offset }, { x: p2.x, y: p1.y + n1.y * offset }, p2];
    }
  }

  const p1Out: Point = { x: p1.x + n1.x * offset, y: p1.y + n1.y * offset };
  const p2Out: Point = { x: p2.x + n2.x * offset, y: p2.y + n2.y * offset };

  // 1. Same side U-bends (e.g., right-to-right, top-to-top)
  if (fromSide === toSide) {
    if (fromSide === 'right') {
      const maxX = Math.max(p1Out.x, p2Out.x);
      return [p1, { x: maxX, y: p1.y }, { x: maxX, y: p2.y }, p2];
    }
    if (fromSide === 'left') {
      const minX = Math.min(p1Out.x, p2Out.x);
      return [p1, { x: minX, y: p1.y }, { x: minX, y: p2.y }, p2];
    }
    if (fromSide === 'top') {
      const minY = Math.min(p1Out.y, p2Out.y);
      return [p1, { x: p1.x, y: minY }, { x: p2.x, y: minY }, p2];
    }
    if (fromSide === 'bottom') {
      const maxY = Math.max(p1Out.y, p2Out.y);
      return [p1, { x: p1.x, y: maxY }, { x: p2.x, y: maxY }, p2];
    }
  }

  // 2. Opposite sides facing each other with positive clearance
  if (fromSide === 'right' && toSide === 'left' && p2.x >= p1.x + offset * 2) {
    if (Math.abs(p1.y - p2.y) <= 8) {
      return [p1, { x: p2.x, y: p1.y }];
    }
    const midX = (p1.x + p2.x) / 2;
    return [p1, { x: midX, y: p1.y }, { x: midX, y: p2.y }, p2];
  }
  if (fromSide === 'left' && toSide === 'right' && p2.x <= p1.x - offset * 2) {
    if (Math.abs(p1.y - p2.y) <= 8) {
      return [p1, { x: p2.x, y: p1.y }];
    }
    const midX = (p1.x + p2.x) / 2;
    return [p1, { x: midX, y: p1.y }, { x: midX, y: p2.y }, p2];
  }
  if (fromSide === 'bottom' && toSide === 'top' && p2.y >= p1.y + offset * 2) {
    if (Math.abs(p1.x - p2.x) <= 8) {
      return [p1, { x: p1.x, y: p2.y }];
    }
    const midY = p1.y + dy / 2;
    return [p1, { x: p1.x, y: midY }, { x: p2.x, y: midY }, p2];
  }
  if (fromSide === 'top' && toSide === 'bottom' && p2.y <= p1.y - offset * 2) {
    if (Math.abs(p1.x - p2.x) <= 8) {
      return [p1, { x: p1.x, y: p2.y }];
    }
    const midY = p1.y + dy / 2;
    return [p1, { x: p1.x, y: midY }, { x: p2.x, y: midY }, p2];
  }

  // 3. Opposite sides facing AWAY or overlapping (must loop around perimeter)
  if (fromSide === 'right' && toSide === 'left') {
    const yBypass = p2.y >= p1.y ? Math.min(p1.y, p2.y) - offset : Math.max(p1.y, p2.y) + offset;
    return [p1, p1Out, { x: p1Out.x, y: yBypass }, { x: p2Out.x, y: yBypass }, p2Out, p2];
  }
  if (fromSide === 'left' && toSide === 'right') {
    const yBypass = p2.y >= p1.y ? Math.min(p1.y, p2.y) - offset : Math.max(p1.y, p2.y) + offset;
    return [p1, p1Out, { x: p1Out.x, y: yBypass }, { x: p2Out.x, y: yBypass }, p2Out, p2];
  }
  if (fromSide === 'bottom' && toSide === 'top') {
    const xBypass = p2.x >= p1.x ? Math.min(p1.x, p2.x) - offset : Math.max(p1.x, p2.x) + offset;
    return [p1, p1Out, { x: xBypass, y: p1Out.y }, { x: xBypass, y: p2Out.y }, p2Out, p2];
  }
  if (fromSide === 'top' && toSide === 'bottom') {
    const xBypass = p2.x >= p1.x ? Math.min(p1.x, p2.x) - offset : Math.max(p1.x, p2.x) + offset;
    return [p1, p1Out, { x: xBypass, y: p1Out.y }, { x: xBypass, y: p2Out.y }, p2Out, p2];
  }

  // 4. Perpendicular sides (e.g. right-to-bottom, bottom-to-left)
  if (Math.abs(n1.x) > 0) {
    const canDirectTurn =
      (n1.x > 0 ? p2.x >= p1.x : p2.x <= p1.x) &&
      (n2.y > 0 ? p1.y >= p2.y : p1.y <= p2.y);
    if (canDirectTurn) {
      return [p1, { x: p2.x, y: p1.y }, p2];
    }
    return [p1, p1Out, { x: p1Out.x, y: p2Out.y }, p2Out, p2];
  } else {
    const canDirectTurn =
      (n1.y > 0 ? p2.y >= p1.y : p2.y <= p1.y) &&
      (n2.x > 0 ? p1.x >= p2.x : p1.x <= p2.x);
    if (canDirectTurn) {
      return [p1, { x: p1.x, y: p2.y }, p2];
    }
    return [p1, p1Out, { x: p2Out.x, y: p1Out.y }, p2Out, p2];
  }
}

/**
 * A* grid path between startPt and endPt avoiding relevant obstacles
 */
export function findGridPath(
  startPt: Point,
  endPt: Point,
  obstacles: Box[],
  margin = 24
): Point[] {
  // Filter obstacles relevant to this connector search zone
  const allX = [startPt.x, endPt.x];
  const allY = [startPt.y, endPt.y];
  for (const b of obstacles) {
    allX.push(b.minX, b.maxX);
    allY.push(b.minY, b.maxY);
  }

  const searchMinX = Math.min(...allX) - margin * 3;
  const searchMaxX = Math.max(...allX) + margin * 3;
  const searchMinY = Math.min(...allY) - margin * 3;
  const searchMaxY = Math.max(...allY) + margin * 3;

  const relevantObstacles = obstacles.filter((b) => {
    // If box encloses both startPt and endPt, it's an enclosing container, not an obstacle between them
    const enclosesStart =
      startPt.x >= b.minX - 2 &&
      startPt.x <= b.maxX + 2 &&
      startPt.y >= b.minY - 2 &&
      startPt.y <= b.maxY + 2;
    const enclosesEnd =
      endPt.x >= b.minX - 2 &&
      endPt.x <= b.maxX + 2 &&
      endPt.y >= b.minY - 2 &&
      endPt.y <= b.maxY + 2;
    if (enclosesStart && enclosesEnd) return false;

    return !(
      b.maxX < searchMinX ||
      b.minX > searchMaxX ||
      b.maxY < searchMinY ||
      b.minY > searchMaxY
    );
  });

  // Build coordinate sets from terminals, obstacle channels, and mid-gaps
  const xSet = new Set<number>([
    startPt.x,
    endPt.x,
    Math.round((startPt.x + endPt.x) / 2),
    searchMinX,
    searchMaxX,
  ]);
  const ySet = new Set<number>([
    startPt.y,
    endPt.y,
    Math.round((startPt.y + endPt.y) / 2),
    searchMinY,
    searchMaxY,
  ]);

  for (const b of relevantObstacles) {
    xSet.add(b.minX - margin);
    xSet.add(b.maxX + margin);
    ySet.add(b.minY - margin);
    ySet.add(b.maxY + margin);
  }

  // Add mid-channels between pairs of obstacles if there is sufficient space
  for (let i = 0; i < relevantObstacles.length; i++) {
    for (let j = i + 1; j < relevantObstacles.length; j++) {
      const b1 = relevantObstacles[i];
      const b2 = relevantObstacles[j];
      const gapX = Math.max(0, Math.max(b1.minX, b2.minX) - Math.min(b1.maxX, b2.maxX));
      if (gapX >= margin * 2) {
        xSet.add(Math.round((Math.min(b1.maxX, b2.maxX) + Math.max(b1.minX, b2.minX)) / 2));
      }
      const gapY = Math.max(0, Math.max(b1.minY, b2.minY) - Math.min(b1.maxY, b2.maxY));
      if (gapY >= margin * 2) {
        ySet.add(Math.round((Math.min(b1.maxY, b2.maxY) + Math.max(b1.minY, b2.minY)) / 2));
      }
    }
  }

  const xs = Array.from(xSet).sort((a, b) => a - b);
  const ys = Array.from(ySet).sort((a, b) => a - b);

  // Deduplicate coordinates within 3px
  const cleanXs: number[] = [];
  for (const x of xs) {
    if (cleanXs.length === 0 || Math.abs(x - cleanXs[cleanXs.length - 1]) > 3) {
      cleanXs.push(x);
    }
  }
  const cleanYs: number[] = [];
  for (const y of ys) {
    if (cleanYs.length === 0 || Math.abs(y - cleanYs[cleanYs.length - 1]) > 3) {
      cleanYs.push(y);
    }
  }

  const findXIdx = (val: number) => {
    let best = 0;
    let minDiff = Infinity;
    for (let i = 0; i < cleanXs.length; i++) {
      const diff = Math.abs(cleanXs[i] - val);
      if (diff < minDiff) {
        minDiff = diff;
        best = i;
      }
    }
    return best;
  };

  const findYIdx = (val: number) => {
    let best = 0;
    let minDiff = Infinity;
    for (let i = 0; i < cleanYs.length; i++) {
      const diff = Math.abs(cleanYs[i] - val);
      if (diff < minDiff) {
        minDiff = diff;
        best = i;
      }
    }
    return best;
  };

  const startXIdx = findXIdx(startPt.x);
  const startYIdx = findYIdx(startPt.y);
  const endXIdx = findXIdx(endPt.x);
  const endYIdx = findYIdx(endPt.y);

  // A* Search on Grid
  type NodeKey = string;
  const startKey: NodeKey = `${startXIdx},${startYIdx},0`;

  interface PriorityItem {
    xIdx: number;
    yIdx: number;
    dir: number; // 0: none, 1: horiz, 2: vert
    g: number;
    f: number;
  }

  const openQueue: PriorityItem[] = [
    {
      xIdx: startXIdx,
      yIdx: startYIdx,
      dir: 0,
      g: 0,
      f:
        Math.abs(cleanXs[startXIdx] - cleanXs[endXIdx]) +
        Math.abs(cleanYs[startYIdx] - cleanYs[endYIdx]),
    },
  ];

  const cameFrom = new Map<NodeKey, { xIdx: number; yIdx: number; dir: number }>();
  const gScore = new Map<NodeKey, number>();
  gScore.set(startKey, 0);

  let goalNodeKey: NodeKey | null = null;
  const visited = new Set<NodeKey>();

  let iterations = 0;
  const maxIterations = 3500;

  while (openQueue.length > 0 && iterations++ < maxIterations) {
    openQueue.sort((a, b) => a.f - b.f);
    const curr = openQueue.shift()!;
    const currKey: NodeKey = `${curr.xIdx},${curr.yIdx},${curr.dir}`;

    if (visited.has(currKey)) continue;
    visited.add(currKey);

    if (curr.xIdx === endXIdx && curr.yIdx === endYIdx) {
      goalNodeKey = currKey;
      break;
    }

    const curX = cleanXs[curr.xIdx];
    const curY = cleanYs[curr.yIdx];

    const neighbors: Array<{ nxIdx: number; nyIdx: number; newDir: number }> = [];
    if (curr.xIdx > 0) neighbors.push({ nxIdx: curr.xIdx - 1, nyIdx: curr.yIdx, newDir: 1 });
    if (curr.xIdx < cleanXs.length - 1) neighbors.push({ nxIdx: curr.xIdx + 1, nyIdx: curr.yIdx, newDir: 1 });
    if (curr.yIdx > 0) neighbors.push({ nxIdx: curr.xIdx, nyIdx: curr.yIdx - 1, newDir: 2 });
    if (curr.yIdx < cleanYs.length - 1) neighbors.push({ nxIdx: curr.xIdx, nyIdx: curr.yIdx + 1, newDir: 2 });

    for (const nb of neighbors) {
      const nextX = cleanXs[nb.nxIdx];
      const nextY = cleanYs[nb.nyIdx];
      const pA = { x: curX, y: curY };
      const pB = { x: nextX, y: nextY };

      let collidesWithObs = false;
      for (const b of relevantObstacles) {
        if (segmentIntersectsBox(pA, pB, b, 2)) {
          collidesWithObs = true;
          break;
        }
      }
      if (collidesWithObs) continue;

      const segDist = Math.abs(nextX - curX) + Math.abs(nextY - curY);
      const isTurn = curr.dir !== 0 && curr.dir !== nb.newDir;
      const turnPenalty = isTurn ? 36 : 0;
      const tentativeG = curr.g + segDist + turnPenalty;

      const nbKey: NodeKey = `${nb.nxIdx},${nb.nyIdx},${nb.newDir}`;
      if (!gScore.has(nbKey) || tentativeG < gScore.get(nbKey)!) {
        gScore.set(nbKey, tentativeG);
        cameFrom.set(nbKey, { xIdx: curr.xIdx, yIdx: curr.yIdx, dir: curr.dir });
        const h = Math.abs(nextX - cleanXs[endXIdx]) + Math.abs(nextY - cleanYs[endYIdx]);
        openQueue.push({
          xIdx: nb.nxIdx,
          yIdx: nb.nyIdx,
          dir: nb.newDir,
          g: tentativeG,
          f: tentativeG + h,
        });
      }
    }
  }

  if (goalNodeKey) {
    const pathPoints: Point[] = [];
    let step: { xIdx: number; yIdx: number; dir: number } | undefined = {
      xIdx: parseInt(goalNodeKey.split(',')[0], 10),
      yIdx: parseInt(goalNodeKey.split(',')[1], 10),
      dir: parseInt(goalNodeKey.split(',')[2], 10),
    };

    while (step) {
      pathPoints.push({ x: cleanXs[step.xIdx], y: cleanYs[step.yIdx] });
      const prev = cameFrom.get(`${step.xIdx},${step.yIdx},${step.dir}`);
      step = prev;
    }

    pathPoints.reverse();
    return simplifyCollinear(pathPoints);
  }

  // Guaranteed Bypass Fallback around bounding box of relevant obstacles
  if (relevantObstacles.length > 0) {
    const uMinX = Math.min(...relevantObstacles.map((b) => b.minX));
    const uMaxX = Math.max(...relevantObstacles.map((b) => b.maxX));
    const uMinY = Math.min(...relevantObstacles.map((b) => b.minY));
    const uMaxY = Math.max(...relevantObstacles.map((b) => b.maxY));

    const candidateBypasses: Point[][] = [
      // Top corridor
      [startPt, { x: startPt.x, y: uMinY - margin }, { x: endPt.x, y: uMinY - margin }, endPt],
      // Bottom corridor
      [startPt, { x: startPt.x, y: uMaxY + margin }, { x: endPt.x, y: uMaxY + margin }, endPt],
      // Left corridor
      [startPt, { x: uMinX - margin, y: startPt.y }, { x: uMinX - margin, y: endPt.y }, endPt],
      // Right corridor
      [startPt, { x: uMaxX + margin, y: startPt.y }, { x: uMaxX + margin, y: endPt.y }, endPt],
    ];

    let bestBypass: Point[] = candidateBypasses[0];
    let minCollisions = Infinity;
    let minLength = Infinity;

    for (const cand of candidateBypasses) {
      let colls = 0;
      let len = 0;
      for (let i = 0; i < cand.length - 1; i++) {
        len += Math.hypot(cand[i + 1].x - cand[i].x, cand[i + 1].y - cand[i].y);
        for (const b of relevantObstacles) {
          if (segmentIntersectsBox(cand[i], cand[i + 1], b, 2)) colls++;
        }
      }
      if (colls < minCollisions || (colls === minCollisions && len < minLength)) {
        minCollisions = colls;
        minLength = len;
        bestBypass = cand;
      }
    }
    return simplifyCollinear(bestBypass);
  }

  return [startPt, { x: endPt.x, y: startPt.y }, endPt];
}

/**
 * Smart Orthogonal Router with Obstacle Avoidance and Waypoint Handling
 */
export function routeOrthogonalThroughWaypoints(
  p1: Point,
  fromSide: AnchorSide,
  p2: Point,
  toSide: AnchorSide,
  waypoints: Point[] = [],
  obstacles: Box[] = [],
  fromNormal?: Point,
  toNormal?: Point
): Point[] {
  const n1 = fromNormal || getSideNormal(fromSide);
  const n2 = toNormal || getSideNormal(toSide);

  // Filter out obstacles that enclose both endpoints (e.g. container shapes like swimlanes or frames)
  const effectiveObstacles = (obstacles || []).filter((b) => {
    const enclosesP1 =
      p1.x >= b.minX - 2 &&
      p1.x <= b.maxX + 2 &&
      p1.y >= b.minY - 2 &&
      p1.y <= b.maxY + 2;
    const enclosesP2 =
      p2.x >= b.minX - 2 &&
      p2.x <= b.maxX + 2 &&
      p2.y >= b.minY - 2 &&
      p2.y <= b.maxY + 2;
    if (enclosesP1 && enclosesP2) return false;
    return true;
  });

  // If no waypoints and no obstacles, use direct path
  if ((!waypoints || waypoints.length === 0) && (!effectiveObstacles || effectiveObstacles.length === 0)) {
    return getDirectOrthogonalPath(p1, fromSide, p2, toSide, 24, n1, n2);
  }

  // If no waypoints, check if direct path is collision-free
  if (!waypoints || waypoints.length === 0) {
    const directPath = getDirectOrthogonalPath(p1, fromSide, p2, toSide, 24, n1, n2);
    let collides = false;
    for (let i = 0; i < directPath.length - 1; i++) {
      for (const b of effectiveObstacles) {
        if (segmentIntersectsBox(directPath[i], directPath[i + 1], b, 2)) {
          collides = true;
          break;
        }
      }
      if (collides) break;
    }
    if (!collides) {
      return directPath;
    }
  }

  const margin = 24;

  const isP1Free = n1.x === 0 && n1.y === 0;
  const isP2Free = n2.x === 0 && n2.y === 0;

  const p1Out: Point = isP1Free
    ? p1
    : {
        x: p1.x + n1.x * margin,
        y: p1.y + n1.y * margin,
      };
  const p2Out: Point = isP2Free
    ? p2
    : {
        x: p2.x + n2.x * margin,
        y: p2.y + n2.y * margin,
      };

  // Sanitize waypoints so they never land inside an obstacle
  const cleanWps = (waypoints || []).map((w) => {
    let pt = { ...w };
    for (const b of effectiveObstacles) {
      if (pt.x > b.minX && pt.x < b.maxX && pt.y > b.minY && pt.y < b.maxY) {
        const dL = Math.abs(pt.x - b.minX);
        const dR = Math.abs(b.maxX - pt.x);
        const dT = Math.abs(pt.y - b.minY);
        const dB = Math.abs(b.maxY - pt.y);
        const m = Math.min(dL, dR, dT, dB);
        if (m === dL) pt.x = b.minX - margin;
        else if (m === dR) pt.x = b.maxX + margin;
        else if (m === dT) pt.y = b.minY - margin;
        else pt.y = b.maxY + margin;
      }
    }
    return pt;
  });

  const fullPath: Point[] = [p1];
  const targets = [p1Out, ...cleanWps, p2Out];

  let curPt = p1;
  let lastDir: 'none' | 'horiz' | 'vert' = 'none';

  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    if (i === 0) {
      if (!isP1Free && (p1.x !== target.x || p1.y !== target.y)) {
        fullPath.push(target);
        lastDir = n1.x !== 0 ? 'horiz' : 'vert';
      }
      curPt = target;
      continue;
    }

    const collidesWithObs = (pA: Point, pB: Point): boolean => {
      for (const b of effectiveObstacles) {
        if (segmentIntersectsBox(pA, pB, b, 2)) return true;
      }
      return false;
    };

    const isDirectVert = Math.abs(curPt.x - target.x) <= 2;
    const isDirectHoriz = Math.abs(curPt.y - target.y) <= 2;

    if (isDirectVert && !collidesWithObs(curPt, { x: curPt.x, y: target.y })) {
      fullPath.push({ x: curPt.x, y: target.y });
      curPt = { x: curPt.x, y: target.y };
      lastDir = 'vert';
      continue;
    }
    if (isDirectHoriz && !collidesWithObs(curPt, { x: target.x, y: curPt.y })) {
      fullPath.push({ x: target.x, y: curPt.y });
      curPt = { x: target.x, y: curPt.y };
      lastDir = 'horiz';
      continue;
    }

    // Different axis (or direct line blocked by obstacle) -> try candidate 90-degree corners!
    const cand1: Point[] = [curPt, { x: target.x, y: curPt.y }, target]; // horiz then vert
    const cand2: Point[] = [curPt, { x: curPt.x, y: target.y }, target]; // vert then horiz

    const candCollides = (cand: Point[]): boolean => {
      for (let s = 0; s < cand.length - 1; s++) {
        if (collidesWithObs(cand[s], cand[s + 1])) return true;
      }
      return false;
    };

    let prefer1 = true;
    if (i === 1 && !isP1Free) {
      prefer1 = n1.x !== 0;
    } else if (lastDir === 'horiz') {
      prefer1 = false; // Arrived horizontally: must turn and leave vertically (cand2)
    } else if (lastDir === 'vert') {
      prefer1 = true; // Arrived vertically: must turn and leave horizontally (cand1)
    } else if (i === targets.length - 1 && !isP2Free) {
      prefer1 = n2.y !== 0;
    } else {
      prefer1 = Math.abs(target.x - curPt.x) >= Math.abs(target.y - curPt.y);
    }

    const firstCand = prefer1 ? cand1 : cand2;
    const secondCand = prefer1 ? cand2 : cand1;

    if (!candCollides(firstCand)) {
      for (const pt of firstCand.slice(1)) fullPath.push(pt);
      lastDir = prefer1 ? 'vert' : 'horiz';
    } else if (!candCollides(secondCand)) {
      for (const pt of secondCand.slice(1)) fullPath.push(pt);
      lastDir = prefer1 ? 'horiz' : 'vert';
    } else {
      // Both collide: route around obstacles with A* channel search
      const leg = findGridPath(curPt, target, effectiveObstacles, margin);
      for (const pt of leg.slice(1)) fullPath.push(pt);
      lastDir = 'none';
    }

    curPt = target;
  }

  if (!isP2Free && (curPt.x !== p2.x || curPt.y !== p2.y)) {
    fullPath.push(p2);
  }

  return simplifyCollinear(fullPath);
}

/**
 * Smart Orthogonal Router with Obstacle Avoidance (A* shortest-path channel search)
 */
export function routeOrthogonalWithAvoidance(
  p1: Point,
  fromSide: AnchorSide,
  p2: Point,
  toSide: AnchorSide,
  obstacles: Box[] = [],
  fromNormal?: Point,
  toNormal?: Point
): Point[] {
  return routeOrthogonalThroughWaypoints(p1, fromSide, p2, toSide, [], obstacles, fromNormal, toNormal);
}



export function getSideNormal(side: AnchorSide): Point {
  switch (side) {
    case 'top':
      return { x: 0, y: -1 };
    case 'right':
      return { x: 1, y: 0 };
    case 'bottom':
      return { x: 0, y: 1 };
    case 'left':
      return { x: -1, y: 0 };
    default:
      return { x: 0, y: 0 };
  }
}

/**
 * Remove duplicate consecutive points or tiny jitter
 */
function simplifyPoints(points: Point[]): Point[] {
  if (points.length <= 1) return points;
  const result: Point[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const prev = result[result.length - 1];
    const curr = points[i];
    if (Math.hypot(curr.x - prev.x, curr.y - prev.y) > 0.5) {
      result.push(curr);
    }
  }
  return result;
}

/**
 * Turn orthogonal polyline into Miro-style smooth filleted path with rounded corners (r ~ 8px).
 */
export function pointsToFilletPath(points: Point[], radius: number = 8): string {
  const pts = simplifyPoints(points);
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  if (pts.length === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;

  let d = `M ${pts[0].x} ${pts[0].y}`;

  for (let i = 1; i < pts.length - 1; i++) {
    const pPrev = pts[i - 1];
    const pCurr = pts[i];
    const pNext = pts[i + 1];

    const dIn = Math.hypot(pCurr.x - pPrev.x, pCurr.y - pPrev.y);
    const dOut = Math.hypot(pNext.x - pCurr.x, pNext.y - pCurr.y);

    if (dIn < 0.5 || dOut < 0.5) {
      continue;
    }

    const uIn = { x: (pCurr.x - pPrev.x) / dIn, y: (pCurr.y - pPrev.y) / dIn };
    const uOut = { x: (pNext.x - pCurr.x) / dOut, y: (pNext.y - pCurr.y) / dOut };

    // Check if points are colinear (no turn needed)
    const dot = uIn.x * uOut.x + uIn.y * uOut.y;
    if (Math.abs(dot - 1) < 0.01) {
      continue;
    }

    // Clamp corner radius to half the shortest segment length
    const r = Math.min(radius, dIn / 2, dOut / 2);
    const tIn = {
      x: pCurr.x - uIn.x * r,
      y: pCurr.y - uIn.y * r,
    };
    const tOut = {
      x: pCurr.x + uOut.x * r,
      y: pCurr.y + uOut.y * r,
    };

    d += ` L ${Number(tIn.x.toFixed(2))} ${Number(tIn.y.toFixed(2))}`;
    d += ` Q ${Number(pCurr.x.toFixed(2))} ${Number(pCurr.y.toFixed(2))} ${Number(tOut.x.toFixed(2))} ${Number(tOut.y.toFixed(2))}`;
  }

  const pLast = pts[pts.length - 1];
  d += ` L ${pLast.x} ${pLast.y}`;

  return d;
}
