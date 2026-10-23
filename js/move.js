// Port of src/physics/move.cpp from elma-classic.
// This file is where the "elasto" feel actually lives: wheels resolve against
// up to two anchor points, and with a single contact the wheel *rolls* about
// that point using the parallel axis theorem rather than sliding.

import { add, sub, scale, dot, rot90, len, unit } from './vec2.js';
import { getTwoAnchorPoints } from './collision.js';
import {
  GROUND_ESCAPE_VELOCITY,
  WHEEL_DEFORMATION_LENGTH,
  BUMP_THRESHOLD,
  SPRING_TENSION_COEFFICIENT,
  SPRING_RESISTANCE_COEFFICIENT,
  GRAVITY,
  BODY_DY,
} from './constants.js';

// Push the wheel out of the ground so it stands on the anchor point.
function moveWheelOutOfGround(rb, point) {
  const dx = rb.r.x - point.x;
  const dy = rb.r.y - point.y;
  const length = Math.hypot(dx, dy);
  if (length < rb.radius - WHEEL_DEFORMATION_LENGTH) {
    const push = (rb.radius - WHEEL_DEFORMATION_LENGTH - length) / length;
    rb.r = { x: rb.r.x + dx * push, y: rb.r.y + dy * push };
  }
}

// Delete all velocity towards the point, keep the perpendicular component.
// Returns false when there is no actual collision.
function simulateAnchorPointCollision(rb, point, force, onBump) {
  const dx = rb.r.x - point.x;
  const dy = rb.r.y - point.y;
  const length = Math.hypot(dx, dy);
  const n = { x: dx / length, y: dy / length };
  if (dot(n, rb.v) > -GROUND_ESCAPE_VELOCITY && dot(n, force) > 0) return false;

  const along = dot(n, rb.v);
  const deleted = { x: n.x * along, y: n.y * along };
  rb.v = { x: rb.v.x - deleted.x, y: rb.v.y - deleted.y };

  const bumpMagnitude = Math.hypot(deleted.x, deleted.y);
  if (bumpMagnitude > BUMP_THRESHOLD && onBump) {
    onBump(Math.min((bumpMagnitude / 0.8) * 0.1, 0.99), point);
  }
  return true;
}

// Rolling on point2, do the *forces* push the wheel towards point1? If so the
// wheel is wedged. This is the original Across behaviour (ignores velocity).
function validAnchorPointsOld(point1, point2, rb, force, torque) {
  const d = sub(rb.r, point2);
  const length = len(d);
  const n = scale(d, 1 / length);
  const n90 = rot90(n);
  const totalTorque = torque + length * dot(n90, force);
  return !(dot(sub(point1, point2), n90) * totalTorque < 0);
}

// Rolling on point2, does the wheel *slide* towards point1? Elma-exclusive
// unstick fix. The units here mix rad/s and m/s — that is in the original too.
function validAnchorPointsNew(point1, point2, rb) {
  const d = sub(rb.r, point2);
  const length = len(d);
  const n = scale(d, 1 / length);
  const n90 = rot90(n);
  const speedDirection = rb.angularVelocity + length * dot(n90, rb.v);
  return !(dot(sub(point1, point2), n90) * speedDirection < 0);
}

const anchorBuf = [null, null];

export function rigidbodyMovement(level, rb, force, torque, dt, doCollision, onBump) {
  let count = 0;
  let point1 = null;
  let point2 = null;

  if (doCollision) {
    count = getTwoAnchorPoints(level, rb.r, rb.radius, anchorBuf);
    point1 = anchorBuf[0];
    point2 = anchorBuf[1];
    rb.touchingEdge = count > 0;
  }

  if (count > 0) moveWheelOutOfGround(rb, point1);
  if (count > 1) moveWheelOutOfGround(rb, point2);

  // Two contacts: try to discard one so the wheel does not wedge in a corner.
  if (count === 2 && len(rb.v) > 1.0) {
    if (!validAnchorPointsNew(point1, point2, rb)) {
      count = 1;
      point1 = point2;
    } else if (!validAnchorPointsNew(point2, point1, rb)) {
      count = 1;
    }
  }
  if (count === 2 && len(rb.v) < 1.0) {
    if (!validAnchorPointsOld(point1, point2, rb, force, torque)) {
      count = 1;
      point1 = point2;
    } else if (!validAnchorPointsOld(point2, point1, rb, force, torque)) {
      count = 1;
    }
  }

  if (count === 2) {
    if (!simulateAnchorPointCollision(rb, point2, force, onBump)) count = 1;
  }
  if (count >= 1) {
    if (!simulateAnchorPointCollision(rb, point1, force, onBump)) {
      if (count === 2) {
        count = 1;
        point1 = point2;
      } else {
        count = 0;
      }
    }
  }

  // Airborne: plain integration.
  if (count === 0) {
    rb.angularVelocity += (torque / rb.inertia) * dt;
    rb.rotation += rb.angularVelocity * dt;
    rb.v = { x: rb.v.x + (force.x / rb.mass) * dt, y: rb.v.y + (force.y / rb.mass) * dt };
    rb.r = { x: rb.r.x + rb.v.x * dt, y: rb.r.y + rb.v.y * dt };
    return;
  }

  // Two contacts: wedged solid.
  if (count === 2) {
    rb.v = { x: 0, y: 0 };
    rb.angularVelocity = 0;
    return;
  }

  // One contact: roll about the contact point.
  const d = sub(rb.r, point1);
  const length = len(d);
  const n = scale(d, 1 / length);
  const n90 = rot90(n);
  rb.angularVelocity = dot(rb.v, n90) / rb.radius;
  torque += dot(force, n90) * rb.radius;
  // Parallel axis theorem: rolling about the rim, not the hub.
  const inertiaEdge = rb.inertia + rb.mass * length * length;
  rb.angularVelocity += (torque / inertiaEdge) * dt;
  rb.rotation += rb.angularVelocity * dt;
  rb.v = scale(n90, rb.angularVelocity * rb.radius);
  rb.r = { x: rb.r.x + rb.v.x * dt, y: rb.r.y + rb.v.y * dt };
}

