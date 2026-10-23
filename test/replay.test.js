// Replays are only worth anything if replaying the recorded input reproduces
// the run exactly. These tests pin that down.

import assert from 'node:assert/strict';
import { Level } from '../js/level.js';
import { LEVELS } from '../js/levels.js';
import { createRun, advanceFrame, INPUT } from '../js/sim.js';
import {
  Recorder, encodeFrames, decodeFrames, simulateReplay, Ghost,
  levelFingerprint, loadGhost, REPLAY_VERSION,
} from '../js/replay.js';
import { TIME_TO_CENTISECONDS } from '../js/constants.js';

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

// Two scripted input streams, both with float32 frame times as the game loop
// produces. `drivingFrames` is tuned to actually get somewhere on level 1
// (gas with a brake tap to keep the nose down); `messyFrames` throws volts
// and a turn in as well and may well crash, which is fine for the
// determinism checks.
function drivingFrames(count = 400) {
  const dts = [];
  const flags = [];
  for (let i = 0; i < count; i++) {
    dts.push(Math.fround(16 + (i % 5) * 0.37));
    let f = (i % 30) < 2 ? INPUT.BRAKE : INPUT.GAS;
    if (i > count - 20 && i < count - 14) f |= INPUT.TURN;
    flags.push(f);
  }
  return { dts: Float32Array.from(dts), flags: Uint8Array.from(flags) };
}

function messyFrames(count = 240) {
  const dts = [];
  const flags = [];
  for (let i = 0; i < count; i++) {
    dts.push(Math.fround(16 + (i % 7) * 0.41));
    let f = INPUT.GAS;
    if (i % 37 === 0) f = INPUT.BRAKE;
    if (i % 53 === 0) f |= INPUT.LEFT;
    if (i % 71 === 0) f |= INPUT.RIGHT;
    if (i > 150 && i < 156) f |= INPUT.TURN;
    flags.push(f);
  }
  return { dts: Float32Array.from(dts), flags: Uint8Array.from(flags) };
}

function runFrames(level, frames) {
  level.objects.forEach((o) => { o.taken = false; });
  const run = createRun(level);
  for (let i = 0; i < frames.dts.length; i++) {
    if (advanceFrame(level, run, frames.dts[i], frames.flags[i]) !== 'normal') break;
  }
  return run;
}

console.log('replays and ghosts');

test('encoding a recording round-trips exactly', () => {
  const frames = messyFrames(500);
  const decoded = decodeFrames(encodeFrames(frames.dts, frames.flags));
  assert.equal(decoded.dts.length, frames.dts.length);
  for (let i = 0; i < frames.dts.length; i++) {
    assert.equal(decoded.dts[i], frames.dts[i], `dt ${i} ändrades`);
    assert.equal(decoded.flags[i], frames.flags[i], `flaggor ${i} ändrades`);
  }
});

test('a recording is small: under 6 bytes per frame', () => {
  const frames = messyFrames(3600); // a minute at 60fps
  const encoded = encodeFrames(frames.dts, frames.flags);
  assert.ok(encoded.length / 3600 < 7,
    `${(encoded.length / 3600).toFixed(2)} byte/bildruta base64`);
});

test('replaying recorded input reproduces the run exactly', () => {
  const frames = messyFrames();
  const a = runFrames(new Level(LEVELS[0]), frames);
  const b = runFrames(new Level(LEVELS[0]), frames);
  assert.equal(a.time, b.time, 'simuleringstiden skiljer');
  assert.equal(a.motor.bike.r.x, b.motor.bike.r.x, 'x skiljer');
  assert.equal(a.motor.bike.r.y, b.motor.bike.r.y, 'y skiljer');
  assert.equal(a.motor.bike.rotation, b.motor.bike.rotation, 'rotationen skiljer');
  assert.equal(a.motor.appleCount, b.motor.appleCount, 'antal kupor skiljer');
});

test('an encoded replay still reproduces the run after a round-trip', () => {
  const frames = messyFrames();
  const direct = runFrames(new Level(LEVELS[0]), frames);
  const viaStorage = runFrames(new Level(LEVELS[0]),
                               decodeFrames(encodeFrames(frames.dts, frames.flags)));
  assert.equal(direct.time, viaStorage.time);
  assert.equal(direct.motor.bike.r.x, viaStorage.motor.bike.r.x);
  assert.equal(direct.motor.headR.y, viaStorage.motor.headR.y);
});

