// Built-in levels. Coordinates are metres with +y up, matching the physics.
//
// A level is a set of closed polygons. They are filled even-odd: the inside of
// the outer polygon is open air, and anything nested inside that is solid
// again. So `cave()` builds the playable tube and `block()` carves obstacles
// back out of it.

import { OBJ, GRAVITY_DIR } from './constants.js';

// Floor points run left to right, ceiling points run left to right and get
// reversed, so the two join into one closed tube.
const cave = (floor, ceiling) => ({
  grass: false,
  points: [...floor, ...[...ceiling].reverse()],
});

const block = (points) => ({ grass: false, points });

// Cave plus a decorative grass line along the same floor profile. Grass
// polygons never collide, so reusing the floor points is safe.
const grassyCave = (floor, ceiling) => [cave(floor, ceiling), { grass: true, points: floor }];

const rect = (x, y, w, h) =>
  block([[x, y], [x + w, y], [x + w, y + h], [x, y + h]]);

const start = (x, y) => ({ type: OBJ.START, x, y });
const exit = (x, y) => ({ type: OBJ.EXIT, x, y });
const hive = (x, y, gravity) =>
  gravity === undefined ? { type: OBJ.APPLE, x, y } : { type: OBJ.APPLE, x, y, gravity };
const wasps = (x, y) => ({ type: OBJ.KILLER, x, y });

// The first hill, built once. It is level one of Skogen, and it is also the
// two Beta levels where a new machine is tried out — the whole point of
// those is that the ground underneath is one you already know by heart, so
// what you are feeling is the machine and nothing else. A function, not a
// constant: each level gets its own arrays, and nothing can reach across
// and edit the others.
//
// Changing these numbers changes level one of the game, and its ghosts go
// with it. That is the price of the three staying the same hill, and it is
// the right way round: three copies that drift apart would be worse.
const firstHill = () => ({
  polygons: [
    ...grassyCave(
      [[0, 0], [8, 0], [12, -0.6], [17, -0.6], [21, 0.6], [27, 0.6], [31, 0], [42, 0]],
      [[0, 13], [42, 13]]
    ),
  ],
  objects: [
    start(4, 1.1),
    hive(10, 0.5), hive(14.5, -0.1), hive(23, 1.2), hive(29, 1.1),
    exit(39, 0.6),
  ],
});