// Teleport the rider's body into the allowed region around the bike: a
// diagonal line at the bottom, a flat ceiling, and an elliptical back-top
// corner. See docs/body_boundaries.png in elma-classic.
const LINE_POINT = { x: -0.35, y: 0.13 };
const LINE_SLOPE = { x: 0.14 - -0.35, y: 0.36 - 0.13 };
const LINE_SLOPE_ORTHO_UNIT = unit({ x: -LINE_SLOPE.y, y: LINE_SLOPE.x });
const ELLIPSE_HEIGHT = 0.48;
const ELLIPSE_WIDTH = 0.26;
const ELLIPSE_R2 = ELLIPSE_HEIGHT * ELLIPSE_HEIGHT;
const ELLIPSE_R = ELLIPSE_HEIGHT;
const ELLIPSE_A2 = (ELLIPSE_HEIGHT / ELLIPSE_WIDTH) ** 2;

function bodyBoundaries(mot, i, j) {
  let bx;
  let by;
  if (mot.flipped) {
    bx = dot(i, sub(mot.bike.r, mot.bodyR));
    by = dot(j, sub(mot.bodyR, mot.bike.r));
  } else {
    bx = dot(i, sub(mot.bodyR, mot.bike.r));
    by = dot(j, sub(mot.bodyR, mot.bike.r));
  }

  // Bottom, along a diagonal line
  const rel = { x: bx - LINE_POINT.x, y: by - LINE_POINT.y };
  const below = dot(rel, LINE_SLOPE_ORTHO_UNIT);
  if (below < 0) {
    bx -= LINE_SLOPE_ORTHO_UNIT.x * below;
    by -= LINE_SLOPE_ORTHO_UNIT.y * below;
  }
  by = Math.min(by, ELLIPSE_HEIGHT); // top
  bx = Math.max(bx, -0.5); // front
  bx = Math.min(bx, ELLIPSE_WIDTH); // back

  // Back-top corner, along an ellipse
  if (bx > 0 && by > 0) {
    const distance2 = bx * bx * ELLIPSE_A2 + by * by;
    if (distance2 > ELLIPSE_R2) {
      const ratio = ELLIPSE_R / Math.sqrt(distance2);
      bx *= ratio;
      by *= ratio;
    }
  }

  if (mot.flipped) {
    mot.bodyR = { x: j.x * by - i.x * bx + mot.bike.r.x, y: j.y * by - i.y * bx + mot.bike.r.y };
  } else {
    mot.bodyR = { x: i.x * bx + j.x * by + mot.bike.r.x, y: i.y * bx + j.y * by + mot.bike.r.y };
  }
}

// The rider's body hangs off the bike on a spring that is 5x stiffer and 3x
// more damped than the wheel springs.
export function bodyMovement(mot, gravityDir, i, j, dt) {
  bodyBoundaries(mot, i, j);

  const neutral = { x: mot.bike.r.x + j.x * BODY_DY, y: mot.bike.r.y + j.y * BODY_DY };
  const delta = sub(neutral, mot.bodyR);

  const springLength = Math.max(len(delta), 1e-7);
  const forceSpring = scale(delta, (springLength * SPRING_TENSION_COEFFICIENT * 5.0) / springLength);

  const bodyLengthOrtho = rot90(sub(mot.bodyR, mot.bike.r));
  const neutralV = add(scale(bodyLengthOrtho, mot.bike.angularVelocity), mot.bike.v);
  const relativeV = sub(mot.bodyV, neutralV);
  const forceDamping = scale(relativeV, SPRING_RESISTANCE_COEFFICIENT * 3.0);

  const g = mot.bike.mass * GRAVITY;
  const total = {
    x: forceSpring.x - forceDamping.x + gravityDir.x * g,
    y: forceSpring.y - forceDamping.y + gravityDir.y * g,
  };

  mot.bodyV = {
    x: mot.bodyV.x + (total.x / mot.bike.mass) * dt,
    y: mot.bodyV.y + (total.y / mot.bike.mass) * dt,
  };
  mot.bodyR = { x: mot.bodyR.x + mot.bodyV.x * dt, y: mot.bodyR.y + mot.bodyV.y * dt };
}