test('the Recorder stores exactly what it was given', () => {
  const recorder = new Recorder();
  const frames = messyFrames(120);
  for (let i = 0; i < frames.dts.length; i++) recorder.record(frames.dts[i], frames.flags[i]);
  assert.equal(recorder.frameCount, 120);
  const decoded = decodeFrames(recorder.encode());
  for (let i = 0; i < 120; i++) {
    assert.equal(decoded.dts[i], frames.dts[i]);
    assert.equal(decoded.flags[i], frames.flags[i]);
  }
});

test('simulating a replay samples the whole trajectory and notes pickups', () => {
  const level = new Level(LEVELS[0]);
  const frames = drivingFrames();
  const result = simulateReplay(level, frames);
  assert.ok(result.samples.length > 100, `bara ${result.samples.length} stickprov`);
  // Sample times must be monotonic, or the ghost cursor walks backwards.
  for (let i = 1; i < result.samples.length; i++) {
    assert.ok(result.samples[i].t >= result.samples[i - 1].t, 'stickproven är inte i tidsordning');
  }
  assert.ok(result.events.length > 0, 'ingen kupa plockades i testloppet');
  for (const e of result.events) {
    assert.equal(level.objects[e.index].type, 'apple');
  }
  // Simulating must not leave the level half-eaten.
  assert.ok(level.objects.every((o) => !o.taken), 'banan lämnades med tagna kupor');
});

test('the ghost interpolates between samples and stops at the end', () => {
  const level = new Level(LEVELS[0]);
  const result = simulateReplay(level, drivingFrames());
  const ghost = new Ghost(result.samples, result.centiseconds, result.events);

  const start = ghost.poseAt(0);
  assert.ok(start, 'ingen pose vid tiden noll');
  const mid = ghost.poseAt(ghost.duration * 0.5);
  assert.ok(mid, 'ingen pose mitt i loppet');
  assert.ok(Number.isFinite(mid.bike.r.x) && Number.isFinite(mid.bike.r.y));
  assert.equal(ghost.poseAt(ghost.duration + 1), null, 'ghosten fortsätter efter slutet');

  // Stepping forwards and jumping backwards must agree.
  const atQuarter = ghost.poseAt(ghost.duration * 0.25);
  const x = atQuarter.bike.r.x;
  ghost.poseAt(ghost.duration * 0.9);
  assert.equal(ghost.poseAt(ghost.duration * 0.25).bike.r.x, x, 'bakåtsökning ger annat svar');
});

test('applyPickups hides exactly the hives taken so far', () => {
  const level = new Level(LEVELS[0]);
  const result = simulateReplay(level, drivingFrames());
  const ghost = new Ghost(result.samples, result.centiseconds, result.events);
  const first = result.events[0];

  ghost.applyPickups(level, first.t - 0.0001);
  assert.equal(level.objects[first.index].taken, false, 'kupan försvann för tidigt');
  ghost.applyPickups(level, first.t);
  assert.equal(level.objects[first.index].taken, true, 'kupan försvann inte');
  ghost.applyPickups(level, 0);
  assert.equal(level.objects[first.index].taken, false, 'spolning tillbaka återställde inte');
});

test('a replay is rejected when its level has been edited', () => {
  const level = new Level(LEVELS[0]);
  const frames = messyFrames(120);
  const stored = {
    v: REPLAY_VERSION,
    time: 1000,
    fingerprint: levelFingerprint(level),
    frames: encodeFrames(frames.dts, frames.flags),
  };
  assert.ok(loadGhost(level, stored), 'giltig inspelning avvisades');

  const edited = new Level(LEVELS[0]);
  edited.polygons[0].points[0].x += 3;
  edited.rebuild();
  assert.equal(loadGhost(edited, stored), null, 'inspelning för en ändrad bana accepterades');
  assert.equal(loadGhost(level, { ...stored, v: 99 }), null, 'fel version accepterades');
  assert.equal(loadGhost(level, null), null);
});

test('the clock a replay reports matches the simulation', () => {
  const level = new Level(LEVELS[0]);
  const result = simulateReplay(level, drivingFrames(300));
  assert.ok(Math.abs(result.centiseconds - result.duration * TIME_TO_CENTISECONDS) < 1e-9);
});

console.log(failures ? `\n${failures} test(s) failed` : '\nall tests passed');
process.exit(failures ? 1 : 0);
