import { SwimlaneObject, SwimlaneLane, Point } from '@diagrammer/shared';

export interface SwimlaneComputedLane {
  id: string;
  title: string;
  color?: string;
  size?: number;
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  headerBounds: { x: number; y: number; width: number; height: number };
  bodyBounds: { x: number; y: number; width: number; height: number };
}

export interface SwimlaneDivider {
  id: string;
  type: 'pool-header' | 'lane-header-col' | 'lane';
  laneIndex?: number;
  orientation: 'horizontal' | 'vertical';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface SwimlaneLayout {
  headerBar: { x: number; y: number; width: number; height: number };
  headerCol: { x: number; y: number; width: number; height: number };
  lanes: SwimlaneComputedLane[];
  dividers: SwimlaneDivider[];
  totalWidth: number;
  totalHeight: number;
  poolHeaderHeight: number;
  headerColSize: number;
}

export function getSwimlaneLayout(swimlane: SwimlaneObject): SwimlaneLayout {
  const orientation = swimlane.orientation || 'horizontal';
  const isHorizontal = orientation === 'horizontal';
  const poolHeaderHeight = Math.max(24, Math.min(120, swimlane.headerSize ?? 34));
  const rawLanes = swimlane.lanes && swimlane.lanes.length > 0
    ? swimlane.lanes
    : [
        { id: 'lane-1', title: 'Lane 1' },
        { id: 'lane-2', title: 'Lane 2' },
        { id: 'lane-3', title: 'Lane 3' },
      ];

  const dividers: SwimlaneDivider[] = [];

  if (isHorizontal) {
    const headerColWidth = Math.max(60, Math.min(350, swimlane.headerColSize ?? 130));
    const availableLanesH = Math.max(rawLanes.length * 40, swimlane.height - poolHeaderHeight);

    // Calculate individual lane heights
    const explicitTotal = rawLanes.reduce((sum, l) => sum + (l.size ? Math.max(40, l.size) : 0), 0);
    const unassignedLanes = rawLanes.filter((l) => !l.size);
    const unassignedCount = unassignedLanes.length;
    const remainingH = Math.max(unassignedCount * 40, availableLanesH - explicitTotal);
    const defaultLaneH = unassignedCount > 0 ? remainingH / unassignedCount : 90;

    const computedLanes: SwimlaneComputedLane[] = [];
    let currentY = swimlane.y + poolHeaderHeight;

    for (let i = 0; i < rawLanes.length; i++) {
      const lane = rawLanes[i];
      const laneH = lane.size ? Math.max(40, lane.size) : defaultLaneH;

      computedLanes.push({
        id: lane.id,
        title: lane.title,
        color: lane.color,
        size: lane.size,
        index: i,
        x: swimlane.x,
        y: currentY,
        width: swimlane.width,
        height: laneH,
        headerBounds: {
          x: swimlane.x,
          y: currentY,
          width: headerColWidth,
          height: laneH,
        },
        bodyBounds: {
          x: swimlane.x + headerColWidth,
          y: currentY,
          width: Math.max(10, swimlane.width - headerColWidth),
          height: laneH,
        },
      });

      // Divider at bottom of this lane (between lanes)
      if (i < rawLanes.length - 1) {
        dividers.push({
          id: `divider-lane-${i}`,
          type: 'lane',
          laneIndex: i,
          orientation: 'horizontal',
          x1: swimlane.x,
          y1: currentY + laneH,
          x2: swimlane.x + swimlane.width,
          y2: currentY + laneH,
        });
      }

      currentY += laneH;
    }

    const totalCalculatedHeight = currentY - swimlane.y;

    // Divider at bottom of pool title bar
    dividers.push({
      id: 'divider-pool-header',
      type: 'pool-header',
      orientation: 'horizontal',
      x1: swimlane.x,
      y1: swimlane.y + poolHeaderHeight,
      x2: swimlane.x + swimlane.width,
      y2: swimlane.y + poolHeaderHeight,
    });

    // Divider at right of lane header column
    dividers.push({
      id: 'divider-lane-header-col',
      type: 'lane-header-col',
      orientation: 'vertical',
      x1: swimlane.x + headerColWidth,
      y1: swimlane.y + poolHeaderHeight,
      x2: swimlane.x + headerColWidth,
      y2: swimlane.y + totalCalculatedHeight,
    });

    return {
      headerBar: {
        x: swimlane.x,
        y: swimlane.y,
        width: swimlane.width,
        height: poolHeaderHeight,
      },
      headerCol: {
        x: swimlane.x,
        y: swimlane.y + poolHeaderHeight,
        width: headerColWidth,
        height: totalCalculatedHeight - poolHeaderHeight,
      },
      lanes: computedLanes,
      dividers,
      totalWidth: swimlane.width,
      totalHeight: totalCalculatedHeight,
      poolHeaderHeight,
      headerColSize: headerColWidth,
    };
  } else {
    // Vertical Swimlane
    const headerRowHeight = Math.max(24, Math.min(100, swimlane.headerColSize ?? 32));
    const availableLanesW = Math.max(rawLanes.length * 60, swimlane.width);

    // Calculate individual lane widths
    const explicitTotal = rawLanes.reduce((sum, l) => sum + (l.size ? Math.max(50, l.size) : 0), 0);
    const unassignedLanes = rawLanes.filter((l) => !l.size);
    const unassignedCount = unassignedLanes.length;
    const remainingW = Math.max(unassignedCount * 60, availableLanesW - explicitTotal);
    const defaultLaneW = unassignedCount > 0 ? remainingW / unassignedCount : 140;

    const computedLanes: SwimlaneComputedLane[] = [];
    let currentX = swimlane.x;
    const lanesY = swimlane.y + poolHeaderHeight;
    const lanesH = Math.max(40, swimlane.height - poolHeaderHeight);

    for (let i = 0; i < rawLanes.length; i++) {
      const lane = rawLanes[i];
      const laneW = lane.size ? Math.max(50, lane.size) : defaultLaneW;

      computedLanes.push({
        id: lane.id,
        title: lane.title,
        color: lane.color,
        size: lane.size,
        index: i,
        x: currentX,
        y: lanesY,
        width: laneW,
        height: lanesH,
        headerBounds: {
          x: currentX,
          y: lanesY,
          width: laneW,
          height: headerRowHeight,
        },
        bodyBounds: {
          x: currentX,
          y: lanesY + headerRowHeight,
          width: laneW,
          height: Math.max(10, lanesH - headerRowHeight),
        },
      });

      // Divider at right of this lane (between columns)
      if (i < rawLanes.length - 1) {
        dividers.push({
          id: `divider-lane-${i}`,
          type: 'lane',
          laneIndex: i,
          orientation: 'vertical',
          x1: currentX + laneW,
          y1: lanesY,
          x2: currentX + laneW,
          y2: swimlane.y + swimlane.height,
        });
      }

      currentX += laneW;
    }

    const totalCalculatedWidth = currentX - swimlane.x;

    // Divider at bottom of pool title bar
    dividers.push({
      id: 'divider-pool-header',
      type: 'pool-header',
      orientation: 'horizontal',
      x1: swimlane.x,
      y1: swimlane.y + poolHeaderHeight,
      x2: swimlane.x + totalCalculatedWidth,
      y2: swimlane.y + poolHeaderHeight,
    });

    // Divider at bottom of column headers row
    dividers.push({
      id: 'divider-lane-header-col',
      type: 'lane-header-col',
      orientation: 'horizontal',
      x1: swimlane.x,
      y1: swimlane.y + poolHeaderHeight + headerRowHeight,
      x2: swimlane.x + totalCalculatedWidth,
      y2: swimlane.y + poolHeaderHeight + headerRowHeight,
    });

    return {
      headerBar: {
        x: swimlane.x,
        y: swimlane.y,
        width: totalCalculatedWidth,
        height: poolHeaderHeight,
      },
      headerCol: {
        x: swimlane.x,
        y: swimlane.y + poolHeaderHeight,
        width: totalCalculatedWidth,
        height: headerRowHeight,
      },
      lanes: computedLanes,
      dividers,
      totalWidth: totalCalculatedWidth,
      totalHeight: swimlane.height,
      poolHeaderHeight,
      headerColSize: headerRowHeight,
    };
  }
}
