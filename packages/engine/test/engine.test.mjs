import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import jitiModule from 'jiti';

const jiti = jitiModule(import.meta.url);

// Load engine modules
const {
  screenToWorld,
  worldToScreen,
  clampZoom,
  zoomAtScreenPoint,
  snapPointToGrid,
  getAdaptiveGridParams,
  ROTATION_HANDLE_OFFSET,
  getShapeSvgData,
  getShapeAnchors,
  getNearestAnchor,
  getShapeHandles,
  calculateResize,
  calculateRotation,
  calculateAlignment,
  calculateDistribution,
  pointsToSvgPath,
  computeDrawingBounds,
  calculateConnectorRoute,
  SpatialIndex,
  AddObjectsCommand,
  DeleteObjectsCommand,
  UpdateObjectsCommand,
  ReorderCommand,
  CommandManager,
  DocumentStore,
  calculateSnapGuides,
  parseRichText,
  parseInlineSpans,
  toggleInlineFormat,
  toggleListFormat,
  handleListAutoContinue,
  pointsToFilletPath,
  segmentIntersectsBox,
  simplifyCollinear,
  combineParallelAnchors,
  getSwimlaneLayout,
} = jiti('../src/index.ts');

// Load templates from web store
const { TEMPLATES } = jiti('../../../apps/web/src/stores/templates.ts');

function assertApprox(actual, expected, tolerance = 1e-4, msg = '') {
  const diff = Math.abs(actual - expected);
  assert.ok(
    diff <= tolerance,
    `${msg} Expected ${actual} to be close to ${expected} (diff: ${diff}, tolerance: ${tolerance})`
  );
}

describe('Viewport Transformations & Math', () => {
  describe('screenToWorld', () => {
    it('transforms screen origin at zoom 1.0 without pan', () => {
      const screenPt = { x: 100, y: 150 };
      const viewport = { x: 0, y: 0, zoom: 1.0 };
      const world = screenToWorld(screenPt, viewport);
      assert.deepEqual(world, { x: 100, y: 150 });
    });

    it('accounts for viewport panning offset', () => {
      const screenPt = { x: 300, y: 250 };
      const viewport = { x: 100, y: 50, zoom: 1.0 };
      const world = screenToWorld(screenPt, viewport);
      assert.deepEqual(world, { x: 200, y: 200 });
    });

    it('accounts for viewport zoom scale (zoom = 2.0)', () => {
      const screenPt = { x: 300, y: 250 };
      const viewport = { x: 100, y: 50, zoom: 2.0 };
      const world = screenToWorld(screenPt, viewport);
      assert.deepEqual(world, { x: 100, y: 100 });
    });

    it('handles fractional zoom and negative pan', () => {
      const screenPt = { x: 50, y: 25 };
      const viewport = { x: -50, y: -25, zoom: 0.5 };
      const world = screenToWorld(screenPt, viewport);
      assert.deepEqual(world, { x: 200, y: 100 });
    });
  });

  describe('worldToScreen', () => {
    it('transforms world point to screen at zoom 1.0 without pan', () => {
      const worldPt = { x: 150, y: 220 };
      const viewport = { x: 0, y: 0, zoom: 1.0 };
      const screen = worldToScreen(worldPt, viewport);
      assert.deepEqual(screen, { x: 150, y: 220 });
    });

    it('transforms world point with pan and zoom 1.5', () => {
      const worldPt = { x: 50, y: 40 };
      const viewport = { x: 200, y: 100, zoom: 1.5 };
      const screen = worldToScreen(worldPt, viewport);
      assert.deepEqual(screen, { x: 275, y: 160 });
    });

    it('is exact inverse of screenToWorld', () => {
      const originalScreen = { x: 423.5, y: 819.25 };
      const viewport = { x: 145.2, y: -78.6, zoom: 1.75 };
      const world = screenToWorld(originalScreen, viewport);
      const backToScreen = worldToScreen(world, viewport);
      assertApprox(backToScreen.x, originalScreen.x, 1e-9);
      assertApprox(backToScreen.y, originalScreen.y, 1e-9);
    });
  });

  describe('clampZoom', () => {
    it('returns zoom unchanged when within default range [0.1, 5.0]', () => {
      assert.equal(clampZoom(1.0), 1.0);
      assert.equal(clampZoom(0.5), 0.5);
      assert.equal(clampZoom(4.2), 4.2);
    });

    it('clamps zoom below minimum default (0.1)', () => {
      assert.equal(clampZoom(0.01), 0.1);
      assert.equal(clampZoom(-2.5), 0.1);
      assert.equal(clampZoom(0), 0.1);
    });

    it('clamps zoom above maximum default (5.0)', () => {
      assert.equal(clampZoom(5.01), 5.0);
      assert.equal(clampZoom(100), 5.0);
    });

    it('respects custom min and max parameters', () => {
      assert.equal(clampZoom(0.2, 0.5, 3.0), 0.5);
      assert.equal(clampZoom(4.0, 0.5, 3.0), 3.0);
      assert.equal(clampZoom(1.8, 0.5, 3.0), 1.8);
    });
  });

  describe('zoomAtScreenPoint', () => {
    it('keeps the world coordinate under the mouse cursor invariant during zoom-in', () => {
      const initialViewport = { x: 50, y: 80, zoom: 1.0 };
      const cursorScreen = { x: 300, y: 400 };

      // World point before zoom
      const worldBefore = screenToWorld(cursorScreen, initialViewport);

      // Zoom in by factor 1.5
      const newViewport = zoomAtScreenPoint(initialViewport, cursorScreen, 1.5);
      assert.equal(newViewport.zoom, 1.5);

      // World point under cursor must remain identical
      const worldAfter = screenToWorld(cursorScreen, newViewport);
      assertApprox(worldAfter.x, worldBefore.x, 1e-9);
      assertApprox(worldAfter.y, worldBefore.y, 1e-9);
    });

    it('keeps the world coordinate under cursor invariant during zoom-out', () => {
      const initialViewport = { x: -120, y: 200, zoom: 2.0 };
      const cursorScreen = { x: 500, y: 300 };

      const worldBefore = screenToWorld(cursorScreen, initialViewport);
      const newViewport = zoomAtScreenPoint(initialViewport, cursorScreen, 0.5);
      assert.equal(newViewport.zoom, 1.0);

      const worldAfter = screenToWorld(cursorScreen, newViewport);
      assertApprox(worldAfter.x, worldBefore.x, 1e-9);
      assertApprox(worldAfter.y, worldBefore.y, 1e-9);
    });

    it('enforces zoom boundaries when zooming beyond maximum (5.0)', () => {
      const initialViewport = { x: 0, y: 0, zoom: 4.0 };
      const cursorScreen = { x: 200, y: 200 };
      const newViewport = zoomAtScreenPoint(initialViewport, cursorScreen, 3.0);
      assert.equal(newViewport.zoom, 5.0);
    });
  });

  describe('snapPointToGrid', () => {
    it('snaps coordinates to default 10px grid increments', () => {
      assert.deepEqual(snapPointToGrid({ x: 14, y: 26 }), { x: 10, y: 30 });
      assert.deepEqual(snapPointToGrid({ x: 15, y: 25 }), { x: 20, y: 30 });
      assert.deepEqual(snapPointToGrid({ x: 0, y: 0 }), { x: 0, y: 0 });
    });

    it('handles negative coordinates correctly', () => {
      assert.deepEqual(snapPointToGrid({ x: -14, y: -26 }), { x: -10, y: -30 });
      assert.deepEqual(snapPointToGrid({ x: -15, y: -25 }), { x: -10, y: -20 });
    });

    it('supports custom grid sizes (e.g., 25px)', () => {
      assert.deepEqual(snapPointToGrid({ x: 37, y: 63 }, 25), { x: 25, y: 75 });
      assert.deepEqual(snapPointToGrid({ x: 12, y: 88 }, 25), { x: 0, y: 100 });
    });
  });

  describe('getAdaptiveGridParams', () => {
    it('uses large 100px step for distant zoom (< 0.25)', () => {
      const params = getAdaptiveGridParams(0.2);
      assert.equal(params.step, 100);
      assertApprox(params.opacity, 0.12, 1e-4);
    });

    it('uses medium 50px step for zoom in [0.25, 0.6)', () => {
      const params = getAdaptiveGridParams(0.5);
      assert.equal(params.step, 50);
      assertApprox(params.opacity, 0.125, 1e-4);
    });

    it('uses standard 20px step for regular zoom in [0.6, 2.0]', () => {
      const params = getAdaptiveGridParams(1.0);
      assert.equal(params.step, 20);
      assertApprox(params.opacity, 0.25, 1e-4);
    });

    it('uses fine 10px step for close-up zoom (> 2.0)', () => {
      const params = getAdaptiveGridParams(3.0);
      assert.equal(params.step, 10);
      assertApprox(params.opacity, 0.4, 1e-4);
    });
  });
});

