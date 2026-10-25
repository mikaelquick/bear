// A scripted driver. Used two ways: as the attract-mode demo behind the menu,
// and by the test suite to prove every level can be finished.
//
// It is not meant to play well. It aims at the nearest hive, keeps the bike
// roughly parallel to the ground on the way there, and volts to level out in
// the air.
//
// A machine with an air jet and no volt is driven differently: it straightens
// itself, so there is nothing to level out, and the one extra decision is
// when to spend the tank. The rule is "falling, so push" — which is also
// roughly what a person does over a gap.

import { VOLT_DELAY, OBJ, GRAVITY_DIR } from './constants.js';

const TAU = Math.PI * 2;

// Deterministic RNG so a run can be reproduced from its seed.
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

export const wrap = (a) => {
  let x = (a + Math.PI) % TAU;
  if (x < 0) x += TAU;
  return x - Math.PI;
};

// Upright for the current gravity: the bike's "up" must oppose gravity.
export function uprightRotation(gravityDirection) {
  switch (gravityDirection) {
    case GRAVITY_DIR.UP: return Math.PI;
    case GRAVITY_DIR.LEFT: return -Math.PI / 2;
    case GRAVITY_DIR.RIGHT: return Math.PI / 2;
    default: return 0;
  }
}

export function pickTarget(level, m) {
  const hives = level.objects.filter((o) => o.type === OBJ.APPLE && !o.taken);
  const pool = hives.length ? hives : level.objects.filter((o) => o.type === OBJ.EXIT);
  let best = null;
  let bestCost = Infinity;
  for (const o of pool) {
    const dx = Math.abs(o.x - m.bike.r.x);
    const dy = o.y - m.bike.r.y;
    // Climbing is expensive. Dropping is cheap but not free: on a descent the
    // driver must still clear the hive on its current deck before diving,
    // since it can never climb back for one it skipped.
    const cost = dx + (dy > 0 ? dy * 4 : -dy * 2);
    if (cost < bestCost) { bestCost = cost; best = o; }
  }
  return best;
}

export const DRIVER_DEFAULTS = {
  seed: 1,
  pitchLimit: 0.22,
  absPitchLimit: 0.34,
  airLevelTolerance: 0.5,
  turnDistance: 2.0,
  maxSpeed: 8.0,
  jitter: 0,
  // How fast it has to be falling before the jet goes on. Low enough and
  // it fires over every bump and the tank is empty when the gap arrives.
  thrustFallSpeed: 1.5,
};

// Randomised parameter set, for search and for variety in the demo.
export function jitteredParams(seed) {
  const r = rng(seed);
  return {
    seed,
    pitchLimit: 0.12 + r() * 0.3,
    absPitchLimit: 0.2 + r() * 0.45,
    airLevelTolerance: 0.25 + r() * 0.6,
    turnDistance: 1.2 + r() * 2.5,
    maxSpeed: r() < 0.25 ? Infinity : 3.5 + r() * 11,
    jitter: r() * 0.3,
    thrustFallSpeed: 0.4 + r() * 3,
  };
}

export class Driver {
  constructor(opts = {}) {
    this.p = { ...DRIVER_DEFAULTS, ...opts };
    this.rand = rng(this.p.seed);
    this.reset(0);
  }

  reset(startTime = 0) {
    this.voltTime = startTime - VOLT_DELAY;
    this.turnCooldown = 0;
  }

  // Decides this step's inputs. May flip the bike as a side effect, since a
  // turn is an instantaneous action rather than a held key.
  inputs(level, m, time, dt) {
    const p = this.p;
    const target = pickTarget(level, m);
    if (!target) return NO_INPUT;

    const onGround = m.leftWheel.touchingEdge || m.rightWheel.touchingEdge;
    const upright = uprightRotation(m.gravityDirection);

    // Under upwards gravity the bike hangs inverted, so the same `flipped`
    // flag drives the other way along x.
    const inverted = m.gravityDirection === GRAVITY_DIR.UP;
    const drivesRight = inverted ? !m.flipped : m.flipped;
    const wantRight = target.x > m.bike.r.x;
    this.turnCooldown -= dt;
    if (m.spec.canTurn && onGround && wantRight !== drivesRight &&
        Math.abs(target.x - m.bike.r.x) > p.turnDistance && this.turnCooldown <= 0) {
      m.turn();
      this.turnCooldown = 0.3;
    }

    const facing = m.flipped ? 1 : -1;
    const slope = onGround
      ? Math.atan2(m.rightWheel.r.y - m.leftWheel.r.y, m.rightWheel.r.x - m.leftWheel.r.x)
      : upright;
    const relPitch = wrap(m.bike.rotation - slope) * facing;
    const absPitch = wrap(m.bike.rotation - upright) * facing;

    let gas = false;
    let brake = false;
    let rightVolt = false;
    let leftVolt = false;
    let thrust = false;

    if (onGround) {
      const limit = p.pitchLimit + (this.rand() - 0.5) * p.jitter;
      // Speed governor. Without it the driver rockets off every ledge and
      // sails straight over the hive it was aiming for.
      const dxt = target.x - m.bike.r.x;
      const closing = Math.sign(dxt) === Math.sign(m.bike.v.x);
      const speed = Math.abs(m.bike.v.x);
      const nearly = Math.abs(dxt) < 2.5 && closing;
      const tooFast = closing && speed > (nearly ? p.maxSpeed * 0.6 : p.maxSpeed);
      gas = relPitch < limit && absPitch < p.absPitchLimit && !tooFast;
      if (absPitch < -0.7) brake = true; // nose buried, lift the back end
    } else if (m.spec.thrustTank > 0) {
      // Airborne with a tank: push while falling. Nothing to level out —
      // the machine does that itself — so the jet is the only decision,
      // and spending it on the way down is what carries a gap.
      const falling = (m.bike.v.y * -direction(m)) > p.thrustFallSpeed;
      thrust = falling && m.thrustLeft > 0;
    } else {
      // Airborne: volt towards upright so we land on both wheels.
      const err = wrap(upright - m.bike.rotation);
      // Where we will be shortly, so we stop volting before overshooting.
      const predicted = wrap(err - m.bike.angularVelocity * 0.18);
      if (Math.abs(predicted) > p.airLevelTolerance && time > this.voltTime + VOLT_DELAY) {
        if (predicted > 0) leftVolt = true; // a left volt adds angular velocity
        else rightVolt = true;
        this.voltTime = time;
      }
    }

    if (m.spec.volt && onGround && time > this.voltTime + VOLT_DELAY) {
      if (relPitch > 0.55) { // wheelying over backwards
        if (m.flipped) rightVolt = true; else leftVolt = true;
        this.voltTime = time;
      } else if (relPitch < -0.8) {
        if (m.flipped) leftVolt = true; else rightVolt = true;
        this.voltTime = time;
      }
    }

    return { gas, brake, rightVolt, leftVolt, thrust };
  }
}

// "Down" for the gravity in force, as a sign on v.y: falling is positive.
const direction = (m) => (m.gravityDirection === GRAVITY_DIR.UP ? -1 : 1);

const NO_INPUT = { gas: false, brake: false, rightVolt: false, leftVolt: false, thrust: false };
