// Worlds. The chooser shows these before it shows any levels, so a player
// picks where they are going before they pick which hill to fall off.
//
// A level says which world it belongs to with a `biome` field. Leaving it
// out means the first one, which is why the twenty levels written before
// worlds existed need no edit at all.
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
  // The workshop, in public. These are the car levels, and they live here
  // rather than one apiece in the worlds above until they are good enough
  // to earn a place there. Shipping them in plain sight beats hiding them
  // behind a flag: they get played, which is the only way they get better.
  { id: 'beta', name: 'Beta', emoji: '🧪' },
];

export const biomeOf = (data) => data.biome || DEFAULT_BIOME;

export const findBiome = (id) => BIOMES.find((b) => b.id === id) || null;
