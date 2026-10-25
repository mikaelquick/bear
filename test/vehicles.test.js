// Rules about which machine may be sent at which level.
//
// These exist because getting one wrong is quiet. A level that forgets to
// name the car gets claimed for the bikes, which is caught — the
// completability test will fail loudly. The other direction is the silent
// one: a typo in a `vehicles` list, or a new machine that cannot right
// itself, costs nothing at startup and everything in play.

import assert from 'node:assert/strict';
import { VEHICLES, vehiclesFor, findVehicle } from '../js/vehicles.js';
import { LEVELS } from '../js/levels.js';

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

console.log('vehicles');

const ids = new Set(VEHICLES.map((v) => v.id));

test('every vehicle a level names actually exists', () => {
  for (const data of LEVELS) {
    if (!data.vehicles) continue;
    for (const id of data.vehicles) {
      assert.ok(ids.has(id), `${data.name} names "${id}", which is not a machine`);
    }
    assert.ok(vehiclesFor(data).length > 0, `${data.name} allows no machine at all`);
  }
});

test('a level that names nothing gets every general machine', () => {
  const general = VEHICLES.filter((v) => v.general !== false).map((v) => v.id);
  assert.deepEqual(vehiclesFor({}).map((v) => v.id), general);
  assert.ok(general.length >= 2, 'there should be more than one machine to choose from');
});

// The car has no volt and cannot even turn round, so half the twenty bike
// levels are impossible in it. It is only ever offered where a level asks.
test('a machine marked not-general is only offered where it is named', () => {
  for (const vehicle of VEHICLES) {
    if (vehicle.general !== false) continue;
    assert.ok(
      !vehiclesFor({}).some((v) => v.id === vehicle.id),
      `${vehicle.id} is offered on levels that never asked for it`
    );
    assert.deepEqual(vehiclesFor({ vehicles: [vehicle.id] }).map((v) => v.id), [vehicle.id]);
  }
});

// The one that would be expensive to find by playing: a machine that can
// neither volt nor straighten itself is one bad launch away from lying on
// its roof with no way back, and the player can only restart.
test('a machine that cannot volt can right itself some other way', () => {
  for (const { id, spec } of VEHICLES.map((v) => ({ id: v.id, spec: v.spec }))) {
    if (spec.volt) continue;
    assert.ok(spec.selfLevel > 0, `${id} cannot volt and does not self-level`);
    assert.ok(spec.selfLevelDamping > 0, `${id} self-levels but never settles`);
  }
});

test('a machine with a jet has air to put in it, and vice versa', () => {
  for (const { id, spec } of VEHICLES.map((v) => ({ id: v.id, spec: v.spec }))) {
    assert.equal(spec.thrust > 0, spec.thrustTank > 0,
      `${id} has one half of a thruster and not the other`);
    if (spec.thrustTank > 0) {
      assert.ok(spec.thrustRefill > 0, `${id}'s tank never refills`);
      // Below its own weight the jet is scenery. The car is about 284 kg
      // all in, at 10 m/s².
      const weight = (spec.bike.mass + spec.leftWheel.mass + spec.rightWheel.mass) * 10;
      assert.ok(spec.thrust > weight, `${id}'s jet (${spec.thrust} N) cannot lift it (${weight} N)`);
    }
  }
});

test('every level a jet-less machine could be sent at is one it could do', () => {
  // Not provable here — that is what levels.test.js is for. What is
  // provable is the bookkeeping behind it: every level naming a machine
  // with a jet names *only* machines with jets, so the chooser never puts
  // a bike on a level built around gaps no bike can cross.
  for (const data of LEVELS) {
    const allowed = vehiclesFor(data);
    const jets = allowed.filter((v) => v.spec.thrustTank > 0);
    if (jets.length === 0) continue;
    assert.equal(jets.length, allowed.length,
      `${data.name} mixes machines with and without an air jet`);
  }
});

test('a ghost of any machine can be drawn', () => {
  // blankMotor in replay.js reads these off the spec; a new field it does
  // not copy means a ghost drawn as the wrong machine.
  for (const vehicle of VEHICLES) {
    const spec = findVehicle(vehicle.id).spec;
    for (const key of ['frameColor', 'pedals', 'body']) {
      assert.notEqual(spec[key], undefined, `${vehicle.id} has no ${key} for the ghost to read`);
    }
  }
});

console.log(failures ? `\n${failures} test(s) failed` : '\nall tests passed');
process.exit(failures ? 1 : 0);
