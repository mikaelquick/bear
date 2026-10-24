// One rendered frame's worth of simulation, shared by live play and replay.
//
// The physics only ever sees (dtMs, inputFlags) per frame. That is the whole
// reason a replay can be a few kilobytes of input instead of a recording of
// every position: feed the same pairs back in and the same run comes out.

import { Motor, simulateBikePhysics, checkObjectCollision } from './forces.js';
import { MS_TO_PHYS_TIME, PHYS_MAX_TIMESTEP, VOLT_DELAY } from './constants.js';

export const INPUT = { GAS: 1, BRAKE: 2, LEFT: 4, RIGHT: 8, TURN: 16 };

const MAX_SUBSTEPS_PER_FRAME = 40;

export function createRun(level, vehicleId) {
  const motor = new Motor(vehicleId);
  motor.spawn(level.start);
  return {
    motor,
    time: 0,        // simulation time
    elapsedMs: 0,   // real milliseconds fed in so far
    voltTime: -VOLT_DELAY,
    turnPrev: false,
    state: 'normal',
  };
}

// Returns 'normal' | 'dead' | 'finish'.
//
// Hooks are for presentation only (sound, particles, ghost sampling); nothing
// they do may feed back into the simulation, or replays stop matching.
export function advanceFrame(level, run, dtMs, flags, hooks = {}) {
  run.elapsedMs += dtMs;
  const targetTime = Math.max(run.elapsedMs * MS_TO_PHYS_TIME, 0.000001);
  const mot = run.motor;

  let substeps = 0;
  while (substeps < MAX_SUBSTEPS_PER_FRAME) {
    let dt = targetTime - run.time;
    if (dt < 0.000001) break;
    dt = Math.min(dt, PHYS_MAX_TIMESTEP);
    run.time += dt;
    substeps++;

    const brake = (flags & INPUT.BRAKE) !== 0;
    const gas = (flags & INPUT.GAS) !== 0 && !brake; // brake wins over gas

    // Holding a volt key re-volts every VOLT_DELAY, as in the original.
    let rightVolt = false;
    let leftVolt = false;
    if (run.time > run.voltTime + VOLT_DELAY) {
      if (flags & INPUT.RIGHT) { rightVolt = true; run.voltTime = run.time; }
      if (flags & INPUT.LEFT) { leftVolt = true; run.voltTime = run.time; }
    }

    simulateBikePhysics(level, mot, run.time, dt, gas, brake, rightVolt, leftVolt, hooks.onBump);
    const result = checkObjectCollision(level, mot, hooks.onObject);

    if (hooks.onSubstep) hooks.onSubstep(run);

    if (result !== 'normal') {
      run.state = result;
      return result;
    }

    // Turning is edge-triggered: one flip per press.
    const turnDown = (flags & INPUT.TURN) !== 0;
    if (!run.turnPrev && turnDown) {
      mot.turn();
      if (hooks.onTurn) hooks.onTurn();
    }
    run.turnPrev = turnDown;
  }

  if (substeps >= MAX_SUBSTEPS_PER_FRAME) {
    // Fell too far behind (a hidden tab, say). Resync rather than spiral.
    run.elapsedMs = run.time / MS_TO_PHYS_TIME;
  }
  return 'normal';
}
