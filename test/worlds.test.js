// Every world has to be fully painted.
//
// This exists because of a real bug: the snow shipped looking like snow but
// the wheels still kicked up brown grit, so riding it threw up sand. The
// colours and the particles are decided in two different files, and nothing
// connected them — adding a world meant remembering both.
//
// So the rule is checked instead of remembered: every world in BIOMES must
// resolve to a theme carrying every key the renderer and the effects read,
// and no two worlds may share the stuff that is supposed to tell them apart.

import assert from 'node:assert/strict';
import { BIOMES, DEFAULT_BIOME, biomesOf, inBiome } from '../js/biomes.js';
import { themeFor } from '../js/render.js';
import { Effects } from '../js/effects.js';
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

console.log('worlds');

// Everything render.js and effects.js look up by name. A world missing one
// of these silently falls back to the forest's, which is the bug.
const PAINT = [
  'skyTop', 'skyBottom', 'ground', 'groundLight', 'edge',
  'grass', 'grassLight', 'ridgeFar', 'ridgeNear', 'star',
];

test('every world has a full palette', () => {
  for (const biome of BIOMES) {
    const theme = themeFor(biome.id);
    for (const key of PAINT) {
      assert.ok(theme[key], `${biome.id} has no ${key}`);
    }
  }
});

test('every world says what its wheels throw up', () => {
  for (const biome of BIOMES) {
    const { spray } = themeFor(biome.id);
    assert.ok(spray, `${biome.id} has no spray`);
    assert.match(spray.color, /^\d+,\d+,\d+$/, `${biome.id}: spray colour is not r,g,b`);
    assert.ok(spray.gravity < 0, `${biome.id}: spray must fall back down`);
    assert.ok(spray.life > 0, `${biome.id}: spray must last a moment`);
  }
});

// The bug itself, named: snow is not sand.
test('the snow does not kick up the forest floor', () => {
  const forest = themeFor('forest');
  const snow = themeFor('snow');
  assert.notEqual(snow.spray.color, forest.spray.color);
  assert.notEqual(snow.ground, forest.ground);
  assert.notEqual(snow.skyBottom, forest.skyBottom);
});

test('the effects take their spray from the world being played', () => {
  const effects = new Effects();
  assert.deepEqual(effects.spray, themeFor(DEFAULT_BIOME).spray,
    'a fresh Effects starts on the default world');
  for (const biome of BIOMES) {
    effects.setBiome(biome.id);
    assert.deepEqual(effects.spray, themeFor(biome.id).spray, `after setBiome('${biome.id}')`);
  }
});

test('an unknown world falls back rather than throwing', () => {
  // Custom levels and old saved data can name anything at all.
  assert.deepEqual(themeFor('atlantis'), themeFor(DEFAULT_BIOME));
  assert.deepEqual(themeFor(undefined), themeFor(DEFAULT_BIOME));
  assert.deepEqual(themeFor(null), themeFor(DEFAULT_BIOME));
});

test('every built-in level belongs to a world that exists', () => {
  const known = new Set(BIOMES.map((b) => b.id));
  for (const data of LEVELS) {
    for (const id of biomesOf(data)) {
      assert.ok(known.has(id), `${data.name} is in world "${id}"`);
    }
  }
});

// A level may stand in several worlds, and then it is the same level: one
// name, one record, one ghost. Two entries sharing a name would be two of
// everything, which is the mistake this guards against.
test('no two levels share a name', () => {
  const seen = new Set();
  for (const data of LEVELS) {
    assert.ok(!seen.has(data.name), `${data.name} is in the list twice`);
    seen.add(data.name);
  }
});

// The palette follows the home world unless a theme says otherwise, so a
// level that stands in two of them has to pick one or be painted by hand.
test('a level in more than one world says how it is painted', () => {
  for (const data of LEVELS) {
    if (biomesOf(data).length < 2) continue;
    assert.ok(data.theme, `${data.name} is in several worlds with no theme`);
    assert.ok(biomesOf(data).includes(data.theme),
      `${data.name} is painted "${data.theme}", a world it is not in`);
  }
});

test('no world is both unlocked and empty', () => {
  // An empty shelf is fine while it is locked — that is how Snön shipped —
  // but an open world with nothing in it is a dead end.
  for (const biome of BIOMES) {
    if (biome.locked) continue;
    const count = LEVELS.filter((l) => inBiome(l, biome.id)).length;
    assert.ok(count > 0, `${biome.id} is open but has no levels`);
  }
});

console.log(failures ? `\n${failures} test(s) failed` : '\nall tests passed');
process.exit(failures ? 1 : 0);
