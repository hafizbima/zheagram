import { Point, ViewportTransform } from '@diagrammer/shared';

export function screenToWorld(
  screenPt: Point,
  viewport: ViewportTransform
): Point {
  return {
    x: (screenPt.x - viewport.x) / viewport.zoom,
    y: (screenPt.y - viewport.y) / viewport.zoom,
  };
}

export function worldToScreen(
  worldPt: Point,
  viewport: ViewportTransform
): Point {
  return {
    x: worldPt.x * viewport.zoom + viewport.x,
    y: worldPt.y * viewport.zoom + viewport.y,
  };
}

export function clampZoom(
  zoom: number,
  min: number = 0.1,
  max: number = 5.0
): number {
  return Math.max(min, Math.min(max, zoom));
}

export function zoomAtScreenPoint(
  viewport: ViewportTransform,
  screenAnchor: Point,
  factor: number
): ViewportTransform {
  const newZoom = clampZoom(viewport.zoom * factor, 0.1, 5.0);
  const worldX = (screenAnchor.x - viewport.x) / viewport.zoom;
  const worldY = (screenAnchor.y - viewport.y) / viewport.zoom;

  return {
    zoom: newZoom,
    x: screenAnchor.x - worldX * newZoom,
    y: screenAnchor.y - worldY * newZoom,
  };
}

export function snapPointToGrid(pt: Point, gridSize: number = 10): Point {
  return {
    x: Math.round(pt.x / gridSize) * gridSize,
    y: Math.round(pt.y / gridSize) * gridSize,
  };
}

export function getAdaptiveGridParams(zoom: number): {
  step: number;
  opacity: number;
} {
  let step = 20;
  if (zoom < 0.25) step = 100;
  else if (zoom < 0.6) step = 50;
  else if (zoom > 2) step = 10;

  const opacity = Math.min(0.4, Math.max(0.12, 0.25 * zoom));

  return { step, opacity };
}