describe('Geometry & Shapes', () => {
  describe('getShapeSvgData for all 10 ShapeKind types', () => {
    const kinds = [
      'rectangle',
      'rounded-rectangle',
      'ellipse',
      'diamond',
      'triangle',
      'parallelogram',
      'cylinder',
      'document',
      'hexagon',
      'cloud',
    ];

    it('rectangle returns rect type', () => {
      const data = getShapeSvgData('rectangle', 10, 20, 100, 80);
      assert.deepEqual(data, { type: 'rect' });
    });

    it('rounded-rectangle returns rect type', () => {
      const data = getShapeSvgData('rounded-rectangle', 10, 20, 100, 80, 12);
      assert.deepEqual(data, { type: 'rect' });
    });

    it('ellipse returns ellipse type', () => {
      const data = getShapeSvgData('ellipse', 10, 20, 100, 80);
      assert.deepEqual(data, { type: 'ellipse' });
    });

    it('diamond generates diamond path data with 4 vertices', () => {
      const data = getShapeSvgData('diamond', 0, 0, 100, 100);
      assert.equal(data.type, 'path');
      assert.ok(data.pathData.includes('M 50 0'));
      assert.ok(data.pathData.includes('L 100 50'));
      assert.ok(data.pathData.includes('L 50 100'));
      assert.ok(data.pathData.includes('L 0 50'));
    });

    it('triangle generates apex at top-center and base at bottom', () => {
      const data = getShapeSvgData('triangle', 10, 20, 100, 80);
      assert.equal(data.type, 'path');
      assert.ok(data.pathData.includes('M 60 20'));
      assert.ok(data.pathData.includes('L 110 100'));
      assert.ok(data.pathData.includes('L 10 100'));
    });

    it('parallelogram generates angled slant', () => {
      const data = getShapeSvgData('parallelogram', 0, 0, 100, 50);
      assert.equal(data.type, 'path');
      assert.ok(data.pathData.includes('M 20 0'));
      assert.ok(data.pathData.includes('L 100 0'));
      assert.ok(data.pathData.includes('L 80 50'));
      assert.ok(data.pathData.includes('L 0 50'));
    });

    it('cylinder generates cylindrical arc tops and bottom', () => {
      const data = getShapeSvgData('cylinder', 50, 50, 120, 100);
      assert.equal(data.type, 'path');
      assert.ok(data.pathData.includes('A 60'));
    });

    it('document generates wavy bottom border', () => {
      const data = getShapeSvgData('document', 0, 0, 100, 100);
      assert.equal(data.type, 'path');
      assert.ok(data.pathData.includes('Q '));
      assert.ok(data.pathData.includes('T '));
    });

    it('hexagon generates 6-vertex polygon path', () => {
      const data = getShapeSvgData('hexagon', 0, 0, 100, 80);
      assert.equal(data.type, 'path');
      assert.ok(data.pathData.includes('M 25 0'));
      assert.ok(data.pathData.includes('L 75 0'));
      assert.ok(data.pathData.includes('L 100 40'));
      assert.ok(data.pathData.includes('L 75 80'));
      assert.ok(data.pathData.includes('L 25 80'));
      assert.ok(data.pathData.includes('L 0 40'));
    });

    it('cloud generates multi-arc path', () => {
      const data = getShapeSvgData('cloud', 0, 0, 120, 90);
      assert.equal(data.type, 'path');
      const arcMatches = data.pathData.match(/A /g);
      assert.ok(arcMatches && arcMatches.length >= 4);
    });

    it('fallback unknown kind generates rect path', () => {
      const data = getShapeSvgData('custom-unknown-shape', 10, 20, 50, 40);
      assert.equal(data.type, 'path');
      assert.ok(data.pathData.includes('M 10 20'));
      assert.ok(data.pathData.includes('h 50 v 40'));
    });

    it('all 10 ShapeKind types produce valid SVG definitions', () => {
      for (const kind of kinds) {
        const res = getShapeSvgData(kind, 10, 10, 100, 100);
        assert.ok(['rect', 'ellipse', 'path'].includes(res.type));
        if (res.type === 'path') {
          assert.ok(res.pathData && res.pathData.length > 0);
        }
      }
    });
  });

  describe('getShapeAnchors', () => {
    it('calculates unrotated top, right, bottom, left anchors and normals', () => {
      const shape = {
        id: 's1',
        type: 'shape',
        kind: 'rectangle',
        x: 100,
        y: 200,
        width: 80,
        height: 60,
        style: {},
        textStyle: {},
      };

      const anchors = getShapeAnchors(shape);
      assert.deepEqual(anchors.top, {
        side: 'top',
        pos: { x: 140, y: 200 },
        normal: { x: 0, y: -1 },
      });
      assert.deepEqual(anchors.right, {
        side: 'right',
        pos: { x: 180, y: 230 },
        normal: { x: 1, y: 0 },
      });
      assert.deepEqual(anchors.bottom, {
        side: 'bottom',
        pos: { x: 140, y: 260 },
        normal: { x: 0, y: 1 },
      });
      assert.deepEqual(anchors.left, {
        side: 'left',
        pos: { x: 100, y: 230 },
        normal: { x: -1, y: 0 },
      });
    });

    it('calculates rotated anchors at 90 degrees clockwise', () => {
      // Shape center is at (140, 230). Top anchor was (140, 200), dx=0, dy=-30.
      // Rotated 90 deg clockwise: dx' = 30, dy' = 0 -> (170, 230).
      const shape = {
        id: 's1',
        type: 'shape',
        kind: 'rectangle',
        x: 100,
        y: 200,
        width: 80,
        height: 60,
        rotation: 90,
        style: {},
        textStyle: {},
      };

      const anchors = getShapeAnchors(shape);
      assertApprox(anchors.top.pos.x, 170);
      assertApprox(anchors.top.pos.y, 230);
      assertApprox(anchors.right.pos.x, 140);
      assertApprox(anchors.right.pos.y, 270);
    });
  });

  describe('getNearestAnchor', () => {
    const shape = {
      id: 's1',
      type: 'shape',
      kind: 'rectangle',
      x: 100,
      y: 100,
      width: 100,
      height: 100,
      style: {},
      textStyle: {},
    };

    it('finds closest anchor when within maxDistance', () => {
      // Near top anchor (150, 100)
      const hit = getNearestAnchor({ x: 152, y: 103 }, shape, 40);
      assert.ok(hit);
      assert.equal(hit.side, 'top');
      assertApprox(hit.distance, Math.hypot(2, 3));
    });

    it('returns null when test point is beyond maxDistance', () => {
      const hit = getNearestAnchor({ x: 500, y: 500 }, shape, 40);
      assert.equal(hit, null);
    });
  });

  describe('getShapeHandles', () => {
    it('returns 8 resize handles and 1 rotation handle with correct coordinates', () => {
      const obj = { x: 50, y: 50, width: 100, height: 80 };
      const handles = getShapeHandles(obj);

      assert.equal(handles.length, 9);
      const types = handles.map((h) => h.type);
      assert.deepEqual(types, ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w', 'rotate']);

      // Check nw handle (50, 50)
      const nw = handles.find((h) => h.type === 'nw');
      assert.deepEqual(nw.worldPos, { x: 50, y: 50 });
      assert.equal(nw.cursor, 'nwse-resize');

      // Check se handle (150, 130)
      const se = handles.find((h) => h.type === 'se');
      assert.deepEqual(se.worldPos, { x: 150, y: 130 });
      assert.equal(se.cursor, 'nwse-resize');

      // Check rotation handle (cx=100, y=50 - ROTATION_HANDLE_OFFSET = 26)
      const rotate = handles.find((h) => h.type === 'rotate');
      assert.deepEqual(rotate.worldPos, { x: 100, y: 50 - ROTATION_HANDLE_OFFSET });
      assert.equal(rotate.cursor, 'grab');
    });

    it('rotates handle positions when object has non-zero rotation', () => {
      const obj = { x: 100, y: 100, width: 100, height: 100, rotation: 180 };
      const handles = getShapeHandles(obj);

      // Center is (150, 150). 'nw' was (100, 100), after 180 deg becomes (200, 200).
      const nw = handles.find((h) => h.type === 'nw');
      assertApprox(nw.worldPos.x, 200);
      assertApprox(nw.worldPos.y, 200);
    });
  });

  describe('calculateResize', () => {
    const initial = { x: 100, y: 100, width: 100, height: 80 };

    it('expands width and height when dragging SE handle', () => {
      const result = calculateResize(initial, 'se', { x: 250, y: 220 }, false);
      assert.equal(result.x, 100);
      assert.equal(result.y, 100);
      assert.equal(result.width, 150);
      assert.equal(result.height, 120);
    });

    it('shifts x and y when dragging NW handle while keeping SE corner fixed', () => {
      const result = calculateResize(initial, 'nw', { x: 70, y: 60 }, false);
      assert.equal(result.x, 70);
      assert.equal(result.y, 60);
      assert.equal(result.width, 130);
      assert.equal(result.height, 120);
    });

    it('enforces minSize (20px) clamping when collapsing shape inwards', () => {
      const result = calculateResize(initial, 'se', { x: 105, y: 105 }, false);
      assert.equal(result.width, 20);
      assert.equal(result.height, 20);
    });

    it('maintains aspect ratio when keepAspect is true', () => {
      // Initial ratio: 100 / 80 = 1.25
      const result = calculateResize(initial, 'se', { x: 300, y: 200 }, true);
      // width: 200, height: 100 -> ratio 2.0 > 1.25 -> width adjusted to 100 * 1.25 = 125
      assert.equal(result.height, 100);
      assert.equal(result.width, 125);
      assert.equal(result.width / result.height, 1.25);
    });
  });

  describe('calculateRotation', () => {
    const shape = { x: 100, y: 100, width: 100, height: 100 }; // Center: (150, 150)

    it('calculates 0 degrees directly above center', () => {
      const deg = calculateRotation(shape, { x: 150, y: 50 });
      assert.equal(deg, 0);
    });

    it('calculates 90 degrees directly right of center', () => {
      const deg = calculateRotation(shape, { x: 250, y: 150 });
      assert.equal(deg, 90);
    });

    it('calculates 180 degrees directly below center', () => {
      const deg = calculateRotation(shape, { x: 150, y: 250 });
      assert.equal(deg, 180);
    });

    it('calculates 270 degrees directly left of center', () => {
      const deg = calculateRotation(shape, { x: 50, y: 150 });
      assert.equal(deg, 270);
    });

    it('snaps angles to nearest 15-degree increment when snap15 is true', () => {
      // dx = 100, dy = -100 -> -45 + 90 = 45 deg
      assert.equal(calculateRotation(shape, { x: 250, y: 50 }, true), 45);

      // dx = 100, dy = -15 -> atan2(-15, 100) ~ -8.53 deg + 90 = 81.47 deg -> snaps to 75 or 90
      const deg81 = calculateRotation(shape, { x: 250, y: 135 }, true);
      assert.equal(deg81 % 15, 0);
    });
  });

  describe('calculateAlignment', () => {
    const objects = [
      { id: '1', x: 100, y: 50, width: 40, height: 30 },
      { id: '2', x: 200, y: 120, width: 60, height: 50 },
      { id: '3', x: 300, y: 80, width: 50, height: 40 },
    ];

    it('returns empty array if fewer than 2 objects are provided', () => {
      assert.deepEqual(calculateAlignment([objects[0]], 'left'), []);
    });

    it('aligns objects to left bounding edge', () => {
      const res = calculateAlignment(objects, 'left');
      assert.equal(res.length, 3);
      assert.ok(res.every((o) => o.x === 100));
    });

    it('aligns objects to right bounding edge', () => {
      // maxX = 300 + 50 = 350
      const res = calculateAlignment(objects, 'right');
      const o1 = res.find((r) => r.id === '1');
      assert.equal(o1.x, 350 - 40); // 310
    });

    it('aligns objects to horizontal center', () => {
      // minX = 100, maxX = 350, center = 100 + 125 = 225
      const res = calculateAlignment(objects, 'center');
      const o1 = res.find((r) => r.id === '1');
      assert.equal(o1.x, 225 - 40 / 2); // 205
    });

    it('aligns objects to top bounding edge', () => {
      const res = calculateAlignment(objects, 'top');
      assert.ok(res.every((o) => o.y === 50));
    });

    it('aligns objects to bottom bounding edge', () => {
      // maxY = 120 + 50 = 170
      const res = calculateAlignment(objects, 'bottom');
      const o1 = res.find((r) => r.id === '1');
      assert.equal(o1.y, 170 - 30); // 140
    });

    it('aligns objects to vertical middle', () => {
      // minY = 50, maxY = 170, mid = 50 + 60 = 110
      const res = calculateAlignment(objects, 'middle');
      const o1 = res.find((r) => r.id === '1');
      assert.equal(o1.y, 110 - 30 / 2); // 95
    });
  });

  describe('calculateDistribution', () => {
    it('returns empty array if fewer than 3 objects', () => {
      const objs = [
        { id: '1', x: 0, y: 0, width: 20, height: 20 },
        { id: '2', x: 100, y: 0, width: 20, height: 20 },
      ];
      assert.deepEqual(calculateDistribution(objs, 'horizontal'), []);
    });

    it('distributes 3 objects horizontally with equal spacing', () => {
      const objs = [
        { id: '1', x: 0, y: 10, width: 40, height: 30 },
        { id: '2', x: 80, y: 10, width: 40, height: 30 },
        { id: '3', x: 200, y: 10, width: 40, height: 30 },
      ];
      // Total span: 200 + 40 - 0 = 240
      // Total obj width: 40 + 40 + 40 = 120
      // Gap: (240 - 120) / 2 = 60
      // Pos 1: 0, Pos 2: 0 + 40 + 60 = 100, Pos 3: 100 + 40 + 60 = 200
      const res = calculateDistribution(objs, 'horizontal');
      assert.equal(res[0].x, 0);
      assert.equal(res[1].x, 100);
      assert.equal(res[2].x, 200);
    });

    it('distributes 3 objects vertically with equal spacing', () => {
      const objs = [
        { id: '1', x: 10, y: 0, width: 30, height: 20 },
        { id: '2', x: 10, y: 50, width: 30, height: 20 },
        { id: '3', x: 10, y: 160, width: 30, height: 20 },
      ];
      // Total span: 160 + 20 - 0 = 180
      // Total obj height: 60
      // Gap: (180 - 60) / 2 = 60
      // y1: 0, y2: 0 + 20 + 60 = 80, y3: 80 + 20 + 60 = 160
      const res = calculateDistribution(objs, 'vertical');
      assert.equal(res[0].y, 0);
      assert.equal(res[1].y, 80);
      assert.equal(res[2].y, 160);
    });
  });
});

describe('Connector Routing', () => {
  const fromAnchor = {
    side: 'right',
    pos: { x: 100, y: 100 },
    normal: { x: 1, y: 0 },
  };
  const toAnchor = {
    side: 'left',
    pos: { x: 300, y: 100 },
    normal: { x: -1, y: 0 },
  };

  it('straight routing produces M ... L segment with label at midpoint', () => {
    const route = calculateConnectorRoute(fromAnchor, toAnchor, 'straight');
    assert.equal(route.svgPath, 'M 100 100 L 300 100');
    assert.deepEqual(route.labelPosition, { x: 200, y: 100 - 12 });
  });

  it('orthogonal routing connects left-to-right with Manhattan stepped filleted segments', () => {
    const toOffset = {
      side: 'left',
      pos: { x: 300, y: 200 },
      normal: { x: -1, y: 0 },
    };
    const route = calculateConnectorRoute(fromAnchor, toOffset, 'orthogonal');
    assert.ok(route.svgPath.startsWith('M 100 100'));
    // Contains Q rounded fillet corner arcs
    assert.ok(route.svgPath.includes('Q 200 100'));
    assert.ok(route.svgPath.includes('Q 200 200'));
    assert.ok(route.svgPath.endsWith('L 300 200'));
    assert.ok(route.labelPosition.x > 0);
  });

  it('orthogonal routing handles arbitrary corner turns with normals', () => {
    const cornerFrom = {
      side: 'bottom',
      pos: { x: 100, y: 100 },
      normal: { x: 0, y: 1 },
    };
    const cornerTo = {
      side: 'bottom',
      pos: { x: 200, y: 100 },
      normal: { x: 0, y: 1 },
    };
    const route = calculateConnectorRoute(cornerFrom, cornerTo, 'orthogonal');
    assert.ok(route.svgPath.startsWith('M 100 100'));
    assert.ok(route.svgPath.includes('L '));
    assert.ok(route.labelPosition);
  });

  it('curved routing generates smooth Cubic Bezier with bezier midpoint formula', () => {
    const route = calculateConnectorRoute(fromAnchor, toAnchor, 'curved');
    assert.ok(route.svgPath.startsWith('M 100 100 C '));
    assert.ok(route.svgPath.endsWith(', 300 100'));
    assert.equal(route.labelPosition.x, 200);
    assertApprox(route.labelPosition.y, 100 - 14);
  });

  it('self-loop routing uses an elbow path outside the shape', () => {
    const selfA1 = {
      side: 'top',
      pos: { x: 120, y: 100 },
      normal: { x: 0, y: -1 },
    };
    const selfA2 = {
      side: 'right',
      pos: { x: 200, y: 150 },
      normal: { x: 1, y: 0 },
    };
    const bounds = { minX: 100, minY: 100, maxX: 200, maxY: 200 };

    const route = calculateConnectorRoute(
      selfA1,
      selfA2,
      'curved',
      [],
      true,
      bounds
    );
    const loopY = 100 - 35; // 65
    assert.equal(route.svgPath, 'M 120 100 L 120 73 Q 120 65 128 65 L 192 65 Q 200 65 200 73 L 200 150');
    assert.equal(route.svgPath.includes(' C '), false);
    assert.deepEqual(route.points, [
      { x: 120, y: 100 },
      { x: 120, y: loopY },
      { x: 200, y: loopY },
      { x: 200, y: 150 },
    ]);
    assert.deepEqual(route.labelPosition, {
      x: 185,
      y: loopY - 12,
    });
  });

  it('self-loop routing does not collapse into a straight line between opposite anchors', () => {
    const leftAnchor = {
      side: 'left',
      pos: { x: 100, y: 150 },
      normal: { x: -1, y: 0 },
    };
    const rightAnchor = {
      side: 'right',
      pos: { x: 300, y: 150 },
      normal: { x: 1, y: 0 },
    };
    const bounds = { minX: 100, minY: 100, maxX: 300, maxY: 200 };

    const route = calculateConnectorRoute(leftAnchor, rightAnchor, 'curved', [], true, bounds);

    assert.deepEqual(route.points, [
      { x: 100, y: 150 },
      { x: 100, y: 65 },
      { x: 300, y: 65 },
      { x: 300, y: 150 },
    ]);
    assert.equal(route.svgPath.includes(' C '), false);
    assert.equal(route.points.some((point) => point.y < bounds.minY), true);
  });

  it('straight routing routes sequentially through user waypoints', () => {
    const waypoints = [{ x: 150, y: 50 }, { x: 250, y: 150 }];
    const route = calculateConnectorRoute(fromAnchor, toAnchor, 'straight', waypoints);
    assert.equal(route.svgPath, 'M 100 100 L 150 50 L 250 150 L 300 100');
    assert.deepEqual(route.midpoint, { x: 250, y: 150 });
    assert.deepEqual(route.labelPosition, { x: 250, y: 150 - 12 });
  });

  it('curved routing routes through user waypoint anchor with exact midpoint quadratic curve', () => {
    const waypoint = [{ x: 200, y: 50 }];
    const route = calculateConnectorRoute(fromAnchor, toAnchor, 'curved', waypoint);
    // C = 2*(200, 50) - 0.5*((100,100) + (300,100)) = (400, 100) - (200, 100) = (200, 0)
    assert.equal(route.svgPath, 'M 100 100 Q 200 0 300 100');
    assert.deepEqual(route.midpoint, { x: 200, y: 50 });
    assert.deepEqual(route.labelPosition, { x: 200, y: 50 - 14 });
  });

  it('orthogonal routing routes with stepped segments through waypoint', () => {
    const waypoint = [{ x: 200, y: 50 }];
    const route = calculateConnectorRoute(fromAnchor, toAnchor, 'orthogonal', waypoint);
    assert.ok(route.svgPath.startsWith('M 100 100'));
    assert.ok(route.svgPath.includes('200'));
    assert.ok(route.svgPath.endsWith('L 300 100'));
    assert.deepEqual(route.midpoint, { x: 200, y: 50 });
  });

  describe('pointsToFilletPath', () => {
    it('returns empty string for empty points array', () => {
      assert.equal(pointsToFilletPath([]), '');
    });

    it('returns single line for 2 points', () => {
      assert.equal(pointsToFilletPath([{ x: 0, y: 0 }, { x: 100, y: 0 }]), 'M 0 0 L 100 0');
    });

    it('creates quadratic arc Q at 90-degree corner with default 8px radius', () => {
      const points = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }];
      const path = pointsToFilletPath(points, 8);
      // Stops at 100 - 8 = 92 on X, arcs around (100, 0) to (100, 8) on Y
      assert.equal(path, 'M 0 0 L 92 0 Q 100 0 100 8 L 100 100');
    });

    it('clamps fillet radius when segment length is shorter than 2 * radius', () => {
      // Segment from (10, 0) to (10, 10) is only 10px long -> r clamped to 10 / 2 = 5px
      const points = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
      const path = pointsToFilletPath(points, 8);
      assert.equal(path, 'M 0 0 L 5 0 Q 10 0 10 5 L 10 10');
    });
  });

  describe('segmentIntersectsBox', () => {
    const box = { minX: 100, minY: 100, maxX: 200, maxY: 200 };

    it('detects horizontal segment crossing box interior', () => {
      assert.equal(segmentIntersectsBox({ x: 50, y: 150 }, { x: 250, y: 150 }, box), true);
    });

    it('returns false for segment entirely outside box', () => {
      assert.equal(segmentIntersectsBox({ x: 50, y: 50 }, { x: 250, y: 50 }, box), false);
    });

    it('returns false for segment running along outer border of box', () => {
      assert.equal(segmentIntersectsBox({ x: 50, y: 100 }, { x: 250, y: 100 }, box), false);
    });

    it('detects vertical segment crossing box interior', () => {
      assert.equal(segmentIntersectsBox({ x: 150, y: 50 }, { x: 150, y: 250 }, box), true);
    });
  });

  describe('Obstacle Avoidance Orthogonal Routing', () => {
    it('routes around an obstacle shape in the direct path with zero collision', () => {
      const from = { side: 'right', pos: { x: 50, y: 150 }, normal: { x: 1, y: 0 } };
      const to = { side: 'left', pos: { x: 450, y: 150 }, normal: { x: -1, y: 0 } };
      // Shape directly blocking the horizontal corridor between x=200 and x=300 at y=150
      const obstacle = { minX: 200, minY: 100, maxX: 300, maxY: 200 };

      const route = calculateConnectorRoute(from, to, 'orthogonal', [], false, undefined, [obstacle]);
      assert.ok(route.points.length >= 4);

      // Verify no segment of the generated route intersects the obstacle interior
      for (let i = 0; i < route.points.length - 1; i++) {
        const pA = route.points[i];
        const pB = route.points[i + 1];
        assert.equal(
          segmentIntersectsBox(pA, pB, obstacle, 2),
          false,
          `Segment (${pA.x},${pA.y}) -> (${pB.x},${pB.y}) must not intersect obstacle`
        );
      }
    });

    it('routes cleanly around target shape when connecting same-side anchors (right-to-right)', () => {
      const from = { side: 'right', pos: { x: 150, y: 100 }, normal: { x: 1, y: 0 } };
      const to = { side: 'right', pos: { x: 350, y: 100 }, normal: { x: 1, y: 0 } };
      const targetShape = { minX: 250, minY: 60, maxX: 350, maxY: 140 };

      const route = calculateConnectorRoute(from, to, 'orthogonal', [], false, undefined, [targetShape]);
      assert.ok(route.svgPath.startsWith('M 150 100'));

      // Line must navigate around target shape without piercing its interior
      for (let i = 0; i < route.points.length - 1; i++) {
        const pA = route.points[i];
        const pB = route.points[i + 1];
        assert.equal(
          segmentIntersectsBox(pA, pB, targetShape, 2),
          false,
          `Segment (${pA.x},${pA.y}) -> (${pB.x},${pB.y}) must not intersect target shape`
        );
      }
    });

    it('chooses the closest distance path around asymmetric obstacles', () => {
      const from = { side: 'right', pos: { x: 50, y: 110 }, normal: { x: 1, y: 0 } };
      const to = { side: 'left', pos: { x: 450, y: 110 }, normal: { x: -1, y: 0 } };
      // Obstacle spans y from 100 to 250 -> going above (y < 100) is much closer than going below (y > 250)
      const obstacle = { minX: 180, minY: 100, maxX: 320, maxY: 250 };

      const route = calculateConnectorRoute(from, to, 'orthogonal', [], false, undefined, [obstacle]);
      // Should route above the obstacle (y <= 100 - margin)
      const minYInRoute = Math.min(...route.points.map((p) => p.y));
      assert.ok(minYInRoute <= 90, `Router should choose shorter top corridor: got min Y ${minYInRoute}`);
    });

    it('routes cleanly around shape without cutting through text/body when target is below and to the left (User screenshot case)', () => {
      // Exact scenario from user's flowchart: Diamond "Password Valid?" to Rectangle "Access Dashboard"
      const diamondBox = { minX: 440, minY: 165, maxX: 580, maxY: 285 };
      const rectBox = { minX: 440, minY: 450, maxX: 620, maxY: 540 };

      const fromAnchor = { side: 'right', pos: { x: 580, y: 225 }, normal: { x: 1, y: 0 } };
      const toAnchor = { side: 'left', pos: { x: 440, y: 495 }, normal: { x: -1, y: 0 } };

      const route = calculateConnectorRoute(fromAnchor, toAnchor, 'orthogonal', [], false, undefined, [
        diamondBox,
        rectBox,
      ]);

      assert.ok(route.points.length >= 4);

      // Verify ZERO segments cut through the target rectangle
      for (let i = 0; i < route.points.length - 1; i++) {
        const pA = route.points[i];
        const pB = route.points[i + 1];
        assert.equal(
          segmentIntersectsBox(pA, pB, rectBox, 2),
          false,
          `Segment (${pA.x},${pA.y}) -> (${pB.x},${pB.y}) must not cut through target rectangle body`
        );
        assert.equal(
          segmentIntersectsBox(pA, pB, diamondBox, 2),
          false,
          `Segment (${pA.x},${pA.y}) -> (${pB.x},${pB.y}) must not cut through diamond body`
        );
      }

      // Final segment approaching the left anchor must enter from the outside left (x <= 440)
      const secondToLast = route.points[route.points.length - 2];
      const last = route.points[route.points.length - 1];
      assert.equal(last.x, 440);
      assert.equal(last.y, 495);
      assert.ok(
        secondToLast.x < last.x,
        `Line approaching left anchor must come from the left (got x=${secondToLast.x}, target x=${last.x})`
      );
    });

    it('routes cleanly around rectangle when connecting to bottom anchor with a waypoint (User screenshot case)', () => {
      const diamondBox = { minX: 95, minY: 5, maxX: 310, maxY: 190 };
      const rectBox = { minX: 63, minY: 275, maxX: 341, maxY: 415 };

      const fromAnchor = { side: 'right', pos: { x: 310, y: 97 }, normal: { x: 1, y: 0 } };
      const toAnchor = { side: 'bottom', pos: { x: 202, y: 415 }, normal: { x: 0, y: 1 } };
      const waypoints = [{ x: 348, y: 309 }];

      const route = calculateConnectorRoute(fromAnchor, toAnchor, 'orthogonal', waypoints, false, undefined, [
        diamondBox,
        rectBox,
      ]);

      assert.ok(route.points.length >= 4);

      // Verify ZERO segments cut through the target rectangle or diamond
      for (let i = 0; i < route.points.length - 1; i++) {
        const pA = route.points[i];
        const pB = route.points[i + 1];
        assert.equal(
          segmentIntersectsBox(pA, pB, rectBox, 2),
          false,
          `Segment (${pA.x},${pA.y}) -> (${pB.x},${pB.y}) must not cut through target rectangle body`
        );
        assert.equal(
          segmentIntersectsBox(pA, pB, diamondBox, 2),
          false,
          `Segment (${pA.x},${pA.y}) -> (${pB.x},${pB.y}) must not cut through diamond body`
        );
      }

      // Approach into bottom anchor must come from below (y >= 415)
      const secondToLast = route.points[route.points.length - 2];
      const last = route.points[route.points.length - 1];
      assert.equal(last.x, 202);
      assert.equal(last.y, 415);
      assert.ok(
        secondToLast.y > last.y,
        `Approach into bottom anchor must come from below (got y=${secondToLast.y}, target y=${last.y})`
      );
    });

    it('sanitizes waypoints inside obstacles and prevents shape penetration', () => {
      const obstacle = { minX: 100, minY: 100, maxX: 200, maxY: 200 };
      const fromAnchor = { side: 'left', pos: { x: 50, y: 150 }, normal: { x: -1, y: 0 } };
      const toAnchor = { side: 'right', pos: { x: 250, y: 150 }, normal: { x: 1, y: 0 } };
      // Waypoint placed right inside the center of obstacle
      const waypoints = [{ x: 150, y: 150 }];

      const route = calculateConnectorRoute(fromAnchor, toAnchor, 'orthogonal', waypoints, false, undefined, [
        obstacle,
      ]);

      for (let i = 0; i < route.points.length - 1; i++) {
        const pA = route.points[i];
        const pB = route.points[i + 1];
        assert.equal(
          segmentIntersectsBox(pA, pB, obstacle, 2),
          false,
          `Segment (${pA.x},${pA.y}) -> (${pB.x},${pB.y}) must not intersect obstacle`
        );
      }
    });


    it('simplifies collinear vertical and horizontal runs cleanly', () => {
      const vertPoints = [
        { x: 100, y: 0 },
        { x: 100, y: 50 },
        { x: 100, y: 120 },
        { x: 100, y: 200 },
      ];
      const simplifiedVert = simplifyCollinear(vertPoints);
      assert.deepEqual(simplifiedVert, [
        { x: 100, y: 0 },
        { x: 100, y: 200 },
      ]);

      const horizPoints = [
        { x: 0, y: 50 },
        { x: 80, y: 50 },
        { x: 150, y: 50 },
      ];
      const simplifiedHoriz = simplifyCollinear(horizPoints);
      assert.deepEqual(simplifiedHoriz, [
        { x: 0, y: 50 },
        { x: 150, y: 50 },
      ]);
    });

    it('direct orthogonal routing respects anchor normal invariant without cutting through target shape', () => {
      // Even without obstacles array, direct path must loop around instead of penetrating target body
      const fromAnchor = { side: 'right', pos: { x: 580, y: 225 }, normal: { x: 1, y: 0 } };
      const toAnchor = { side: 'left', pos: { x: 440, y: 495 }, normal: { x: -1, y: 0 } };
      const targetBox = { minX: 440, minY: 450, maxX: 620, maxY: 540 };

      const route = calculateConnectorRoute(fromAnchor, toAnchor, 'orthogonal', []);
      for (let i = 0; i < route.points.length - 1; i++) {
        const pA = route.points[i];
        const pB = route.points[i + 1];
        assert.equal(
          segmentIntersectsBox(pA, pB, targetBox, 2),
          false,
          `Direct path segment (${pA.x},${pA.y}) -> (${pB.x},${pB.y}) must not cut through target shape`
        );
      }
    });

    it('snaps orthogonal connectors to a single straight line when opposite anchors are nearly aligned', () => {
      // Horizontal nearly aligned (e.g. y=100 and y=104, diff <= 8px)
      const fromH = { side: 'right', pos: { x: 100, y: 100 }, normal: { x: 1, y: 0 } };
      const toH = { side: 'left', pos: { x: 300, y: 104 }, normal: { x: -1, y: 0 } };
      const routeH = calculateConnectorRoute(fromH, toH, 'orthogonal', []);
      assert.equal(routeH.points.length, 2);
      assert.deepEqual(routeH.points[0], { x: 100, y: 100 });
      assert.deepEqual(routeH.points[1], { x: 300, y: 100 });
      assert.ok(routeH.svgPath.includes('M 100 100 L 300 100'));

      // Vertical nearly aligned (e.g. x=200 and x=205, diff <= 8px)
      const fromV = { side: 'bottom', pos: { x: 200, y: 100 }, normal: { x: 0, y: 1 } };
      const toV = { side: 'top', pos: { x: 205, y: 350 }, normal: { x: 0, y: -1 } };
      const routeV = calculateConnectorRoute(fromV, toV, 'orthogonal', []);
      assert.equal(routeV.points.length, 2);
      assert.deepEqual(routeV.points[0], { x: 200, y: 100 });
      assert.deepEqual(routeV.points[1], { x: 200, y: 350 });
      assert.ok(routeV.svgPath.includes('M 200 100 L 200 350'));
    });

    it('does not treat enclosing container (swimlane/frame) as obstacle between internal shapes', () => {
      // Shape 1 and Shape 2 inside Lane 1 of a 700x400 swimlane at (100, 100)
      // Swimlane box: x: 100, y: 100, width: 700, height: 400 (bounds 100..800, 100..500)
      const swimlaneObstacle = { minX: 100, minY: 100, maxX: 800, maxY: 500 };

      // Shape 1 at (200, 200, 120, 60), right anchor at (320, 230)
      const fromAnchor = { side: 'right', pos: { x: 320, y: 230 }, normal: { x: 1, y: 0 } };
      // Shape 2 at (450, 200, 120, 60), left anchor at (450, 230)
      const toAnchor = { side: 'left', pos: { x: 450, y: 230 }, normal: { x: -1, y: 0 } };

      const route = calculateConnectorRoute(fromAnchor, toAnchor, 'orthogonal', [], false, undefined, [swimlaneObstacle]);
      // Should route directly horizontally from 320,230 to 450,230
      // It must NOT loop above the swimlane (y < 100)
      for (const pt of route.points) {
        assert.ok(pt.y >= 200, `Point y=${pt.y} should not route above the container bounds (y < 100)`);
      }
      assert.equal(route.points.length, 2);
      assert.deepEqual(route.points[0], { x: 320, y: 230 });
      assert.deepEqual(route.points[1], { x: 450, y: 230 });
    });

    it('still routes around internal obstacles inside a container without escaping the container', () => {
      const containerBox = { minX: 0, minY: 0, maxX: 800, maxY: 600 };
      // Intermediate obstacle inside container between Shape 1 and Shape 2
      const obstacleBox = { minX: 350, minY: 200, maxX: 450, maxY: 300 };

      const fromAnchor = { side: 'right', pos: { x: 250, y: 250 }, normal: { x: 1, y: 0 } };
      const toAnchor = { side: 'left', pos: { x: 550, y: 250 }, normal: { x: -1, y: 0 } };

      const route = calculateConnectorRoute(fromAnchor, toAnchor, 'orthogonal', [], false, undefined, [containerBox, obstacleBox]);
      // Obstacle is avoided, but route stays inside the container (0 <= x <= 800, 0 <= y <= 600)
      for (const pt of route.points) {
        assert.ok(pt.x >= 0 && pt.x <= 800, `Point x=${pt.x} must stay within container bounds`);
        assert.ok(pt.y >= 0 && pt.y <= 600, `Point y=${pt.y} must stay within container bounds`);
      }
    });
  });

  describe('combineParallelAnchors', () => {
    it('combines multiple anchors on the same horizontal line into a single anchor', () => {
      const p1 = { x: 0, y: 0 };
      const p2 = { x: 400, y: 200 };
      const waypoints = [
        { x: 100, y: 100 },
        { x: 200, y: 100 },
        { x: 300, y: 100 },
      ];
      const combined = combineParallelAnchors(waypoints, p1, p2);
      // All 3 horizontal anchors at y=100 are combined into 1
      assert.equal(combined.length, 1);
      assert.equal(combined[0].y, 100);
      assert.ok(combined[0].x >= 100 && combined[0].x <= 300);
    });

    it('combines multiple anchors on the same vertical line into a single anchor', () => {
      const p1 = { x: 0, y: 0 };
      const p2 = { x: 200, y: 400 };
      const waypoints = [
        { x: 100, y: 100 },
        { x: 100, y: 200 },
        { x: 100, y: 300 },
      ];
      const combined = combineParallelAnchors(waypoints, p1, p2);
      // All 3 vertical anchors at x=100 are combined into 1
      assert.equal(combined.length, 1);
      assert.equal(combined[0].x, 100);
      assert.ok(combined[0].y >= 100 && combined[0].y <= 300);
    });

    it('merges adjacent anchors that are dragged together within 16px', () => {
      const p1 = { x: 0, y: 0 };
      const p2 = { x: 300, y: 0 };
      const waypoints = [
        { x: 100, y: 100 },
        { x: 108, y: 105 },
      ];
      const combined = combineParallelAnchors(waypoints, p1, p2);
      assert.equal(combined.length, 1);
      assert.deepEqual(combined[0], { x: 104, y: 103 });
    });

    it('removes flat redundant anchors that lie collinear between terminals', () => {
      const p1 = { x: 0, y: 100 };
      const p2 = { x: 400, y: 100 };
      const waypoints = [
        { x: 100, y: 100 },
        { x: 250, y: 100 },
      ];
      const combined = combineParallelAnchors(waypoints, p1, p2);
      // When whole line is straight, intermediate anchors dissolve
      assert.equal(combined.length, 0);
    });

    it('automatically combines parallel anchors during calculateConnectorRoute', () => {
      const from = { side: 'right', pos: { x: 0, y: 0 }, normal: { x: 1, y: 0 } };
      const to = { side: 'left', pos: { x: 400, y: 200 }, normal: { x: -1, y: 0 } };
      const waypoints = [
        { x: 100, y: 100 },
        { x: 200, y: 100 },
      ];
      const route = calculateConnectorRoute(from, to, 'straight', waypoints);
      // 2 waypoints on same line are combined
      assert.ok(route.points.length < 4);
    });

    it('absorbs and removes waypoints dragged within 28px of terminal endpoints (Rule 3)', () => {
      const p1 = { x: 100, y: 100 };
      const p2 = { x: 500, y: 100 };
      // Waypoint 1 is 15px from p1 (within 28px); Waypoint 2 is far away; Waypoint 3 is 20px from p2
      const waypoints = [
        { x: 115, y: 105 }, // near p1 -> absorbed
        { x: 300, y: 250 }, // valid bend
        { x: 485, y: 102 }, // near p2 -> absorbed
      ];
      const combined = combineParallelAnchors(waypoints, p1, p2);
      assert.equal(combined.length, 1);
      assert.deepEqual(combined[0], { x: 300, y: 250 });
    });

    it('auto-merges adjacent waypoints that are within 28px of each other into a single waypoint (Rule 3)', () => {
      const p1 = { x: 0, y: 0 };
      const p2 = { x: 600, y: 300 };
      // Two waypoints 20px apart
      const waypoints = [
        { x: 200, y: 150 },
        { x: 216, y: 155 },
      ];
      const combined = combineParallelAnchors(waypoints, p1, p2);
      assert.equal(combined.length, 1);
      assert.deepEqual(combined[0], { x: 208, y: 153 });
    });

    it('dissolves intermediate waypoints that lie directly collinear on a straight segment between neighbors', () => {
      const p1 = { x: 0, y: 0 };
      const p2 = { x: 500, y: 400 };
      // Waypoint 1 creates vertical run at x=200; W2 is collinear at (200, 200); W3 is at (200, 300)
      const waypoints = [
        { x: 200, y: 100 },
        { x: 200, y: 200 }, // Collinear between (200, 100) and (200, 300)
        { x: 200, y: 300 },
      ];
      const combined = combineParallelAnchors(waypoints, p1, p2);
      // All 3 vertical anchors combine into 1 clean anchor
      assert.equal(combined.length, 1);
      assert.equal(combined[0].x, 200);
    });
  });

  describe('Straight Line & Corner Turning Invariant (User Request)', () => {
    it('keeps line straight as a single segment when two free endpoints share horizontal or vertical axis', () => {
      const freeP1H = { side: 'right', pos: { x: 50, y: 120 }, normal: { x: 0, y: 0 } };
      const freeP2H = { side: 'left', pos: { x: 350, y: 120 }, normal: { x: 0, y: 0 } };
      const routeH = calculateConnectorRoute(freeP1H, freeP2H, 'orthogonal');
      assert.equal(routeH.points.length, 2, 'Must be a single straight segment');
      assert.equal(routeH.points[0].y, 120);
      assert.equal(routeH.points[1].y, 120);

      const freeP1V = { side: 'bottom', pos: { x: 120, y: 50 }, normal: { x: 0, y: 0 } };
      const freeP2V = { side: 'top', pos: { x: 120, y: 350 }, normal: { x: 0, y: 0 } };
      const routeV = calculateConnectorRoute(freeP1V, freeP2V, 'orthogonal');
      assert.equal(routeV.points.length, 2, 'Must be a single straight segment');
      assert.equal(routeV.points[0].x, 120);
      assert.equal(routeV.points[1].x, 120);
    });

    it('makes a single 90-degree corner when two free endpoints have different axes', () => {
      const freeP1 = { side: 'right', pos: { x: 100, y: 100 }, normal: { x: 0, y: 0 } };
      const freeP2 = { side: 'left', pos: { x: 300, y: 250 }, normal: { x: 0, y: 0 } };
      const route = calculateConnectorRoute(freeP1, freeP2, 'orthogonal');
      assert.equal(route.points.length, 3, 'Must have exactly 3 points (1 corner, 2 straight segments)');
      // Segment 1 must be strictly horizontal
      assert.equal(route.points[0].y, route.points[1].y);
      // Segment 2 must be strictly vertical
      assert.equal(route.points[1].x, route.points[2].x);
    });

    it('keeps lines straight and makes a corner when connecting shape anchor to a free point on different axes', () => {
      const shapeAnchor = { side: 'right', pos: { x: 150, y: 100 }, normal: { x: 1, y: 0 } };
      const freeTarget = { side: 'left', pos: { x: 300, y: 250 }, normal: { x: 0, y: 0 } };
      const route = calculateConnectorRoute(shapeAnchor, freeTarget, 'orthogonal');
      assert.equal(route.points.length, 3, 'Must have 1 corner leaving along anchor normal');
      assert.equal(route.points[0].y, route.points[1].y, 'Leaves right horizontally');
      assert.equal(route.points[1].x, route.points[2].x, 'Turns down vertically into target');
    });

    it('keeps all segments strictly straight and turns at corners when user waypoints have different axes', () => {
      const from = { side: 'right', pos: { x: 100, y: 100 }, normal: { x: 1, y: 0 } };
      const to = { side: 'left', pos: { x: 400, y: 300 }, normal: { x: -1, y: 0 } };
      const waypoints = [{ x: 250, y: 200 }];
      const route = calculateConnectorRoute(from, to, 'orthogonal', waypoints);

      // Verify EVERY segment is strictly straight (either delta-x = 0 or delta-y = 0)
      for (let i = 0; i < route.points.length - 1; i++) {
        const pA = route.points[i];
        const pB = route.points[i + 1];
        const isHoriz = Math.abs(pA.y - pB.y) <= 0.01;
        const isVert = Math.abs(pA.x - pB.x) <= 0.01;
        assert.ok(
          isHoriz || isVert,
          `Segment (${pA.x},${pA.y}) -> (${pB.x},${pB.y}) must be strictly straight (horizontal or vertical)`
        );
      }

      // Must include the waypoint coordinate along the path
      const hasWaypoint = route.points.some((p) => Math.abs(p.x - 250) <= 2 && Math.abs(p.y - 200) <= 2);
      assert.ok(hasWaypoint, 'Route points must visit waypoint');
    });
  });
});