export const LEVELS = [
  {
    name: '1. Första steget',
    difficulty: 1,
    ...firstHill(),
  },

  {
    name: '2. Backen',
    difficulty: 1,
    polygons: [
      ...grassyCave(
        [[0, 0], [7, 0], [12, 1.8], [17, 1.8], [21, -0.8], [26, -0.8], [32, 2.0],
         [37, 2.0], [41, 0.6], [48, 0.6]],
        [[0, 16], [48, 16]]
      ),
    ],
    objects: [
      start(3, 1.1),
      hive(14, 2.4), hive(23, -0.2), hive(34, 2.6), hive(39, 1.8), hive(44, 1.2),
      exit(46, 1.2),
    ],
  },

  {
    // The third level is still a lesson, so the jump has nothing under it to
    // die in: a ramp, a lip, and a hive hung in the air over the landing so
    // the reward for flying is on the way you were going anyway. The gap
    // with a pit under it waits until the player has met one of these.
    name: '3. Hoppet',
    difficulty: 2,
    polygons: [
      ...grassyCave(
        [[0, 0], [9, 0], [13, 1.0], [16, 2.6], [18, 3.6], [19, 3.6],
         [19.6, 1.2], [21, 0], [34, 0]],
        [[0, 18], [34, 18]]
      ),
    ],
    objects: [
      start(3, 1.1),
      hive(7, 0.5), hive(15, 2.4), hive(20.5, 4.6), hive(26, 0.6),
      exit(31, 0.6),
    ],
  },

  {
    name: '4. Taket',
    difficulty: 2,
    polygons: [
      cave(
        [[0, 0], [40, 0]],
        // Head height is about 2.1 m, so three metres is room to ride flat
        // under and not much else. That is the whole level.
        [[0, 14], [8, 14], [8, 3.1], [13, 3.1], [13, 14],
         [19, 14], [19, 3.0], [24, 3.0], [24, 14],
         [30, 14], [30, 3.2], [34, 3.2], [34, 14], [40, 14]]
      ),
    ],
    objects: [
      start(3, 1.1),
      hive(10.5, 0.6), hive(21.5, 0.6), hive(32, 0.6), hive(27, 0.6),
      exit(38, 0.6),
    ],
  },

  {
    name: '5. Trappan',
    difficulty: 3,
    polygons: [
      ...grassyCave(
        // Metre steps, taken at about fifty degrees. Short enough to ride up
        // with speed and far too steep to crawl up without it, which is the
        // first time the game asks for throttle rather than patience.
        [[0, 0], [7, 0], [7.9, 1.0],
         [10.5, 1.0], [11.4, 2.0],
         [14, 2.0], [14.9, 3.0],
         [17.5, 3.0], [18.4, 4.0],
         [21, 4.0], [21.9, 5.0],
         [24.5, 5.0], [25.4, 6.0],
         [34, 6.0]],
        [[0, 20], [34, 20]]
      ),
    ],
    objects: [
      start(3, 1.1),
      hive(9, 1.6), hive(12.5, 2.6), hive(16, 3.6), hive(19.5, 4.6), hive(23, 5.6),
      exit(31, 6.6),
    ],
  },

  {
    name: '6. Grottan',
    difficulty: 4,
    polygons: [
      cave(
        // Two bowls with a crest between them. Deeper than they were, and
        // the walls lengthened to match: a bowl you cannot climb out of is
        // a trap, not an obstacle, so every slope here stays under about
        // thirty degrees and the difficulty is in carrying speed through.
        [[0, 0], [9, 0], [12, -2.4], [15, -4.2], [18, -4.2], [22, -2.4],
         [27, 0.4], [31, -2.4], [34, -4.2], [37, -4.2], [41, -2.0], [45, 0],
         [56, 0]],
        [[0, 14], [10, 14], [14, 6], [38, 6], [42, 14], [56, 14]]
      ),
      block([[46, 0], [47.6, 0], [47.6, 0.7], [46.8, 0.9], [46, 0.7]]),
      rect(51, 4.6, 1.6, 10),
    ],
    objects: [
      start(3, 1.1),
      hive(6, 0.6), hive(16, -3.6), hive(27, 1.0), hive(35, -3.6), hive(48, 0.6),
      exit(54, 0.6),
    ],
  },

  {
    name: '7. Getingboet',
    difficulty: 5,
    polygons: [
      ...grassyCave(
        [[0, 0], [12, 0], [16, 2.4], [23, 2.4], [27, 0], [36, 0], [40, 2.0],
         [46, 2.0], [50, 0], [56, 0]],
        [[0, 14], [56, 14]]
      ),
      rect(20, 6.2, 1.2, 8),
      rect(33, 5.0, 1.2, 9),
    ],
    objects: [
      start(3, 1.1),
      // Head height is about 2.1 m over whatever you are standing on, and a
      // swarm reaches about 0.65 m. These sit a metre above a clean line:
      // riding flat passes, and the smallest wheelie does not.
      wasps(9, 3.1), wasps(17.5, 5.6), wasps(25.5, 5.4),
      wasps(31, 3.1), wasps(44.5, 5.3), wasps(48, 3.1),
      hive(13, 1.1), hive(21, 3.0), hive(30, 0.6), hive(41, 2.6), hive(52, 0.6),
      exit(54, 0.6),
    ],
  },

  {
    name: '8. Upp och ner',
    difficulty: 5,
    polygons: [
      cave(
        [[0, 0], [48, 0]],
        [[0, 9.5], [48, 9.5]]
      ),
      // Pillars off the floor. On the way out they are behind you at head
      // height and harmless; on the way back, riding the roof, they are the
      // obstacles — which is the joke of the level made into geometry.
      rect(29, 0, 1.2, 6.6),
      rect(38, 0, 1.2, 6.8),
    ],
    objects: [
      start(3, 1.1),
      hive(9, 0.6), hive(15, 0.6),
      // Taking this one flips gravity upwards. The bear falls to the ceiling,
      // and the hall is no longer tall enough to be lazy about the volt.
      hive(21, 0.6, GRAVITY_DIR.UP),
      hive(26, 8.9), hive(34, 8.9), hive(42, 8.9),
      exit(45, 8.9),
    ],
  },

  {
    name: '9. Nedstigningen',
    difficulty: 5,
    polygons: [
      cave(
        // Steeper steps down and shorter shelves to land on, so each ramp
        // has to be left at a speed that fits the one after it.
        [[0, 24], [9, 24], [14, 18], [22, 18], [27, 12], [35, 12],
         [40, 6], [48, 6], [53, 0], [68, 0], [84, 0]],
        [[0, 34], [84, 34]]
      ),
    ],
    objects: [
      start(3, 25.1),
      hive(6, 24.6), hive(18, 18.6), hive(31, 12.6), hive(44, 6.6), hive(60, 0.6),
      // Hung over the shelves: carry too much speed off a ramp and the
      // swarm is what you land in rather than the shelf.
      wasps(19, 21.1), wasps(32, 15.1), wasps(45, 9.1), wasps(58, 3.1),
      exit(80, 0.6),
    ],
  },

  {
    name: '10. Björnens mardröm',
    difficulty: 6,
    polygons: [
      cave(
        // Act 1: long run-up and a gap. Act 2: a climb past hung swarms.
        // Act 3: a tall hall for the gravity flip.
        [[0, 0], [18, 0], [23, 2.6], [26, 3.6],
         [26, -10], [31.5, -10], [31.5, 2],
         [35, 2], [41, 5.6], [48, 5.6], [52, 2], [58, 2], [62, 0], [90, 0]],
        [[0, 20], [26, 20], [30, 12.5], [56, 12.5], [58, 11], [90, 11]]
      ),
      rect(54, 6.2, 1.4, 7),
    ],
    objects: [
      start(3, 1.1),
      hive(10, 0.6), hive(15, 0.6),
      wasps(28, -9.4),
      hive(38, 4.5), hive(45, 6.2),
      wasps(43, 9.2), wasps(49, 9.2),
      hive(56, 2.6),
      // Flip up and finish along the ceiling.
      hive(66, 0.6, GRAVITY_DIR.UP),
      hive(72, 10.4), hive(78, 10.4), hive(83, 10.4),
      exit(87, 10.4),
    ],
  },

  // ---------------------------------------------------------------------
  // Second half. Same vocabulary as the first ten, but longer, tighter and
  // with less room to recover from a bad landing.
  // ---------------------------------------------------------------------

  {
    name: '11. Dubbelhoppet',
    difficulty: 6,
    polygons: [
      ...grassyCave(
        // Both gaps a metre wider than they were. The lips are unchanged,
        // so the speed that used to be enough no longer is.
        [[0, 0], [14, 0], [19, 2.6], [22, 3.6],
         [22, -8], [27.5, -8], [27.5, 2],
         [34, 2], [39, 4.6], [42, 5.6],
         [42, -8], [47.5, -8], [47.5, 3],
         [56, 3], [60, 1], [74, 1]],
        [[0, 18], [74, 18]]
      ),
    ],
    objects: [
      start(3, 1.1),
      hive(8, 0.6), hive(18, 2.4),
      wasps(24, -7.4),
      hive(31, 2.6), hive(38, 5.0),
      wasps(44, -7.4),
      hive(50, 3.6), hive(64, 1.6), hive(70, 1.6),
      exit(72, 1.6),
    ],
  },

  {
    name: '12. Smitvägen',
    difficulty: 6,
    polygons: [
      cave(
        [[0, 0], [8, 0], [8.6, 0.5], [12, 0.5], [12.6, 0], [20, 0],
         [20.6, 0.5], [24, 0.5], [24.6, 0], [34, 0],
         [34.6, 0.5], [38, 0.5], [38.6, 0], [50, 0]],
        // Every beam a third of a metre lower. Over the bumps in the floor
        // that leaves about sixty centimetres of air above the bear's ears.
        [[0, 15], [6, 15], [6, 3.2], [11, 3.2], [11, 15],
         [16, 15], [16, 3.1], [22, 3.1], [22, 15],
         [27, 15], [27, 3.0], [33, 3.0], [33, 15],
         [38, 15], [38, 3.2], [43, 3.2], [43, 15], [50, 15]]
      ),
    ],
    objects: [
      start(3, 1.1),
      hive(8.5, 1.1), hive(18, 0.6), hive(22.5, 1.1), hive(30, 0.6), hive(40, 1.1),
      exit(47, 0.6),
    ],
  },

  {
    name: '13. Getingdansen',
    difficulty: 7,
    polygons: [
      ...grassyCave(
        [[0, 0], [10, 0], [14, 2], [22, 2], [26, 0], [36, 0],
         [40, 2], [48, 2], [52, 0], [64, 0]],
        [[0, 15], [64, 15]]
      ),
    ],
    objects: [
      start(3, 1.1),
      // Every swarm clears a smooth line by a metre, and no more than that.
      // Land badly and it is the swarm you hit, not the ground.
      wasps(7, 3.1), wasps(17, 5.1), wasps(20, 5.1),
      wasps(30, 3.1), wasps(33, 3.1), wasps(35, 3.1),
      wasps(43, 5.1), wasps(46, 5.1), wasps(57, 3.1), wasps(60, 3.1),
      hive(12, 1.6), hive(24, 2.6), hive(31, 0.6), hive(44, 2.6), hive(54, 0.6),
      exit(61, 0.6),
    ],
  },

  {
    name: '14. Klyftan',
    difficulty: 7,
    polygons: [
      ...grassyCave(
        // The way out of the gorge is six metres shorter than the way in.
        // Dropping in is still free; leaving now costs a run-up.
        [[0, 0], [10, 0], [20, -8], [30, -8], [42, 0], [56, 0], [60, 2], [72, 2]],
        [[0, 16], [72, 16]]
      ),
    ],
    objects: [
      start(3, 1.1),
      hive(8, 0.6),
      hive(16, -3.4), hive(25, -7.4), hive(36, -2.4),
      wasps(22, -4.6), wasps(27, -4.6),
      hive(52, 0.6), hive(66, 2.6),
      exit(70, 2.6),
    ],
  },

  {
    name: '15. Takridaren',
    difficulty: 7,
    polygons: [
      cave(
        [[0, 0], [64, 0]],
        [[0, 12], [64, 12]]
      ),
      // Ceiling bumps. Once gravity is inverted these are the steps you ride
      // over. Half again as tall as they were, and spread further apart to
      // pay for it: upside down, the run-in to a step is most of the work.
      rect(25, 11.4, 2.5, 0.6),
      rect(37, 11.4, 2.5, 0.6),
      rect(49, 11.4, 2.5, 0.6),
    ],
    objects: [
      start(3, 1.1),
      hive(9, 0.6), hive(15, 0.6),
      hive(20, 0.6, GRAVITY_DIR.UP),
      // Between the bumps, never on one: a hive inside the geometry can
      // never be collected.
      hive(31, 11.4), hive(42, 11.4), hive(54, 11.4), hive(58, 11.4),
      exit(61, 11.4),
    ],
  },

  {
    name: '16. Uppstigningen',
    difficulty: 8,
    polygons: [
      cave(
        [[0, 0], [72, 0]],
        [[0, 20], [9, 20], [9, 3.6], [18, 3.6], [18, 20], [72, 20]]
      ),
      // One long wedge up to the gallery. Its tip points the way you are
      // already going, so you ride onto it instead of into its underside —
      // and the squeeze beneath it means the low road ends here.
      block([[22, 0], [40, 7.0], [72, 7.0], [72, 6.2], [40, 6.2]]),
      rect(44, 11.0, 1.4, 9),
      rect(53, 10.6, 1.4, 10),
      rect(63, 11.0, 1.4, 9),
    ],
    objects: [
      start(3, 1.1),
      hive(8, 0.6), hive(13.5, 0.6), hive(19, 0.6),
      hive(34, 5.3),
      hive(46, 7.6), hive(57, 7.6), hive(66, 7.6),
      exit(70, 7.6),
    ],
  },

  {
    name: '17. Stupet',
    difficulty: 8,
    polygons: [
      cave(
        // Six metres down each time instead of five, onto shelves two
        // metres shorter. The arithmetic of the level is the same; the
        // margin for arriving wrong is not.
        [[0, 26], [8, 26], [15, 20], [22, 20], [29, 14], [36, 14],
         [43, 8], [50, 8], [57, 2], [72, 2], [78, 0], [92, 0]],
        [[0, 36], [92, 36]]
      ),
    ],
    objects: [
      start(3, 27.1),
      hive(6, 26.6), hive(18, 20.6), hive(32, 14.6), hive(46, 8.6), hive(64, 2.6),
      // Carry too much speed off a ramp and you land in one of these.
      wasps(19, 25.1), wasps(33, 19.1), wasps(47, 13.1), wasps(61, 7.1),
      wasps(68, 5.1),
      exit(88, 0.6),
    ],
  },

  {
    name: '18. Bikupan',
    difficulty: 8,
    polygons: [
      cave(
        [[0, 0], [76, 0]],
        [[0, 30], [76, 30]]
      ),
      // Six landings in a row. Each deck ends in a short down-ramp so you
      // roll off rather than step off, which is what keeps the plunge a
      // landing rather than a coin toss. The ramps are a metre shorter than
      // they were and give back half a metre less height, so every drop is
      // three metres now instead of two and a half — and the edge arrives
      // that much sooner after the deck does.
      //
      // Five metre decks were tried here and are simply not landable: the
      // autopilot got one hive out of six. There is a difference between a
      // hard level and a cliff, and this is where it sits.
      block([[0, 25.0], [10, 25.0], [13, 24.0], [13, 23.4], [10, 24.4], [0, 24.4]]),
      block([[0, 21.0], [20, 21.0], [23, 20.0], [23, 19.4], [20, 20.4], [0, 20.4]]),
      block([[0, 17.0], [30, 17.0], [33, 16.0], [33, 15.4], [30, 16.4], [0, 16.4]]),
      block([[0, 13.0], [40, 13.0], [43, 12.0], [43, 11.4], [40, 12.4], [0, 12.4]]),
      block([[0, 9.0], [48, 9.0], [51, 8.0], [51, 7.4], [48, 8.4], [0, 8.4]]),
      block([[0, 5.0], [54, 5.0], [64, 0], [54, 4.4], [0, 4.4]]),
    ],
    objects: [
      start(3, 26.1),
      hive(6, 25.6), hive(16, 21.6), hive(26, 17.6),
      hive(36, 13.6), hive(46, 9.6), hive(56, 4.6),
      exit(70, 0.6),
    ],
  },

  {
    name: '19. Vildmarken',
    difficulty: 9,
    polygons: [
      ...grassyCave(
        [[0, 0], [12, 0], [17, 2.6], [20, 3.6],
         [20, -8], [24.5, -8], [24.5, 2],
         [32, 2], [36, 5], [44, 5], [48, 2], [60, 2],
         [64, 0], [78, 0], [82, 2.4], [90, 2.4], [94, 0], [106, 0]],
        [[0, 20], [34, 20], [38, 13], [58, 13], [62, 20], [106, 20]]
      ),
      rect(52, 5.4, 1.4, 8),
      rect(70, 0, 1.4, 1.4),
      // Over the flat run-in, not over the ramp before it: on the ramp the
      // ground is a metre higher and the same spike leaves no gap at all.
      rect(96, 3.4, 1.2, 17),
    ],
    objects: [
      start(3, 1.1),
      hive(8, 0.6), hive(16, 2.4),
      wasps(22, -7.4),
      hive(28, 2.6), hive(40, 5.6),
      wasps(40, 9.4), wasps(56, 6.6),
      hive(58, 2.6), hive(74, 0.6), hive(86, 3.0), hive(99, 0.6),
      exit(103, 0.6),
    ],
  },

  {
    name: '20. Björnens sista färd',
    difficulty: 10,
    polygons: [
      ...grassyCave(
        [[0, 0], [16, 0], [21, 2.6], [24, 3.6],
         [24, -9], [28.5, -9], [28.5, 2],
         [36, 2], [41, 5], [50, 5], [54, 2], [64, 2],
         [68, 0], [132, 0]],
        [[0, 22], [36, 22], [40, 15], [62, 15], [66, 22], [74, 22],
         [76, 13], [132, 13]]
      ),
      rect(58, 6.5, 1.4, 8.5),
      rect(44, 11.0, 1.4, 4),
    ],
    objects: [
      start(3, 1.1),
      hive(9, 0.6), hive(20, 2.4),
      wasps(26, -8.4),
      hive(33, 2.6), hive(45, 5.6), hive(52, 5.6),
      wasps(44.7, 9.4),
      hive(62, 2.6), hive(72, 0.6),
      // Flip up and finish along the roof.
      hive(84, 0.6, GRAVITY_DIR.UP),
      hive(94, 12.4), hive(104, 12.4), hive(112, 12.4),
      exit(120, 12.4),
    ],
  },

  // ---------------------------------------------------------------------
  // Snön. Same bear, same machines, slippery ground: `grip` below 1 means
  // the wheels bite less, so the engine pulls softly and the brake barely
  // holds. Nothing else changes — the trick is that speed you have gained
  // is speed you are going to keep.
  // ---------------------------------------------------------------------

  {
    name: '1. Första halkan',
    biome: 'snow',
    grip: 0.55,
    difficulty: 3,
    polygons: [
      ...grassyCave(
        [[0, 0], [14, 0], [18, -1.2], [26, -1.2], [30, 0], [44, 0],
         [48, 1.4], [56, 1.4], [60, 0], [70, 0], [74, 2.2], [86, 2.2]],
        [[0, 15], [86, 15]]
      ),
    ],
    objects: [
      start(3, 1.1),
      hive(9, 0.6), hive(22, -0.6), hive(37, 0.6), hive(52, 2.0), hive(66, 0.6),
      // The last ramp is too steep to climb from a standstill on ice, so the
      // whole rink before it is the run-up. That is the lesson of the world
      // in one shape: keep what you have got.
      hive(80, 2.8),
      exit(84, 2.8),
    ],
  },

  {
    name: '2. Isgrottan',
    biome: 'snow',
    grip: 0.42,
    difficulty: 6,
    polygons: [
      ...grassyCave(
        [[0, 0], [14, 0], [18, -2.4], [28, -2.4], [32, 0], [42, 0], [45, 1.8],
         [45, -9], [50, -9], [50, -0.8],
         [54, -0.8], [57, 0], [66, 0], [72, 2.4], [80, 2.4], [84, 0], [94, 0]],
        [[0, 16], [32, 16], [36, 9], [58, 9], [62, 16], [94, 16]]
      ),
      // A spike of ice over the run-in to the pot. You arrive at it with all
      // the speed the rink gave you and no way to take any off, so the only
      // line under it is a flat one.
      rect(89, 2.8, 1.2, 13.2),
    ],
    objects: [
      start(3, 1.1),
      hive(8, 0.6), hive(23, -1.8),
      // Hung at the usual head height plus a margin, so a flat line passes
      // and a wheelie does not. On ice there is no scrubbing the speed off
      // before them, so staying flat is the whole job.
      wasps(35, 3.4), wasps(38, 3.4),
      wasps(47.5, -8.4),
      hive(58, 0.6),
      // The climb is too steep to pull up from a standstill on this little
      // grip, so the rink before it has to be ridden as a run-up.
      hive(76, 3.0), hive(87, 0.6),
      exit(91, 0.6),
    ],
  },

  // ---------------------------------------------------------------------
  // Beta. The car levels, parked here until they are good enough to go one
  // apiece into the worlds above. They carry a `theme` so they already look
  // like the world they are headed for, and `vehicles` so the chooser only
  // offers the machine they were built around.
  //
  // These are meant to be easy. The game they play is not the bikes' game:
  // there is no volt, the car straightens itself, and the only question is
  // when to spend the air. A gap of about five metres goes at speed with no
  // jet at all, so the ones here are nine and up.
  // ---------------------------------------------------------------------

  {
    // Home in Skogen, still on the Beta shelf. No number in the name: the
    // tile numbers itself by where it sits in the world you are looking
    // at, and this one is 21 in Skogen and 1 in Beta.
    name: 'Provturen',
    biome: ['forest', 'beta'],
    theme: 'forest',
    vehicles: ['car'],
    difficulty: 2,
    polygons: [
      ...grassyCave(
        // Every landing sits a metre and a half below the lip it was
        // launched from. The first version had them level and the far wall
        // took the car in the face on a jump that was nine tenths right —
        // slack on the landing is what turns "nearly" into "just".
        [[0, 0], [26, 0],
         [26, -12], [33, -12], [33, -1.5],
         [52, -1.5],
         [52, -12], [61, -12], [61, -3],
         [80, -3],
         [80, -12], [91, -12], [91, -5],
         [112, -5]],
        [[0, 20], [112, 20]]
      ),
    ],
    objects: [
      start(3, 1.1),
      // On the line, not off it: the point of the level is the jumping.
      hive(16, 0.6), hive(42, -0.9), hive(70, -2.4), hive(100, -4.4),
      // Seven metres, then nine, then eleven.
      wasps(29, -11.4), wasps(56, -11.4), wasps(85, -11.4),
      exit(108, -4.4),
    ],
  },

  {
    name: 'Isbanan',
    biome: ['snow', 'beta'],
    theme: 'snow',
    vehicles: ['car'],
    grip: 0.5,
    difficulty: 3,
    polygons: [
      ...grassyCave(
        // Ice under a car with no volt: the jet is the only thing that
        // stops you, because it is the only thing that can get you off the
        // ground. Longer run-ups than the forest one, since half the grip
        // means half the pull and the speed has to be found somewhere.
        [[0, 0], [30, 0],
         [30, -12], [38, -12], [38, -1.5],
         [48, -1.5], [54, -4], [66, -4],
         [66, -14], [76, -14], [76, -5.5],
         [98, -5.5],
         [98, -14], [108, -14], [108, -7],
         [130, -7]],
        [[0, 20], [130, 20]]
      ),
    ],
    objects: [
      start(3, 1.1),
      hive(18, 0.6), hive(44, -0.9), hive(86, -4.9), hive(118, -6.4),
      wasps(34, -11.4), wasps(71, -13.4), wasps(103, -13.4),
      exit(126, -6.4),
    ],
  },

  // ---------------------------------------------------------------------
  // The two machine levels. Both are level one of Skogen, unchanged, down
  // to the last hive — and that is the design, not laziness. A new machine
  // is only worth feeling on ground you already know: ride the same hill
  // on the Måncykeln and on the Magneten and the only thing that differs
  // between the two runs is what you are sitting on. On new ground you
  // would be learning the ground.
  //
  // They stay in Beta alone. Someone who never opens that shelf never
  // meets either machine, which is the point of the shelf.
  // ---------------------------------------------------------------------

  {
    name: 'Lätta steget',
    biome: 'beta',
    theme: 'forest',
    vehicles: ['moonbike'],
    difficulty: 1,
    ...firstHill(),
  },

  {
    name: 'Tunga steget',
    biome: 'beta',
    theme: 'forest',
    vehicles: ['magnet'],
    difficulty: 1,
    ...firstHill(),
  },

  {
    name: 'Trampturen',
    biome: 'beta',
    theme: 'forest',
    vehicles: ['trike'],
    difficulty: 1,
    ...firstHill(),
  },

  {
    name: 'Balansturen',
    biome: 'beta',
    theme: 'forest',
    vehicles: ['unicycle'],
    difficulty: 1,
    ...firstHill(),
  },
];
