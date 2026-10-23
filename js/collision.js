// Port of src/physics/collision.cpp from elma-classic.

import { rot90 } from './vec2.js';
import { TWO_POINT_DISCRIMINATION_DISTANCE, OBJECT_RADIUS } from './constants.js';

// Collision between a circle (wheel or head) and one segment. Returns the
// point of collision along the segment, or null.
function getAnchorPoint(r, radius, seg) {
  const relX = r.x - seg.r.x;
  const relY = r.y - seg.r.y;
  const positionAlongLine = relX * seg.unit.x + relY * seg.unit.y;

  if (positionAlongLine < 0) {
    // Behind the segment: only the start vertex can touch.
    if (Math.hypot(relX, relY) < radius) return { x: seg.r.x, y: seg.r.y };
    return null;
  }
  if (positionAlongLine > seg.length) {
    // In front of the segment: only the end vertex can touch.
    const ex = seg.r.x + seg.unit.x * seg.length;
    const ey = seg.r.y + seg.unit.y * seg.length;
    if (Math.hypot(r.x - ex, r.y - ey) < radius) return { x: ex, y: ey };
    return null;
  }
  // Alongside the segment: check perpendicular distance.
  const n = rot90(seg.unit);
  const distance = relX * n.x + relY * n.y;
  if (distance < -radius || distance > radius) return null;
  return {
    x: seg.r.x + seg.unit.x * positionAlongLine,
    y: seg.r.y + seg.unit.y * positionAlongLine,
  };
}

// Returns up to two anchor points. Two points that sit closer together than
// TWO_POINT_DISCRIMINATION_DISTANCE are merged into their midpoint — that is
// what happens when a wheel lands exactly on a vertex shared by two segments.
export function getTwoAnchorPoints(level, r, radius, out) {
  const segs = level.segmentsNear(r);
  let count = 0;
  for (let i = 0; i < segs.length; i++) {
    const point = getAnchorPoint(r, radius, segs[i]);
    if (!point) continue;

    if (count === 1) {
      out[1] = point;
      count = 2;
      if (Math.hypot(out[0].x - point.x, out[0].y - point.y) <
          TWO_POINT_DISCRIMINATION_DISTANCE) {
        out[0] = { x: (out[0].x + point.x) * 0.5, y: (out[0].y + point.y) * 0.5 };
        count = 1;
      } else {
        return 2;
      }
    } else if (count === 0) {
      out[0] = point;
      count = 1;
    }
  }
  return count;
}

// Index of the first active object the circle touches, or -1.
export function getTouchingObject(level, r, radius) {
  const objects = level.objects;
  const maxDistance = radius + OBJECT_RADIUS;
  const maxDistance2 = maxDistance * maxDistance;
  for (let i = 0; i < objects.length; i++) {
    const obj = objects[i];
    if (obj.taken) continue;
    if (obj.type === 'start') continue;
    const dx = r.x - obj.x;
    const dy = r.y - obj.y;
    if (dx * dx + dy * dy < maxDistance2) return i;
  }
  return -1;
}