describe('Freehand Drawing Engine', () => {
  describe('pointsToSvgPath', () => {
    it('returns empty string for empty points array', () => {
      assert.equal(pointsToSvgPath([]), '');
      assert.equal(pointsToSvgPath(null), '');
    });

    it('returns micro-dot segment for single point', () => {
      const path = pointsToSvgPath([{ x: 50, y: 80 }]);
      assert.equal(path, 'M 50 80 l 0.01 0.01');
    });

    it('returns single line segment for 2 points', () => {
      const path = pointsToSvgPath([
        { x: 10, y: 20 },
        { x: 30, y: 40 },
      ]);
      assert.equal(path, 'M 10 20 L 30 40');
    });

    it('generates quadratic bezier smoothed curve for 3 or more points', () => {
      const points = [
        { x: 0, y: 0 },
        { x: 10, y: 20 },
        { x: 30, y: 40 },
        { x: 60, y: 60 },
      ];
      const path = pointsToSvgPath(points);
      assert.ok(path.startsWith('M 0 0'));
      assert.ok(path.includes('Q 10 20 20 30'));
      assert.ok(path.endsWith('L 60 60'));
    });
  });

  describe('computeDrawingBounds', () => {
    it('returns default 10x10 fallback for empty points', () => {
      const bounds = computeDrawingBounds([]);
      assert.deepEqual(bounds, { x: 0, y: 0, width: 10, height: 10 });
    });

    it('computes tight bounding box for multi-point stroke', () => {
      const points = [
        { x: 50, y: 100 },
        { x: 200, y: 30 },
        { x: 120, y: 250 },
      ];
      const bounds = computeDrawingBounds(points);
      assert.equal(bounds.x, 50);
      assert.equal(bounds.y, 30);
      assert.equal(bounds.width, 150);
      assert.equal(bounds.height, 220);
    });

    it('clamps minimum width and height to at least 10px', () => {
      const points = [{ x: 50, y: 50 }];
      const bounds = computeDrawingBounds(points);
      assert.equal(bounds.x, 50);
      assert.equal(bounds.y, 50);
      assert.equal(bounds.width, 10);
      assert.equal(bounds.height, 10);
    });
  });
});

