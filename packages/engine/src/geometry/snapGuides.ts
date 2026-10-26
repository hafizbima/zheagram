export interface SnapRect {
  id?: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SnapLine {
  orientation: 'vertical' | 'horizontal';
  pos: number;
  start: number;
  end: number;
  targetId?: string;
}

export interface SnapResult {
  snappedX: number;
  snappedY: number;
  dx: number;
  dy: number;
  guides: SnapLine[];
}

/**
 * Calculates dynamic magnetic alignment snap guides for a moving bounding box
 * against all other candidate objects on the canvas.
 *
 * @param proposedBounds The proposed new bounding box of the dragged object
 * @param candidates All other shapes on the board (excluding dragged objects)
 * @param snapThreshold Maximum distance in world coordinates to trigger snapping (default 8px)
 */
export function calculateSnapGuides(
  proposedBounds: SnapRect,
  candidates: SnapRect[],
  snapThreshold: number = 8
): SnapResult {
  let bestDx: number | null = null;
  let minDiffX = snapThreshold;
  let snapXPos: number | null = null;
  const snapTargetsX: SnapRect[] = [];

  const draggedLeft = proposedBounds.x;
  const draggedCenterX = proposedBounds.x + proposedBounds.width / 2;
  const draggedRight = proposedBounds.x + proposedBounds.width;

  // 1. Evaluate X-axis alignments
  for (const target of candidates) {
    const tLeft = target.x;
    const tCenterX = target.x + target.width / 2;
    const tRight = target.x + target.width;

    const pairs: Array<{ diff: number; pos: number }> = [
      { diff: tLeft - draggedLeft, pos: tLeft },
      { diff: tRight - draggedLeft, pos: tRight },
      { diff: tCenterX - draggedCenterX, pos: tCenterX },
      { diff: tLeft - draggedRight, pos: tLeft },
      { diff: tRight - draggedRight, pos: tRight },
      { diff: tCenterX - draggedLeft, pos: tCenterX },
      { diff: tCenterX - draggedRight, pos: tCenterX },
    ];

    for (const { diff, pos } of pairs) {
      const absDiff = Math.abs(diff);
      if (absDiff <= snapThreshold) {
        if (absDiff < minDiffX - 0.001) {
          minDiffX = absDiff;
          bestDx = diff;
          snapXPos = pos;
          snapTargetsX.length = 0;
          snapTargetsX.push(target);
        } else if (Math.abs(absDiff - minDiffX) < 0.001 && snapXPos === pos) {
          snapTargetsX.push(target);
        }
      }
    }
  }

  const finalDx = bestDx !== null ? bestDx : 0;
  const snappedX = proposedBounds.x + finalDx;

  // 2. Evaluate Y-axis alignments
  let bestDy: number | null = null;
  let minDiffY = snapThreshold;
  let snapYPos: number | null = null;
  const snapTargetsY: SnapRect[] = [];

  const draggedTop = proposedBounds.y;
  const draggedCenterY = proposedBounds.y + proposedBounds.height / 2;
  const draggedBottom = proposedBounds.y + proposedBounds.height;

  for (const target of candidates) {
    const tTop = target.y;
    const tCenterY = target.y + target.height / 2;
    const tBottom = target.y + target.height;

    const pairs: Array<{ diff: number; pos: number }> = [
      { diff: tTop - draggedTop, pos: tTop },
      { diff: tBottom - draggedTop, pos: tBottom },
      { diff: tCenterY - draggedCenterY, pos: tCenterY },
      { diff: tTop - draggedBottom, pos: tTop },
      { diff: tBottom - draggedBottom, pos: tBottom },
      { diff: tCenterY - draggedTop, pos: tCenterY },
      { diff: tCenterY - draggedBottom, pos: tCenterY },
    ];

    for (const { diff, pos } of pairs) {
      const absDiff = Math.abs(diff);
      if (absDiff <= snapThreshold) {
        if (absDiff < minDiffY - 0.001) {
          minDiffY = absDiff;
          bestDy = diff;
          snapYPos = pos;
          snapTargetsY.length = 0;
          snapTargetsY.push(target);
        } else if (Math.abs(absDiff - minDiffY) < 0.001 && snapYPos === pos) {
          snapTargetsY.push(target);
        }
      }
    }
  }

  const finalDy = bestDy !== null ? bestDy : 0;
  const snappedY = proposedBounds.y + finalDy;

  // 3. Construct Guide Lines
  const guides: SnapLine[] = [];

  if (bestDx !== null && snapXPos !== null && snapTargetsX.length > 0) {
    let minY = Math.min(proposedBounds.y + finalDy, ...snapTargetsX.map((t) => t.y));
    let maxY = Math.max(
      proposedBounds.y + finalDy + proposedBounds.height,
      ...snapTargetsX.map((t) => t.y + t.height)
    );
    guides.push({
      orientation: 'vertical',
      pos: snapXPos,
      start: minY - 24,
      end: maxY + 24,
      targetId: snapTargetsX[0].id,
    });
  }

  if (bestDy !== null && snapYPos !== null && snapTargetsY.length > 0) {
    let minX = Math.min(snappedX, ...snapTargetsY.map((t) => t.x));
    let maxX = Math.max(snappedX + proposedBounds.width, ...snapTargetsY.map((t) => t.x + t.width));
    guides.push({
      orientation: 'horizontal',
      pos: snapYPos,
      start: minX - 24,
      end: maxX + 24,
      targetId: snapTargetsY[0].id,
    });
  }

  return {
    snappedX,
    snappedY,
    dx: finalDx,
    dy: finalDy,
    guides,
  };
}
