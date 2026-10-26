import jitiModule from 'jiti';
const jiti = jitiModule(import.meta.url);
const {
  calculateConnectorRoute,
  pointsToFilletPath,
  segmentIntersectsBox,
  simplifyCollinear,
  getDirectOrthogonalPath,
  getSideNormal
} = jiti('../src/connectors/routing.ts');

const diamond = { minX: 95, minY: 5, maxX: 310, maxY: 190 };
const rect = { minX: 63, minY: 275, maxX: 341, maxY: 415 };
const obstacles = [diamond, rect];

function findGridPath(startPt, endPt, obs, margin = 24) {
  const allX = [startPt.x, endPt.x];
  const allY = [startPt.y, endPt.y];
  for (const b of obs) {
    allX.push(b.minX, b.maxX);
    allY.push(b.minY, b.maxY);
  }

  const searchMinX = Math.min(...allX) - margin * 3;
  const searchMaxX = Math.max(...allX) + margin * 3;
  const searchMinY = Math.min(...allY) - margin * 3;
  const searchMaxY = Math.max(...allY) + margin * 3;

  const relevantObstacles = obs.filter(
    (b) =>
      !(
        b.maxX < searchMinX ||
        b.minX > searchMaxX ||
        b.maxY < searchMinY ||
        b.minY > searchMaxY
      )
  );

  const xSet = new Set([
    startPt.x,
    endPt.x,
    Math.round((startPt.x + endPt.x) / 2),
    searchMinX,
    searchMaxX,
  ]);
  const ySet = new Set([
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

  const cleanXs = [];
  for (const x of xs) {
    if (cleanXs.length === 0 || Math.abs(x - cleanXs[cleanXs.length - 1]) > 3) {
      cleanXs.push(x);
    }
  }
  const cleanYs = [];
  for (const y of ys) {
    if (cleanYs.length === 0 || Math.abs(y - cleanYs[cleanYs.length - 1]) > 3) {
      cleanYs.push(y);
    }
  }

  const findXIdx = (val) => {
    let best = 0, minDiff = Infinity;
    for (let i = 0; i < cleanXs.length; i++) {
      const diff = Math.abs(cleanXs[i] - val);
      if (diff < minDiff) { minDiff = diff; best = i; }
    }
    return best;
  };
  const findYIdx = (val) => {
    let best = 0, minDiff = Infinity;
    for (let i = 0; i < cleanYs.length; i++) {
      const diff = Math.abs(cleanYs[i] - val);
      if (diff < minDiff) { minDiff = diff; best = i; }
    }
    return best;
  };

  const startXIdx = findXIdx(startPt.x);
  const startYIdx = findYIdx(startPt.y);
  const endXIdx = findXIdx(endPt.x);
  const endYIdx = findYIdx(endPt.y);

  const startKey = `${startXIdx},${startYIdx},0`;
  const openQueue = [
    {
      xIdx: startXIdx,
      yIdx: startYIdx,
      dir: 0,
      g: 0,
      f: Math.abs(cleanXs[startXIdx] - cleanXs[endXIdx]) + Math.abs(cleanYs[startYIdx] - cleanYs[endYIdx]),
    },
  ];

  const cameFrom = new Map();
  const gScore = new Map();
  gScore.set(startKey, 0);

  let goalNodeKey = null;
  const visited = new Set();
  let iterations = 0;
  const maxIterations = 3500;

  while (openQueue.length > 0 && iterations++ < maxIterations) {
    openQueue.sort((a, b) => a.f - b.f);
    const curr = openQueue.shift();
    const currKey = `${curr.xIdx},${curr.yIdx},${curr.dir}`;

    if (visited.has(currKey)) continue;
    visited.add(currKey);

    if (curr.xIdx === endXIdx && curr.yIdx === endYIdx) {
      goalNodeKey = currKey;
      break;
    }

    const curX = cleanXs[curr.xIdx];
    const curY = cleanYs[curr.yIdx];

    const neighbors = [];
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

      const nbKey = `${nb.nxIdx},${nb.nyIdx},${nb.newDir}`;
      if (!gScore.has(nbKey) || tentativeG < gScore.get(nbKey)) {
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
    const pathPoints = [];
    let step = {
      xIdx: parseInt(goalNodeKey.split(',')[0], 10),
      yIdx: parseInt(goalNodeKey.split(',')[1], 10),
      dir: parseInt(goalNodeKey.split(',')[2], 10),
    };

    while (step) {
      pathPoints.push({ x: cleanXs[step.xIdx], y: cleanYs[step.yIdx] });
      step = cameFrom.get(`${step.xIdx},${step.yIdx},${step.dir}`);
    }

    pathPoints.reverse();
    return simplifyCollinear(pathPoints);
  }

  if (relevantObstacles.length > 0) {
    const uMinX = Math.min(...relevantObstacles.map((b) => b.minX));
    const uMaxX = Math.max(...relevantObstacles.map((b) => b.maxX));
    const uMinY = Math.min(...relevantObstacles.map((b) => b.minY));
    const uMaxY = Math.max(...relevantObstacles.map((b) => b.maxY));

    const candidateBypasses = [
      [startPt, { x: startPt.x, y: uMinY - margin }, { x: endPt.x, y: uMinY - margin }, endPt],
      [startPt, { x: startPt.x, y: uMaxY + margin }, { x: endPt.x, y: uMaxY + margin }, endPt],
      [startPt, { x: uMinX - margin, y: startPt.y }, { x: uMinX - margin, y: endPt.y }, endPt],
      [startPt, { x: uMaxX + margin, y: startPt.y }, { x: uMaxX + margin, y: endPt.y }, endPt],
    ];

    let bestBypass = candidateBypasses[0];
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

function routeOrthogonalThroughWaypoints(p1, fromSide, p2, toSide, waypoints = [], obs = []) {
  if ((!waypoints || waypoints.length === 0) && (!obs || obs.length === 0)) {
    return getDirectOrthogonalPath(p1, fromSide, p2, toSide);
  }

  if (!waypoints || waypoints.length === 0) {
    const directPath = getDirectOrthogonalPath(p1, fromSide, p2, toSide);
    let collides = false;
    for (let i = 0; i < directPath.length - 1; i++) {
      for (const b of obs) {
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
  const n1 = getSideNormal(fromSide);
  const n2 = getSideNormal(toSide);

  const p1Out = { x: p1.x + n1.x * margin, y: p1.y + n1.y * margin };
  const p2Out = { x: p2.x + n2.x * margin, y: p2.y + n2.y * margin };

  const cleanWps = (waypoints || []).map((w) => {
    let pt = { ...w };
    for (const b of obs) {
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

  const fullPath = [p1];
  const targets = [p1Out, ...cleanWps, p2Out];

  let curPt = p1;
  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    if (i === 0) {
      fullPath.push(target);
      curPt = target;
      continue;
    }
    const leg = findGridPath(curPt, target, obs, margin);
    for (const pt of leg.slice(1)) {
      fullPath.push(pt);
    }
    curPt = target;
  }

  fullPath.push(p2);
  return simplifyCollinear(fullPath);
}

// Run test with user screenshot case:
const from = { pos: { x: 310, y: 97 }, side: 'right' };
const to = { pos: { x: 202, y: 415 }, side: 'bottom' };

console.log('--- TEST 1: User scenario without waypoints ---');
const r1 = routeOrthogonalThroughWaypoints(from.pos, from.side, to.pos, to.side, [], obstacles);
console.log('Points r1:', r1);
let col1 = 0;
for (let i = 0; i < r1.length - 1; i++) {
  if (segmentIntersectsBox(r1[i], r1[i + 1], rect, 2)) col1++;
  if (segmentIntersectsBox(r1[i], r1[i + 1], diamond, 2)) col1++;
}
console.log('Collisions r1:', col1);

console.log('--- TEST 2: User scenario with waypoint (348, 309) ---');
const r2 = routeOrthogonalThroughWaypoints(from.pos, from.side, to.pos, to.side, [{ x: 348, y: 309 }], obstacles);
console.log('Points r2:', r2);
let col2 = 0;
for (let i = 0; i < r2.length - 1; i++) {
  if (segmentIntersectsBox(r2[i], r2[i + 1], rect, 2)) col2++;
  if (segmentIntersectsBox(r2[i], r2[i + 1], diamond, 2)) col2++;
}
console.log('Collisions r2:', col2);
