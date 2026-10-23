// Proves every built-in level can actually be finished.
//
// The scripted driver in autopilot.js is a crude player, so if it can clear a
// level a person certainly can. The search is seeded, so this is a stable
// regression test: edit a level into an impossible shape and it fails here.

import assert from 'node:assert/strict';
import { Level } from '../js/level.js';
import { LEVELS } from '../js/levels.js';
import { solve } from './autopilot.js';

const BUDGET = 1200;

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

for (const data of LEVELS) {
  test(`${data.name} can be finished`, () => {
    const level = new Level(data);
    const started = Date.now();
    const result = solve(level, BUDGET);
    const detail = `${result.hives}/${level.totalApples} kupor, ${result.runs} körningar, ${Date.now() - started} ms`;
    assert.equal(result.result, 'finish', `autopiloten fastnade: ${detail}`);
  });
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
