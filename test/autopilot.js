// Completability search built on the scripted driver in js/driver.js.

import { Motor, simulateBikePhysics, checkObjectCollision } from '../js/forces.js';
import { PHYS_MAX_TIMESTEP as DT } from '../js/constants.js';
import { Driver, jitteredParams } from '../js/driver.js';

// Everything the simulation needs to resume exactly where it left off.
function snapshot(m, level) {
  return {
    motor: JSON.parse(JSON.stringify(m)),
    taken: level.objects.map((o) => !!o.taken),
  };
}

function restore(snap, level) {
  // The snapshot carries vehicleId, and Object.assign below restores the
  // spec with it, so the machine cannot change mid-search.
  const m = new Motor(snap.motor.vehicleId);
  Object.assign(m, JSON.parse(JSON.stringify(snap.motor)));
  level.objects.forEach((o, i) => { o.taken = snap.taken[i]; });
  return m;
}

function spawnFresh(level, vehicleId) {
  level.objects.forEach((o) => { o.taken = false; });
  const m = new Motor(vehicleId);
  m.spawn(level.start);
  return m;
}

// Drive from a given state. Also returns the state at the moment the last
// hive was collected, so a failed run can be retried from there.
export function drive(level, motor, startTime, opts = {}) {
  const simSeconds = opts.simSeconds ?? 60;
  const driver = new Driver(opts);
  driver.reset(startTime);
  const m = motor;

  let t = startTime;
  let checkpoint = null;
  let checkpointTime = startTime;
  let hivesAtCheckpoint = m.appleCount;
  const steps = Math.floor(simSeconds / DT);

  for (let i = 0; i < steps; i++) {
    t += DT;
    const inp = driver.inputs(level, m, t, DT);
    simulateBikePhysics(level, m, t, DT, inp.gas, inp.brake, inp.rightVolt, inp.leftVolt);
    const state = checkObjectCollision(level, m);

    if (m.appleCount > hivesAtCheckpoint) {
      hivesAtCheckpoint = m.appleCount;
      checkpoint = snapshot(m, level);
      checkpointTime = t;
    }
    if (state === 'finish') {
      return { result: 'finish', time: t, hives: m.appleCount, checkpoint, checkpointTime };
    }
    if (state === 'dead') {
      return { result: 'dead', time: t, hives: m.appleCount, pos: { ...m.bike.r },
               checkpoint, checkpointTime };
    }
  }
  return { result: 'timeout', time: t, hives: m.appleCount, checkpoint, checkpointTime };
}

export function attempt(level, opts = {}) {
  return drive(level, spawnFresh(level, opts.vehicleId), 0, opts);
}

// Segment-wise search with backtracking.
//
// The driver retries from the last hive it collected rather than from the
// start, so a long level becomes a series of short problems. It keeps several
// alternative states per hive count: a checkpoint taken mid-crash is
// unrecoverable, and without backtracking one unlucky run would condemn an
// otherwise fine level.
export function solve(level, budget = 600, baseSeed = 12345, vehicleId = undefined) {
  const states = new Map(); // hive count -> up to MAX_PER_COUNT snapshots
  const MAX_PER_COUNT = 4;
  const TRIES_PER_STATE = 8;

  const push = (hives, snap) => {
    const pool = states.get(hives) || [];
    if (pool.length < MAX_PER_COUNT) pool.push(snap);
    states.set(hives, pool);
  };

  push(0, { ...snapshot(spawnFresh(level, vehicleId), level), time: 0 });

  let runs = 0;
  let seed = baseSeed;
  let bestHives = 0;

  while (runs < budget) {
    const counts = [...states.keys()].sort((a, b) => b - a);
    let advanced = false;

    // Try the deepest states first, then fall back to shallower ones.
    for (const count of counts) {
      for (const snap of states.get(count)) {
        for (let i = 0; i < TRIES_PER_STATE && runs < budget; i++) {
          runs++;
          seed += 7919;
          const run = drive(level, restore(snap, level), snap.time,
                            { ...jitteredParams(seed), simSeconds: 30 });
          if (run.result === 'finish') {
            return { result: 'finish', hives: run.hives, runs, time: run.time };
          }
          if (run.hives > count && run.checkpoint) {
            push(run.hives, { ...run.checkpoint, time: run.checkpointTime });
            bestHives = Math.max(bestHives, run.hives);
            advanced = true;
            break;
          }
        }
        if (advanced) break;
      }
      if (advanced) break;
    }

    if (!advanced) return { result: 'stuck', hives: bestHives, runs, atHives: counts[0] };
  }
  return { result: 'budget', hives: bestHives, runs };
}