describe('Spatial Index & Hit Testing', () => {
  it('inserts items and queries bounding box overlaps', () => {
    const idx = new SpatialIndex();
    idx.insert({ id: 'item1', x: 0, y: 0, width: 50, height: 50 });
    idx.insert({ id: 'item2', x: 100, y: 100, width: 50, height: 50 });
    idx.insert({ id: 'item3', x: 200, y: 200, width: 50, height: 50 });

    const hits1 = idx.search({ minX: -10, minY: -10, maxX: 60, maxY: 60 });
    assert.deepEqual(hits1, ['item1']);

    const hitsAll = idx.search({ minX: 0, minY: 0, maxX: 300, maxY: 300 });
    assert.equal(hitsAll.length, 3);
  });

  it('updates item position and removes items accurately', () => {
    const idx = new SpatialIndex();
    idx.insert({ id: 'item1', x: 0, y: 0, width: 50, height: 50 });

    // Update position to (200, 200)
    idx.update({ id: 'item1', x: 200, y: 200, width: 50, height: 50 });
    assert.deepEqual(idx.search({ minX: 0, minY: 0, maxX: 50, maxY: 50 }), []);
    assert.deepEqual(
      idx.search({ minX: 190, minY: 190, maxX: 260, maxY: 260 }),
      ['item1']
    );

    // Remove
    idx.remove('item1');
    assert.deepEqual(
      idx.search({ minX: 0, minY: 0, maxX: 300, maxY: 300 }),
      []
    );
  });

  it('queries items across spatial hash cell boundaries in insertion order', () => {
    const idx = new SpatialIndex();
    idx.insert({ id: 'first', x: 240, y: 20, width: 40, height: 40 });
    idx.insert({ id: 'second', x: 270, y: 20, width: 20, height: 20 });

    assert.deepEqual(
      idx.search({ minX: 250, minY: 0, maxX: 280, maxY: 60 }),
      ['first', 'second']
    );

    idx.update({ id: 'first', x: 600, y: 20, width: 40, height: 40 });
    assert.deepEqual(
      idx.search({ minX: 250, minY: 0, maxX: 280, maxY: 60 }),
      ['second']
    );
  });

  it('hitTest respects z-order and returns topmost object', () => {
    const idx = new SpatialIndex();
    const objects = {
      obj1: {
        id: 'obj1',
        type: 'shape',
        kind: 'rectangle',
        x: 50,
        y: 50,
        width: 100,
        height: 100,
      },
      obj2: {
        id: 'obj2',
        type: 'shape',
        kind: 'rectangle',
        x: 80,
        y: 80,
        width: 100,
        height: 100,
      },
    };
    const order = ['obj1', 'obj2']; // obj2 is on top

    // Point (90, 90) overlaps both obj1 and obj2
    const hit = idx.hitTest({ x: 90, y: 90 }, objects, order);
    assert.equal(hit, 'obj2');

    // Point (60, 60) is only inside obj1
    const hitObj1 = idx.hitTest({ x: 60, y: 60 }, objects, order);
    assert.equal(hitObj1, 'obj1');

    // Point outside all
    const hitNone = idx.hitTest({ x: 10, y: 10 }, objects, order);
    assert.equal(hitNone, null);
  });

  it('hitTest ignores connectors', () => {
    const idx = new SpatialIndex();
    const objects = {
      conn1: {
        id: 'conn1',
        type: 'connector',
        from: { x: 0, y: 0 },
        to: { x: 100, y: 100 },
      },
    };
    const hit = idx.hitTest({ x: 50, y: 50 }, objects, ['conn1']);
    assert.equal(hit, null);
  });

  it('hitTest accurately detects rotated shapes by inverse point rotation', () => {
    const idx = new SpatialIndex();
    // Square 100x100 at (100, 100), center at (150, 150), rotated 45 degrees
    const objects = {
      rotatedShape: {
        id: 'rotatedShape',
        type: 'shape',
        kind: 'rectangle',
        x: 100,
        y: 100,
        width: 100,
        height: 100,
        rotation: 45,
      },
    };

    // Center is always inside: (150, 150)
    assert.equal(
      idx.hitTest({ x: 150, y: 150 }, objects, ['rotatedShape']),
      'rotatedShape'
    );

    // Tip of 45-degree diamond: apex is at y = 150 - 50*sqrt(2) = 150 - 70.71 = ~79.3
    // At (150, 85) it should hit!
    assert.equal(
      idx.hitTest({ x: 150, y: 85 }, objects, ['rotatedShape']),
      'rotatedShape'
    );

    // Top-left corner of the unrotated box (105, 105):
    // In unrotated box (105, 105) is inside, but in 45-deg diamond it is OUTSIDE!
    assert.equal(
      idx.hitTest({ x: 105, y: 105 }, objects, ['rotatedShape']),
      null
    );
  });
});

