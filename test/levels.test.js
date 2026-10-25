// Proves every built-in level can actually be finished.
//
// The scripted driver in autopilot.js is a crude player, so if it can clear a
// level a person certainly can. The search is seeded, so this is a stable
// regression test: edit a level into an impossible shape and it fails here.

import assert from 'node:assert/strict';
import { Level } from '../js/level.js';
import { LEVELS } from '../js/levels.js';
import { solve } from './autopilot.js';
import { vehiclesFor } from '../js/vehicles.js';

// One successful run is proof, so the search gets several different
// starting seeds before a level is called unfinishable. That matters more
// than it sounds: the driver is crude and its luck varies, and a single
// unlucky seed had two levels looking impossible on the bicycle when both
// are plainly not.
//
// The list is fixed and the search is seeded all the way down, so this test
// is deterministic: it does not fail at random, it fails or passes the same
// way every time. What the seeds buy is margin. The hardest levels are near
// enough to the driver's ceiling that it clears them on only two or three
// seeds out of eight, so a short list could one day say "impossible" about
// a level that is merely hard, purely because of which seeds are on it.
// Six costs nothing on a level that passes — the search stops at the first
// seed that finishes — and only the genuinely marginal ones pay for the
// rest.
const SEEDS = [12345, 777, 4242, 31337, 99, 60606];
const BUDGET = 800;

// Proof is one finish. Returns the best attempt for the failure message.
function canFinish(level, vehicleId) {
  let best = null;
  for (const seed of SEEDS) {
    level.objects.forEach((o) => { o.taken = false; });
    const result = solve(level, BUDGET, seed, vehicleId);
    if (result.result === 'finish') return result;
    if (!best || result.hives > best.hives) best = result;
  }
  return best;
}

let failures = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ok  ${name}`);
  } catch (err) {
    failures++;
    console.log(`FAIL  ${name}`);
    console.log(`      ${err.message}`);
  }
}

console.log('level completability');

// Every level, on every vehicle it may be ridden on. A level is only proven
// completable with the machine it was proven with, and vehicles do not
// handle alike — the bicycle is slower and shorter, so a gap the motorbike
// clears is a real question for it.
//
// Most levels name no machine and are therefore claimed for all of them.
// A level that names one is claiming less, so it is only held to that: the
// car levels cannot be done without an air jet and nothing else has one.
for (const data of LEVELS) {
  for (const vehicle of vehiclesFor(data)) {
    test(`${data.name} can be finished on ${vehicle.name.toLowerCase()}`, () => {
      const level = new Level(data);
      const started = Date.now();
      const result = canFinish(level, vehicle.id);
      const detail = `bäst ${result.hives}/${level.totalApples} kupor över ${SEEDS.length} frön, ${Date.now() - started} ms`;
      assert.equal(result.result, 'finish', `autopiloten fastnade: ${detail}`);
    });
  }
}

test('no level hides a hive or the pot inside solid ground', () => {
  // A collectible buried in geometry can never be reached. Approximate the
  // check by requiring every object to sit clear of every wall segment.
  for (const data of LEVELS) {
    const level = new Level(data);
    for (const obj of level.objects) {
      if (obj.type === 'start') continue;
      for (const seg of level.segments) {
        const relX = obj.x - seg.r.x;
        const relY = obj.y - seg.r.y;
        let along = relX * seg.unit.x + relY * seg.unit.y;
        along = Math.max(0, Math.min(seg.length, along));
        const cx = seg.r.x + seg.unit.x * along;
        const cy = seg.r.y + seg.unit.y * along;
        const distance = Math.hypot(obj.x - cx, obj.y - cy);
        assert.ok(
          distance > 0.12,
          `${data.name}: ${obj.type} vid (${obj.x}, ${obj.y}) ligger i en vägg`
        );
      }
    }
  }
});

console.log(failures ? `\n${failures} test(s) failed` : '\nall tests passed');
process.exit(failures ? 1 : 0);
