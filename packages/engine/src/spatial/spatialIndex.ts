import { Point, BoardObject } from '@diagrammer/shared';

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface SpatialItem {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}

export class SpatialIndex {
  private items: Map<string, SpatialItem> = new Map();
  private readonly cellSize = 256;
  private cells: Map<string, Set<string>> = new Map();
  private itemCells: Map<string, string[]> = new Map();
  private insertionOrder: Map<string, number> = new Map();
  private nextInsertionOrder = 0;

  insert(item: SpatialItem): void {
    if (this.items.has(item.id)) {
      this.removeFromCells(item.id);
    } else {
      this.insertionOrder.set(item.id, this.nextInsertionOrder++);
    }
    this.items.set(item.id, { ...item });
    this.addToCells(item);
  }

  remove(id: string): void {
    this.removeFromCells(id);
    this.items.delete(id);
    this.insertionOrder.delete(id);
  }

  update(item: SpatialItem): void {
    if (!this.items.has(item.id)) {
      this.insert(item);
      return;
    }

    this.removeFromCells(item.id);
    this.items.set(item.id, { ...item });
    this.addToCells(item);
  }

  clear(): void {
    this.items.clear();
    this.cells.clear();
    this.itemCells.clear();
    this.insertionOrder.clear();
    this.nextInsertionOrder = 0;
  }

  search(bbox: BoundingBox): string[] {
    const candidateIds = new Set<string>();
    const minCellX = this.toCellCoordinate(bbox.minX);
    const maxCellX = this.toCellCoordinate(bbox.maxX);
    const minCellY = this.toCellCoordinate(bbox.minY);
    const maxCellY = this.toCellCoordinate(bbox.maxY);

    for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
      for (let cellY = minCellY; cellY <= maxCellY; cellY++) {
        const ids = this.cells.get(this.cellKey(cellX, cellY));
        if (!ids) continue;
        for (const id of ids) {
          candidateIds.add(id);
        }
      }
    }

    const results: string[] = [];
    for (const id of candidateIds) {
      const item = this.items.get(id);
      if (!item) continue;
      const itemMaxX = item.x + item.width;
      const itemMaxY = item.y + item.height;

      const overlaps =
        item.x <= bbox.maxX &&
        itemMaxX >= bbox.minX &&
        item.y <= bbox.maxY &&
        itemMaxY >= bbox.minY;

      if (overlaps) {
        results.push(id);
      }
    }

    // Keep the historical insertion-order behavior while avoiding a full item scan.
    results.sort(
      (a, b) => (this.insertionOrder.get(a) ?? 0) - (this.insertionOrder.get(b) ?? 0)
    );
    return results;
  }

  private toCellCoordinate(value: number): number {
    return Math.floor(value / this.cellSize);
  }

  private cellKey(cellX: number, cellY: number): string {
    return `${cellX}:${cellY}`;
  }

  private getCellsForItem(item: SpatialItem): string[] {
    const minCellX = this.toCellCoordinate(item.x);
    const maxCellX = this.toCellCoordinate(item.x + item.width);
    const minCellY = this.toCellCoordinate(item.y);
    const maxCellY = this.toCellCoordinate(item.y + item.height);
    const keys: string[] = [];

    for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
      for (let cellY = minCellY; cellY <= maxCellY; cellY++) {
        keys.push(this.cellKey(cellX, cellY));
      }
    }
    return keys;
  }

  private addToCells(item: SpatialItem): void {
    const cellKeys = this.getCellsForItem(item);
    this.itemCells.set(item.id, cellKeys);

    for (const key of cellKeys) {
      let ids = this.cells.get(key);
      if (!ids) {
        ids = new Set<string>();
        this.cells.set(key, ids);
      }
      ids.add(item.id);
    }
  }

  private removeFromCells(id: string): void {
    const cellKeys = this.itemCells.get(id);
    if (!cellKeys) return;

    for (const key of cellKeys) {
      const ids = this.cells.get(key);
      if (!ids) continue;
      ids.delete(id);
      if (ids.size === 0) {
        this.cells.delete(key);
      }
    }
    this.itemCells.delete(id);
  }

  hitTest(
    point: Point,
    objects: Record<string, BoardObject>,
    order: string[]
  ): string | null {
    // Reverse order so top-most item is hit first
    for (let i = order.length - 1; i >= 0; i--) {
      const id = order[i];
      const obj = objects[id];
      if (!obj || obj.type === 'connector') continue;

      if ('x' in obj && 'y' in obj && 'width' in obj && 'height' in obj) {
        const rot = (obj.rotation || 0) * (Math.PI / 180);
        let px = point.x;
        let py = point.y;

        // Un-rotate point if object has rotation
        if (rot !== 0) {
          const cx = obj.x + obj.width / 2;
          const cy = obj.y + obj.height / 2;
          const cos = Math.cos(-rot);
          const sin = Math.sin(-rot);
          const dx = px - cx;
          const dy = py - cy;
          px = cx + dx * cos - dy * sin;
          py = cy + dx * sin + dy * cos;
        }

        if (
          px >= obj.x &&
          px <= obj.x + obj.width &&
          py >= obj.y &&
          py <= obj.y + obj.height
        ) {
          return id;
        }
      }
    }

    return null;
  }
}