describe('DocumentStore & Undo/Redo', () => {
  it('AddObjectsCommand adds objects and undo deletes them', () => {
    const store = new DocumentStore();
    const obj = {
      id: 'rect-1',
      type: 'shape',
      kind: 'rectangle',
      x: 10,
      y: 10,
      width: 50,
      height: 50,
      style: {},
      textStyle: {},
    };

    const cmd = new AddObjectsCommand(store, [obj]);
    cmd.execute();
    assert.ok(store.getState().objects['rect-1']);
    assert.deepEqual(store.getState().order, ['rect-1']);

    cmd.undo();
    assert.equal(store.getState().objects['rect-1'], undefined);
    assert.deepEqual(store.getState().order, []);
  });

  it('DeleteObjectsCommand preserves object data and restores order on undo', () => {
    const store = new DocumentStore();
    const obj1 = { id: 'o1', type: 'text', x: 0, y: 0, width: 20, height: 20, text: 'A', textStyle: {} };
    const obj2 = { id: 'o2', type: 'text', x: 0, y: 0, width: 20, height: 20, text: 'B', textStyle: {} };
    store.addObject(obj1, false);
    store.addObject(obj2, false);

    const cmd = new DeleteObjectsCommand(store, ['o1']);
    cmd.execute();
    assert.equal(store.getState().objects['o1'], undefined);
    assert.deepEqual(store.getState().order, ['o2']);

    cmd.undo();
    assert.ok(store.getState().objects['o1']);
    assert.deepEqual(store.getState().order, ['o1', 'o2']);
  });

  it('UpdateObjectsCommand updates and reverts object states', () => {
    const store = new DocumentStore();
    const prevObj = { id: 'o1', type: 'text', x: 10, y: 10, width: 20, height: 20, text: 'Old', textStyle: {} };
    const nextObj = { id: 'o1', type: 'text', x: 50, y: 50, width: 20, height: 20, text: 'New', textStyle: {} };
    store.addObject(prevObj, false);

    const cmd = new UpdateObjectsCommand(store, [prevObj], [nextObj]);
    cmd.execute();
    assert.equal(store.getState().objects['o1'].text, 'New');
    assert.equal(store.getState().objects['o1'].x, 50);

    cmd.undo();
    assert.equal(store.getState().objects['o1'].text, 'Old');
    assert.equal(store.getState().objects['o1'].x, 10);
  });

  it('ReorderCommand swaps z-order and restores on undo', () => {
    const store = new DocumentStore();
    store.addObject({ id: 'a', type: 'text', x: 0, y: 0, width: 10, height: 10, text: '', textStyle: {} }, false);
    store.addObject({ id: 'b', type: 'text', x: 0, y: 0, width: 10, height: 10, text: '', textStyle: {} }, false);

    const cmd = new ReorderCommand(store, ['a', 'b'], ['b', 'a']);
    cmd.execute();
    assert.deepEqual(store.getState().order, ['b', 'a']);

    cmd.undo();
    assert.deepEqual(store.getState().order, ['a', 'b']);
  });

  it('CommandManager enforces 200-step history limit without memory leak', () => {
    const store = new DocumentStore();
    const mgr = new CommandManager();

    // Execute 210 commands
    for (let i = 0; i < 210; i++) {
      const obj = { id: `item-${i}`, type: 'text', x: i, y: i, width: 10, height: 10, text: '', textStyle: {} };
      mgr.execute(new AddObjectsCommand(store, [obj]));
    }

    assert.equal(mgr.canUndo(), true);

    // Can only undo at most 200 times
    let undoCount = 0;
    while (mgr.undo()) {
      undoCount++;
    }
    assert.equal(undoCount, 200);
    assert.equal(mgr.canUndo(), false);
  });

  it('DocumentStore notifies listeners reactively and unsubscribes properly', () => {
    const store = new DocumentStore();
    let notifications = 0;
    let latestState = null;

    const unsubscribe = store.subscribe((s) => {
      notifications++;
      latestState = s;
    });

    // Direct addition triggers 1 notification
    const obj = { id: 'n1', type: 'text', x: 0, y: 0, width: 10, height: 10, text: 'Hi', textStyle: {} };
    store.addObject(obj, false);
    assert.equal(notifications, 1);
    assert.ok(latestState.objects['n1']);

    // Direct update triggers 1 notification
    store.updateObject({ ...obj, text: 'Updated' }, false);
    assert.equal(notifications, 2);
    assert.equal(latestState.objects['n1'].text, 'Updated');

    // Direct deletion triggers 1 notification
    store.deleteObject('n1', false);
    assert.equal(notifications, 3);
    assert.equal(latestState.objects['n1'], undefined);

    // History-recorded commands also notify listeners
    store.addObject({ id: 'n3', type: 'text', x: 0, y: 0, width: 10, height: 10, text: 'HistoryItem', textStyle: {} }, true);
    const notifsAfterAdd = notifications;
    assert.ok(notifsAfterAdd > 3);

    store.undo();
    const notifsAfterUndo = notifications;
    assert.ok(notifsAfterUndo > notifsAfterAdd);
    assert.equal(latestState.objects['n3'], undefined);

    store.redo();
    const notifsAfterRedo = notifications;
    assert.ok(notifsAfterRedo > notifsAfterUndo);
    assert.ok(latestState.objects['n3']);

    // Unsubscribe stops receiving events
    unsubscribe();
    const finalNotifs = notifications;
    store.addObject({ id: 'n4', type: 'text', x: 0, y: 0, width: 10, height: 10, text: 'Ignored', textStyle: {} }, false);
    assert.equal(notifications, finalNotifs);
  });

  it('DocumentStore loadState replaces the board, rebuilds the index, and clears history', () => {
    const store = new DocumentStore();
    const first = {
      id: 'first-shape',
      type: 'shape',
      kind: 'rectangle',
      x: 0,
      y: 0,
      width: 40,
      height: 40,
      style: {},
      textStyle: {},
    };

    store.addObject(first);
    assert.equal(store.getCommandManager().canUndo(), true);
    assert.deepEqual(
      store.getSpatialIndex().search({ minX: -1, minY: -1, maxX: 50, maxY: 50 }),
      ['first-shape']
    );

    store.loadState({
      id: 'second-board',
      title: 'Second Board',
      objects: {
        'second-shape': {
          ...first,
          id: 'second-shape',
          x: 200,
          y: 200,
        },
      },
      order: ['second-shape'],
    });

    assert.equal(store.getState().id, 'second-board');
    assert.equal(store.getState().title, 'Second Board');
    assert.equal(store.getCommandManager().canUndo(), false);
    assert.deepEqual(
      store.getSpatialIndex().search({ minX: -1, minY: -1, maxX: 50, maxY: 50 }),
      []
    );
    assert.deepEqual(
      store.getSpatialIndex().search({ minX: 190, minY: 190, maxX: 250, maxY: 250 }),
      ['second-shape']
    );
  });
});

