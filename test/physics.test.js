// Smoke tests for the physics port. Run with: npm test
import assert from 'node:assert/strict';
import { Level } from '../js/level.js';
import { LEVELS } from '../js/levels.js';
import { Motor, simulateBikePhysics, checkObjectCollision } from '../js/forces.js';
import { PHYS_MAX_TIMESTEP, TIME_TO_CENTISECONDS, OBJ } from '../js/constants.js';

const DT = PHYS_MAX_TIMESTEP;

function run(level, motor, steps, input = {}) {
  let time = 0;
  let state = 'normal';
  for (let i = 0; i < steps; i++) {
    time += DT;
    simulateBikePhysics(
      level, motor, time, DT,
      !!input.gas, !!input.brake, !!input.rightVolt, !!input.leftVolt
    );
    state = checkObjectCollision(level, motor);
    if (state !== 'normal') break;
  }
  return { time, state };
}

function freshLevel(index = 0) {
  return new Level(LEVELS[index]);
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

console.log('physics port');

test('bike settles on the ground instead of exploding', () => {
  const level = freshLevel();
  const motor = new Motor();
  motor.spawn(level.start);
  const { state } = run(level, motor, 400);
  assert.equal(state, 'normal', 'bike died while just sitting there');
  assert.ok(Number.isFinite(motor.bike.r.x) && Number.isFinite(motor.bike.r.y), 'position went NaN');
  // Floor is at y=0, wheels have radius 0.4 and hang 0.6 below the frame.
  assert.ok(Math.abs(motor.bike.r.y - 1.0) < 0.35,
    `frame should rest near y=1.0, got ${motor.bike.r.y.toFixed(3)}`);
  assert.ok(Math.abs(motor.bike.r.x - level.start.x) < 0.3, 'bike drifted sideways at rest');
});

test('wheels end up touching the ground', () => {
  const level = freshLevel();
  const motor = new Motor();
  motor.spawn(level.start);
  run(level, motor, 400);
  assert.ok(motor.leftWheel.touchingEdge, 'left wheel not touching');
  assert.ok(motor.rightWheel.touchingEdge, 'right wheel not touching');
});

test('throttle drives the bike forward', () => {
  const level = freshLevel();
  const motor = new Motor();
  motor.spawn(level.start);
  run(level, motor, 200);
  const x0 = motor.bike.r.x;
  run(level, motor, 400, { gas: true });
  assert.ok(motor.bike.r.x > x0 + 2,
    `expected forward motion, moved ${(motor.bike.r.x - x0).toFixed(2)} m`);
});

test('turning makes the bike drive the other way', () => {
  const level = freshLevel();
  const motor = new Motor();
  motor.spawn(level.start);
  run(level, motor, 200);
  motor.turn();
  const x0 = motor.bike.r.x;
  run(level, motor, 300, { gas: true });
  assert.ok(motor.bike.r.x < x0, 'flipped bike should drive left');
});

test('a volt spins the bike and the free momentum is taken back', () => {
  const level = freshLevel();
  const motor = new Motor();
  motor.spawn(level.start);
  run(level, motor, 200);

  let time = 200 * DT;
  // One left volt
  time += DT;
  simulateBikePhysics(level, motor, time, DT, false, false, false, true);
  assert.ok(motor.voltingLeft, 'volt did not start');
  assert.ok(motor.bike.angularVelocity > 5, 'volt gave no angular velocity');

  // Run past VOLT_DELAY * 0.25 so the volt ends
  for (let i = 0; i < 40; i++) {
    time += DT;
    simulateBikePhysics(level, motor, time, DT, false, false, false, false);
  }
  assert.equal(motor.voltingLeft, false, 'volt never ended');
});

test('eating a beehive counts, and gravity hives flip gravity', () => {
  const level = new Level({
    name: 'test',
    polygons: [{ grass: false, points: [[0, 0], [20, 0], [20, 12], [0, 12]] }],
    objects: [
      { type: OBJ.START, x: 3, y: 1.1 },
      { type: OBJ.APPLE, x: 3.85, y: 0.5 },
      { type: OBJ.EXIT, x: 18, y: 0.6 },
    ],
  });
  const motor = new Motor();
  motor.spawn(level.start);
  checkObjectCollision(level, motor);
  assert.equal(motor.appleCount, 1, 'hive not collected');
  assert.equal(level.objects[1].taken, true, 'hive not marked taken');
});

test('the exit only finishes the level once every hive is gone', () => {
  const level = new Level({
    name: 'test',
    polygons: [{ grass: false, points: [[0, 0], [20, 0], [20, 12], [0, 12]] }],
    objects: [
      { type: OBJ.START, x: 3, y: 1.1 },
      { type: OBJ.APPLE, x: 10, y: 0.6 },
      { type: OBJ.EXIT, x: 3.85, y: 0.5 },
    ],
  });
  const motor = new Motor();
  motor.spawn(level.start);
  assert.equal(checkObjectCollision(level, motor), 'normal', 'finished with a hive left');
  level.objects[1].taken = true;
  motor.appleCount = 1;
  assert.equal(checkObjectCollision(level, motor), 'finish', 'did not finish with all hives taken');
});

test('a wasp swarm kills on contact', () => {
  const level = new Level({
    name: 'test',
    polygons: [{ grass: false, points: [[0, 0], [20, 0], [20, 12], [0, 12]] }],
    objects: [
      { type: OBJ.START, x: 3, y: 1.1 },
      { type: OBJ.KILLER, x: 3.85, y: 0.5 },
      { type: OBJ.EXIT, x: 18, y: 0.6 },
    ],
  });
  const motor = new Motor();
  motor.spawn(level.start);
  assert.equal(checkObjectCollision(level, motor), 'dead', 'wasps did not kill');
});

test('the head dying is what ends a run', () => {
  const level = new Level({
    name: 'test',
    // Ceiling low enough that the head is inside it at spawn.
    polygons: [{ grass: false, points: [[0, 0], [20, 0], [20, 2.2], [0, 2.2]] }],
    objects: [
      { type: OBJ.START, x: 3, y: 1.1 },
      { type: OBJ.EXIT, x: 18, y: 0.6 },
    ],
  });
  const motor = new Motor();
  motor.spawn(level.start);
  assert.equal(checkObjectCollision(level, motor), 'dead', 'head should have hit the ceiling');
});

test('every built-in level has a start, an exit and valid geometry', () => {
  for (const data of LEVELS) {
    const level = new Level(data);
    assert.ok(level.objects.some((o) => o.type === OBJ.START), `${data.name}: no start`);
    assert.ok(level.objects.some((o) => o.type === OBJ.EXIT), `${data.name}: no exit`);
    assert.ok(level.segments.length > 2, `${data.name}: too little geometry`);
    for (const o of level.objects) {
      assert.ok(Number.isFinite(o.x) && Number.isFinite(o.y), `${data.name}: bad object position`);
    }
  }
});

test('every built-in level spawns the bear alive and lets it settle', () => {
  for (let i = 0; i < LEVELS.length; i++) {
    const level = freshLevel(i);
    const motor = new Motor();
    motor.spawn(level.start);
    const { state } = run(level, motor, 300);
    assert.equal(state, 'normal', `${LEVELS[i].name}: died on spawn`);
    assert.ok(Number.isFinite(motor.bike.r.y), `${LEVELS[i].name}: NaN position`);
  }
});

test('simulation time converts to the displayed clock correctly', () => {
  // 1 second of real time should read as 100 centiseconds.
  const oneSecondOfSimTime = 1000 * 0.182 * 0.0024;
  assert.ok(Math.abs(oneSecondOfSimTime * TIME_TO_CENTISECONDS - 100) < 1e-9);
});

console.log(failures ? `\n${failures} test(s) failed` : '\nall tests passed');
process.exit(failures ? 1 : 0);
