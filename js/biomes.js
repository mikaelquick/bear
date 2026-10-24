// Worlds. The chooser shows these before it shows any levels, so a player
// picks where they are going before they pick which hill to fall off.
//
// A level says which world it belongs to with a `biome` field. Leaving it
// out means the first one, which is why the twenty levels written before
// worlds existed need no edit at all.
//
// A locked world is shown but cannot be entered. That is deliberate: an
// empty shelf with a date on it tells a player more than no shelf does.

export const DEFAULT_BIOME = 'forest';

export const BIOMES = [
  {
    id: 'forest',
    name: 'Skogen',
    emoji: '🌲',
    blurb: 'Gräs, klippa och stjärnhimmel.',
  },
  {
    id: 'snow',
    name: 'Snön',
    emoji: '❄️',
    blurb: 'Kommer snart. Branta backar och dålig fäste.',
    locked: true,
  },
];

export const biomeOf = (data) => data.biome || DEFAULT_BIOME;

export const findBiome = (id) => BIOMES.find((b) => b.id === id) || null;