describe('Template Library Generators', () => {
  it('TEMPLATES contains all required templates', () => {
    assert.ok(TEMPLATES.kanban, 'kanban template must exist');
    assert.ok(TEMPLATES.retrospective, 'retrospective template must exist');
    assert.ok(TEMPLATES.brainstorm, 'brainstorm template must exist');
    assert.ok(TEMPLATES.mindmap, 'mindmap template must exist');
    assert.ok(TEMPLATES.matrix2x2, 'matrix2x2 template must exist');
  });

  it('kanban generator creates 3 column frames and sticky notes assigned to frames', () => {
    const objects = TEMPLATES.kanban.generate(100, 100);
    assert.ok(Array.isArray(objects));
    assert.ok(objects.length > 0);

    const frames = objects.filter((o) => o.type === 'frame');
    assert.equal(frames.length, 3);
    const frameNames = frames.map((f) => f.name);
    assert.deepEqual(frameNames, ['To Do', 'In Progress', 'Done']);

    const stickies = objects.filter((o) => o.type === 'sticky');
    assert.equal(stickies.length, 9);
    for (const sticky of stickies) {
      assert.ok(sticky.frameId, 'Sticky must have associated frameId');
      assert.ok(sticky.author, 'Sticky must have author');
      assert.ok(sticky.text.length > 0);
    }
  });

  it('retrospective generator creates 3 retro categories with stickies', () => {
    const objects = TEMPLATES.retrospective.generate(200, 150);
    const frames = objects.filter((o) => o.type === 'frame');
    assert.equal(frames.length, 3);
    assert.ok(frames[0].name.includes('What Went Well'));
    assert.ok(frames[1].name.includes('What Needs Work'));
    assert.ok(frames[2].name.includes('Action Items'));

    const stickies = objects.filter((o) => o.type === 'sticky');
    assert.equal(stickies.length, 9);
  });

  it('brainstorm generator creates six starter sticky notes', () => {
    const objects = TEMPLATES.brainstorm.generate(200, 150);
    const stickies = objects.filter((o) => o.type === 'sticky');

    assert.equal(stickies.length, 6);
    assert.ok(stickies.every((sticky) => sticky.text.length > 0));
    assert.ok(stickies.every((sticky) => sticky.author === 'You'));
    assert.equal(stickies[0].x, 200);
    assert.equal(stickies[0].y, 150);
  });

  it('mindmap generator creates central root node, 4 branches, and 4 curved connectors', () => {
    const objects = TEMPLATES.mindmap.generate(500, 400);
    const shapes = objects.filter((o) => o.type === 'shape');
    assert.equal(shapes.length, 5); // 1 center node + 4 branches

    const centerNode = shapes.find((s) => s.text === 'Miro Clone Platform');
    assert.ok(centerNode);
    assert.equal(centerNode.x, 500);
    assert.equal(centerNode.y, 400);

    const connectors = objects.filter((o) => o.type === 'connector');
    assert.equal(connectors.length, 4);
    for (const conn of connectors) {
      assert.equal(conn.routing, 'curved');
      assert.equal(conn.style.endArrowhead, 'arrow');
      assert.equal(conn.from.objectId, centerNode.id);
    }
  });

  it('matrix2x2 generator creates 4 quadrant frames with prioritization stickies', () => {
    const objects = TEMPLATES.matrix2x2.generate(100, 100);
    const frames = objects.filter((o) => o.type === 'frame');
    assert.equal(frames.length, 4);

    const stickies = objects.filter((o) => o.type === 'sticky');
    assert.equal(stickies.length, 4);

    assert.ok(frames.some((f) => f.name.includes('Quick Wins')));
    assert.ok(frames.some((f) => f.name.includes('Major Projects')));
    assert.ok(frames.some((f) => f.name.includes('Fill-ins')));
    assert.ok(frames.some((f) => f.name.includes('Time Sinks')));
  });
});

