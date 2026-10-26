// Worlds. The chooser shows these before it shows any levels, so a player
// picks where they are going before they pick which hill to fall off.
//
// A level says which world it belongs to with a `biome` field. Leaving it
// out means the first one, which is why the twenty levels written before
// worlds existed need no edit at all.
//
// It may also be a list, and then the level stands on more than one shelf.
// That is not a trick: the car levels earned a place in Skogen and Snön and
// are still wanted in Beta, and one level in two worlds is a far better
// answer than two copies of it. They share a name, so they share a record
// and a ghost — finishing it in Skogen finishes it in Beta.
//
// A locked world is shown but cannot be entered. That is deliberate: an
// empty shelf tells a player more than no shelf does.
//
// A world is an emoji, a name, and how far through it you are — nothing
// else. Flavour text is a sentence a child has to get past before they can
// press anything, and the picture already says what the sentence would.

export const DEFAULT_BIOME = 'forest';

export const BIOMES = [
  { id: 'forest', name: 'Skogen', emoji: '🌲' },
  { id: 'snow', name: 'Snön', emoji: '❄️' },
  // The workshop, in public. The car levels were born here, and they are
  // still here — they have since also taken a place in the worlds above,
  // which was always what this shelf was for. Shipping them in plain sight
  // beat hiding them behind a flag: they got played, which is the only way
  // they got good enough to leave.
  { id: 'beta', name: 'Beta', emoji: '🧪' },
];

// Every world a level stands in. One is the usual case and comes back as a
// list of one, so callers never have to care which form was written.
export const biomesOf = (data) => {
  const b = data && data.biome;
  if (!b) return [DEFAULT_BIOME];
  return Array.isArray(b) ? b : [b];
};

// The first one is the level's home: it decides the palette when no theme
// is given, and it is what a round-trip through Level.toJSON keeps.
export const biomeOf = (data) => biomesOf(data)[0];

export const inBiome = (data, id) => biomesOf(data).includes(id);

export const findBiome = (id) => BIOMES.find((b) => b.id === id) || null;