describe('Miro-Grade Canvas Features: Images, Locking, Grouping & Frame Containment', () => {
  it('supports ImageObject in spatial index and calculates shape anchors', () => {
    const img = {
      id: 'img-1',
      type: 'image',
      src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      x: 100,
      y: 100,
      width: 200,
      height: 150,
      rotation: 0,
      style: { opacity: 1 },
    };

    const index = new SpatialIndex();
    index.insert(img);

    const hit = index.hitTest({ x: 150, y: 150 }, { [img.id]: img }, [img.id]);
    assert.equal(hit, 'img-1');

    const anchors = getShapeAnchors(img);
    assert.equal(anchors.top.pos.x, 200);
    assert.equal(anchors.top.pos.y, 100);
    assert.equal(anchors.right.pos.x, 300);
    assert.equal(anchors.right.pos.y, 175);
    assert.equal(anchors.bottom.pos.x, 200);
    assert.equal(anchors.bottom.pos.y, 250);
    assert.equal(anchors.left.pos.x, 100);
    assert.equal(anchors.left.pos.y, 175);
  });

  it('preserves isLocked and groupId metadata across commands and undo/redo', () => {
    const store = new DocumentStore();
    const shape = {
      id: 'shape-locked',
      type: 'shape',
      kind: 'rectangle',
      x: 50,
      y: 50,
      width: 100,
      height: 60,
      isLocked: true,
      groupId: 'grp-42',
      style: { fill: '#ffffff', stroke: '#000000', strokeWidth: 2, opacity: 1 },
    };

    const addCmd = new AddObjectsCommand(store, [shape]);
    store.executeCommand(addCmd);

    let state = store.getState();
    assert.equal(state.objects['shape-locked'].isLocked, true);
    assert.equal(state.objects['shape-locked'].groupId, 'grp-42');

    // Toggle lock
    const updated = { ...state.objects['shape-locked'], isLocked: false };
    const updateCmd = new UpdateObjectsCommand(store, [state.objects['shape-locked']], [updated]);
    store.executeCommand(updateCmd);
    assert.equal(store.getState().objects['shape-locked'].isLocked, false);

    // Undo toggles lock back to true
    store.undo();
    assert.equal(store.getState().objects['shape-locked'].isLocked, true);

    // Redo restores unlocked state
    store.redo();
    assert.equal(store.getState().objects['shape-locked'].isLocked, false);
  });

  it('supports connector inline label and computes label midpoint coordinates accurately', () => {
    const fromAnchor = { side: 'right', pos: { x: 100, y: 100 }, normal: { x: 1, y: 0 } };
    const toAnchor = { side: 'left', pos: { x: 300, y: 100 }, normal: { x: -1, y: 0 } };

    const route = calculateConnectorRoute(fromAnchor, toAnchor, 'orthogonal');
    assert.ok(route.svgPath);
    assert.equal(route.labelPosition.x, 200);
    // Orthogonal routing places label 12px above line center for clear readability
    assert.equal(route.labelPosition.y, 88);
  });

  it('correctly associates shapes geometrically inside frame bounds', () => {
    const frame = { id: 'frame-1', type: 'frame', x: 100, y: 100, width: 400, height: 300 };
    const insideShape = { id: 's1', type: 'sticky', x: 150, y: 150, width: 80, height: 80 };
    const outsideShape = { id: 's2', type: 'sticky', x: 600, y: 200, width: 80, height: 80 };

    const isInside = (obj, f) =>
      obj.x >= f.x && obj.y >= f.y && obj.x + obj.width <= f.x + f.width && obj.y + obj.height <= f.y + f.height;

    assert.equal(isInside(insideShape, frame), true);
    assert.equal(isInside(outsideShape, frame), false);
  });

  describe('Dynamic Smart Alignment Snap Guides', () => {
    it('snaps left edge to target left edge within threshold and creates vertical guide', () => {
      const target = { id: 't1', x: 200, y: 100, width: 100, height: 80 };
      // Proposed is at x: 203 (diff of 3px from target x: 200, within 8px threshold)
      const proposed = { x: 203, y: 300, width: 80, height: 60 };

      const result = calculateSnapGuides(proposed, [target], 8);
      assert.equal(result.snappedX, 200);
      assert.equal(result.dx, -3);
      assert.equal(result.guides.length, 1);
      assert.equal(result.guides[0].orientation, 'vertical');
      assert.equal(result.guides[0].pos, 200);
      // Guide spans across both objects
      assert.ok(result.guides[0].start <= 100);
      assert.ok(result.guides[0].end >= 360);
    });

    it('snaps center to target center within threshold', () => {
      const target = { id: 't1', x: 100, y: 100, width: 100, height: 80 }; // centerX = 150
      // Proposed has width 60, placed at x: 122 (centerX = 152, diff of 2px)
      const proposed = { x: 122, y: 250, width: 60, height: 60 };

      const result = calculateSnapGuides(proposed, [target], 6);
      assert.equal(result.snappedX, 120); // 150 - 30 = 120
      assert.equal(result.dx, -2);
      assert.equal(result.guides.length, 1);
      assert.equal(result.guides[0].pos, 150);
    });

    it('snaps right edge to target left edge (adjacent snapping)', () => {
      const target = { id: 't1', x: 300, y: 100, width: 100, height: 80 };
      // Proposed has width 80, placed at x: 218 (right = 298, diff of 2px from target left 300)
      const proposed = { x: 218, y: 100, width: 80, height: 60 };

      const result = calculateSnapGuides(proposed, [target], 6);
      assert.equal(result.snappedX, 220); // 220 + 80 = 300
      assert.equal(result.dx, 2);
      assert.equal(result.guides[0].pos, 300);
    });

    it('snaps Y-axis top to target top and centerY to target centerY', () => {
      const target = { id: 't1', x: 100, y: 200, width: 100, height: 100 }; // centerY = 250
      // Proposed at y: 197 (diff of 3px from target y: 200)
      const proposed = { x: 400, y: 197, width: 80, height: 80 };

      const result = calculateSnapGuides(proposed, [target], 8);
      assert.equal(result.snappedY, 200);
      assert.equal(result.dy, 3);
      assert.equal(result.guides.length, 1);
      assert.equal(result.guides[0].orientation, 'horizontal');
      assert.equal(result.guides[0].pos, 200);
    });

    it('simultaneously snaps both X and Y axes creating both vertical and horizontal guides', () => {
      const target = { id: 't1', x: 200, y: 200, width: 100, height: 100 };
      const proposed = { x: 202, y: 196, width: 100, height: 100 };

      const result = calculateSnapGuides(proposed, [target], 8);
      assert.equal(result.snappedX, 200);
      assert.equal(result.snappedY, 200);
      assert.equal(result.guides.length, 2);
      const vGuide = result.guides.find((g) => g.orientation === 'vertical');
      const hGuide = result.guides.find((g) => g.orientation === 'horizontal');
      assert.ok(vGuide);
      assert.ok(hGuide);
      assert.equal(vGuide.pos, 200);
      assert.equal(hGuide.pos, 200);
    });

    it('does not snap when distance exceeds threshold', () => {
      const target = { id: 't1', x: 200, y: 200, width: 100, height: 100 };
      const proposed = { x: 220, y: 220, width: 100, height: 100 }; // diff 20px > 8px

      const result = calculateSnapGuides(proposed, [target], 8);
      assert.equal(result.snappedX, 220);
      assert.equal(result.snappedY, 220);
      assert.equal(result.dx, 0);
      assert.equal(result.dy, 0);
      assert.equal(result.guides.length, 0);
    });
  });

  describe('Rich Inline Text Formatting', () => {
    it('parses plain text into a single line and span', () => {
      const lines = parseRichText('Hello world');
      assert.equal(lines.length, 1);
      assert.equal(lines[0].isBullet, false);
      assert.equal(lines[0].isNumbered, false);
      assert.equal(lines[0].spans.length, 1);
      assert.equal(lines[0].spans[0].text, 'Hello world');
    });

    it('parses inline bold, italic, underline, and strikethrough tokens', () => {
      const text = 'Normal **bold** text *italic* and <u>underlined</u> with ~~struck~~ end';
      const spans = parseInlineSpans(text);
      assert.ok(spans.length >= 7);

      const boldSpan = spans.find((s) => s.text === 'bold');
      assert.ok(boldSpan);
      assert.equal(boldSpan.bold, true);

      const italicSpan = spans.find((s) => s.text === 'italic');
      assert.ok(italicSpan);
      assert.equal(italicSpan.italic, true);

      const underSpan = spans.find((s) => s.text === 'underlined');
      assert.ok(underSpan);
      assert.equal(underSpan.underline, true);

      const strikeSpan = spans.find((s) => s.text === 'struck');
      assert.ok(strikeSpan);
      assert.equal(strikeSpan.strikethrough, true);
    });

    it('parses bullet list markers (- , * , • ) and indent levels', () => {
      const markdown = '- First item\n  * Nested item\n• Third item';
      const lines = parseRichText(markdown);
      assert.equal(lines.length, 3);
      assert.equal(lines[0].isBullet, true);
      assert.equal(lines[0].indent, 0);
      assert.equal(lines[0].spans[0].text, 'First item');

      assert.equal(lines[1].isBullet, true);
      assert.equal(lines[1].indent, 1);
      assert.equal(lines[1].spans[0].text, 'Nested item');

      assert.equal(lines[2].isBullet, true);
      assert.equal(lines[2].indent, 0);
      assert.equal(lines[2].spans[0].text, 'Third item');
    });

    it('parses numbered list markers with prefix preservation', () => {
      const markdown = '1. Step one\n2. Step two';
      const lines = parseRichText(markdown);
      assert.equal(lines.length, 2);
      assert.equal(lines[0].isNumbered, true);
      assert.equal(lines[0].numberPrefix, '1.');
      assert.equal(lines[0].spans[0].text, 'Step one');
      assert.equal(lines[1].isNumbered, true);
      assert.equal(lines[1].numberPrefix, '2.');
    });

    it('toggles inline bold format around selection and unwraps if already formatted', () => {
      const text = 'Hello world';
      // Select 'world' (start 6, end 11)
      const formatted = toggleInlineFormat(text, 6, 11, 'bold');
      assert.equal(formatted.newText, 'Hello **world**');

      // Unwrap
      const unformatted = toggleInlineFormat(formatted.newText, 6, 15, 'bold');
      assert.equal(unformatted.newText, 'Hello world');
    });

    it('toggles list format across multiple lines', () => {
      const text = 'Item A\nItem B';
      const bulleted = toggleListFormat(text, 0, text.length, 'bullet');
      assert.equal(bulleted.newText, '- Item A\n- Item B');

      // Toggle off
      const unbulleted = toggleListFormat(bulleted.newText, 0, bulleted.newText.length, 'bullet');
      assert.equal(unbulleted.newText, 'Item A\nItem B');
    });

    it('handles list auto-continue when pressing Enter on a list item', () => {
      const text = '- First task';
      const result = handleListAutoContinue(text, text.length);
      assert.equal(result.handled, true);
      assert.equal(result.newText, '- First task\n- ');

      // Pressing enter on an empty bullet removes it
      const emptyBullet = '- ';
      const exitResult = handleListAutoContinue(emptyBullet, emptyBullet.length);
      assert.equal(exitResult.handled, true);
      assert.equal(exitResult.newText, '');
    });
  });

  describe('Swimlane Diagram Shape & Dynamic Lanes', () => {
    it('creates swimlane object with default lanes and computes anchors', () => {
      const swimlane = {
        id: 'swimlane-1',
        type: 'swimlane',
        x: 100,
        y: 100,
        width: 600,
        height: 300,
        headerTitle: 'Customer Journey',
        orientation: 'horizontal',
        lanes: [
          { id: 'lane-1', title: 'Marketing' },
          { id: 'lane-2', title: 'Sales' },
          { id: 'lane-3', title: 'Support' },
        ],
      };

      const anchors = getShapeAnchors(swimlane);
      assert.equal(anchors.top.pos.x, 400);
      assert.equal(anchors.top.pos.y, 100);
      assert.equal(anchors.right.pos.x, 700);
      assert.equal(anchors.right.pos.y, 250);
      assert.equal(anchors.bottom.pos.x, 400);
      assert.equal(anchors.bottom.pos.y, 400);
      assert.equal(anchors.left.pos.x, 100);
      assert.equal(anchors.left.pos.y, 250);
    });

    it('indexes swimlane in SpatialIndex and detects hit test', () => {
      const store = new DocumentStore();
      const swimlane = {
        id: 'swimlane-hit',
        type: 'swimlane',
        x: 200,
        y: 200,
        width: 500,
        height: 300,
        headerTitle: 'Hiring Process',
        orientation: 'horizontal',
        lanes: [
          { id: 'l1', title: 'HR' },
          { id: 'l2', title: 'Tech Lead' },
        ],
      };

      store.executeCommand(new AddObjectsCommand(store, [swimlane]));
      const hitId = store.getSpatialIndex().hitTest({ x: 300, y: 300 }, store.getState().objects, store.getState().order);
      assert.equal(hitId, 'swimlane-hit');
    });

    it('adds and removes dynamic lanes with DocumentStore undo/redo history', () => {
      const store = new DocumentStore();
      const swimlane = {
        id: 'swimlane-lanes',
        type: 'swimlane',
        x: 100,
        y: 100,
        width: 600,
        height: 300,
        headerTitle: 'Delivery Pipeline',
        orientation: 'horizontal',
        lanes: [
          { id: 'lane-1', title: 'Dev' },
          { id: 'lane-2', title: 'QA' },
        ],
      };

      store.executeCommand(new AddObjectsCommand(store, [swimlane]));
      assert.equal(store.getState().objects['swimlane-lanes'].lanes.length, 2);

      // Add a third lane
      const prev = JSON.parse(JSON.stringify(store.getState().objects['swimlane-lanes']));
      const next = JSON.parse(JSON.stringify(prev));
      next.lanes.push({ id: 'lane-3', title: 'DevOps' });
      next.height += 100;

      store.executeCommand(new UpdateObjectsCommand(store, [prev], [next]));
      assert.equal(store.getState().objects['swimlane-lanes'].lanes.length, 3);
      assert.equal(store.getState().objects['swimlane-lanes'].lanes[2].title, 'DevOps');
      assert.equal(store.getState().objects['swimlane-lanes'].height, 400);

      // Undo lane addition
      store.undo();
      assert.equal(store.getState().objects['swimlane-lanes'].lanes.length, 2);
      assert.equal(store.getState().objects['swimlane-lanes'].height, 300);

      // Redo lane addition
      store.redo();
      assert.equal(store.getState().objects['swimlane-lanes'].lanes.length, 3);
      assert.equal(store.getState().objects['swimlane-lanes'].height, 400);
    });

    it('correctly associates shapes contained inside swimlane bounds', () => {
      const swimlane = {
        id: 'swimlane-pool',
        type: 'swimlane',
        x: 100,
        y: 100,
        width: 600,
        height: 400,
      };

      const innerShape = {
        id: 'shape-inside',
        type: 'shape',
        kind: 'rectangle',
        x: 250,
        y: 200,
        width: 140,
        height: 60,
      };

      const outerShape = {
        id: 'shape-outside',
        type: 'shape',
        kind: 'rectangle',
        x: 800,
        y: 200,
        width: 140,
        height: 60,
      };

      const isInside =
        innerShape.x >= swimlane.x &&
        innerShape.y >= swimlane.y &&
        innerShape.x + innerShape.width <= swimlane.x + swimlane.width &&
        innerShape.y + innerShape.height <= swimlane.y + swimlane.height;

      const isOutside =
        outerShape.x >= swimlane.x &&
        outerShape.y >= swimlane.y &&
        outerShape.x + outerShape.width <= swimlane.x + swimlane.width &&
        outerShape.y + outerShape.height <= swimlane.y + swimlane.height;

      assert.equal(isInside, true);
      assert.equal(isOutside, false);
    });

    it('getSwimlaneLayout deterministically computes horizontal layout and dividers', () => {
      const swimlane = {
        id: 'swimlane-layout',
        type: 'swimlane',
        x: 50,
        y: 100,
        width: 700,
        height: 334,
        orientation: 'horizontal',
        headerSize: 34,
        headerColSize: 130,
        lanes: [
          { id: 'l1', title: 'Marketing' },
          { id: 'l2', title: 'Engineering' },
          { id: 'l3', title: 'Support' },
        ],
      };

      const layout = getSwimlaneLayout(swimlane);
      assert.equal(layout.headerBar.x, 50);
      assert.equal(layout.headerBar.y, 100);
      assert.equal(layout.headerBar.width, 700);
      assert.equal(layout.headerBar.height, 34);

      assert.equal(layout.headerCol.width, 130);
      assert.equal(layout.lanes.length, 3);

      // (334 - 34) / 3 = 100px per lane
      assert.equal(layout.lanes[0].height, 100);
      assert.equal(layout.lanes[0].headerBounds.width, 130);
      assert.equal(layout.lanes[0].bodyBounds.width, 700 - 130);
      assert.equal(layout.lanes[1].y, 100 + 34 + 100);

      // Check dividers: 1 pool-header, 1 lane-header-col, 2 lane dividers
      const poolHeaderDiv = layout.dividers.find((d) => d.type === 'pool-header');
      assert.ok(poolHeaderDiv);
      assert.equal(poolHeaderDiv.y1, 134);

      const colDiv = layout.dividers.find((d) => d.type === 'lane-header-col');
      assert.ok(colDiv);
      assert.equal(colDiv.x1, 50 + 130);

      const laneDivs = layout.dividers.filter((d) => d.type === 'lane');
      assert.equal(laneDivs.length, 2);
    });

    it('getSwimlaneLayout handles custom per-lane partial sizes and header adjustments', () => {
      const swimlane = {
        id: 'swimlane-custom',
        type: 'swimlane',
        x: 0,
        y: 0,
        width: 800,
        height: 400,
        orientation: 'horizontal',
        headerSize: 40,
        headerColSize: 160,
        lanes: [
          { id: 'l1', title: 'Lane 1', size: 120 },
          { id: 'l2', title: 'Lane 2', size: 80 },
          { id: 'l3', title: 'Lane 3' }, // unassigned, takes remainder
        ],
      };

      const layout = getSwimlaneLayout(swimlane);
      assert.equal(layout.headerBar.height, 40);
      assert.equal(layout.headerCol.width, 160);
      assert.equal(layout.lanes[0].height, 120);
      assert.equal(layout.lanes[1].height, 80);
      // Remainder: available = 400 - 40 = 360; 360 - 120 - 80 = 160
      assert.equal(layout.lanes[2].height, 160);
    });

    it('getSwimlaneLayout computes vertical orientation layout and dividers', () => {
      const swimlane = {
        id: 'swimlane-vert',
        type: 'swimlane',
        x: 100,
        y: 50,
        width: 600,
        height: 500,
        orientation: 'vertical',
        headerSize: 40,
        headerColSize: 36,
        lanes: [
          { id: 'v1', title: 'To Do', size: 200 },
          { id: 'v2', title: 'Doing', size: 200 },
          { id: 'v3', title: 'Done', size: 200 },
        ],
      };

      const layout = getSwimlaneLayout(swimlane);
      assert.equal(layout.headerBar.height, 40);
      assert.equal(layout.lanes.length, 3);
      assert.equal(layout.lanes[0].width, 200);
      assert.equal(layout.lanes[0].headerBounds.height, 36);
      assert.equal(layout.lanes[1].x, 100 + 200);

      const vertDivs = layout.dividers.filter((d) => d.type === 'lane');
      assert.equal(vertDivs.length, 2);
      assert.equal(vertDivs[0].orientation, 'vertical');
    });
  });
});
