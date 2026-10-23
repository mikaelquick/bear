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

export const LEVELS = [
  {
    name: '1. Första steget',
    difficulty: 1,
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
    name: '3. Hoppet',
    difficulty: 3,
    polygons: [
      cave(
        [[0, 0], [9, 0], [13, 1.0], [16, 2.6], [17.5, 3.6],
         [17.5, -9], [22.0, -9], [22.0, 1],
         [26, 1], [36, 1]],
        [[0, 18], [36, 18]]
      ),
    ],
    objects: [
      start(3, 1.1),
      hive(7, 0.5), hive(15, 2.6),
      wasps(19, -8.6), wasps(21, -8.6),
      hive(25, 1.6), hive(31, 1.6),
      exit(34, 1.6),
    ],
  },

  {
    name: '4. Taket',
    difficulty: 2,
    polygons: [
      cave(
        [[0, 0], [40, 0]],
        [[0, 14], [8, 14], [8, 3.6], [13, 3.6], [13, 14],
         [19, 14], [19, 3.4], [24, 3.4], [24, 14],
         [30, 14], [30, 3.8], [34, 3.8], [34, 14], [40, 14]]
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
    difficulty: 2,
    polygons: [
      cave(
        [[0, 0], [7, 0], [7.8, 0.7],
         [10.5, 0.7], [11.3, 1.4],
         [14, 1.4], [14.8, 2.1],
         [17.5, 2.1], [18.3, 2.8],
         [21, 2.8], [21.8, 3.5],
         [24.5, 3.5], [25.3, 4.2],
         [34, 4.2]],
        [[0, 20], [34, 20]]
      ),
    ],
    objects: [
      start(3, 1.1),
      hive(9, 1.3), hive(12.5, 2.0), hive(16, 2.7), hive(19.5, 3.4), hive(23, 4.1),
      exit(31, 4.8),
    ],
  },

  {
    name: '6. Grottan',
    difficulty: 3,
    polygons: [
      cave(
        [[0, 0], [9, 0], [12, -1.8], [15, -3], [17, -3], [20, -1.6], [23, 0.2],
         [26, -1.6], [29, -3], [31, -3], [34, -1.8], [37, 0], [48, 0]],
        [[0, 14], [10, 14], [14, 7], [32, 7], [36, 14], [48, 14]]
      ),
      block([[38, 0], [39.6, 0], [39.6, 0.7], [38.8, 0.9], [38, 0.7]]),
      rect(43, 5.0, 1.6, 9),
    ],
    objects: [
      start(3, 1.1),
      hive(6, 0.6), hive(16, -2.4), hive(23, 0.8), hive(30, -2.4), hive(40, 0.6),
      exit(46, 0.6),
    ],
  },

  {
    name: '7. Getingboet',
    difficulty: 4,
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
      // Hung at head height plus a margin: a smooth line passes, a wheelie does not.
      wasps(9, 3.4), wasps(17.5, 6.4), wasps(25.5, 6.0),
      wasps(31, 3.4), wasps(44.5, 6.5), wasps(48, 6.0),
      hive(13, 1.1), hive(21, 3.0), hive(30, 0.6), hive(41, 2.6), hive(52, 0.6),
      exit(54, 0.6),
    ],
  },

  {
    name: '8. Upp och ner',
    difficulty: 4,
    polygons: [
      cave(
        [[0, 0], [48, 0]],
        [[0, 11], [48, 11]]
      ),
    ],
    objects: [
      start(3, 1.1),
      hive(9, 0.6), hive(15, 0.6),
      // Taking this one flips gravity upwards. The bear falls to the ceiling,
      // with a whole empty hall to volt the bike around on the way up.
      hive(21, 0.6, GRAVITY_DIR.UP),
      hive(28, 10.4), hive(34, 10.4), hive(40, 10.4),
      exit(45, 10.4),
    ],
  },

  {
    name: '9. Nedstigningen',
    difficulty: 3,
    polygons: [
      cave(
        [[0, 20], [10, 20], [16, 16], [26, 16], [32, 12], [42, 12],
         [48, 8], [58, 8], [64, 4], [74, 4], [80, 0], [94, 0]],
        [[0, 30], [94, 30]]
      ),
    ],
    objects: [
      start(3, 21.1),
      hive(6, 20.6), hive(21, 16.6), hive(37, 12.6), hive(53, 8.6), hive(69, 4.6),
      // Hung over the flats: carry too much speed off a ramp and you meet one.
      wasps(22, 20.1), wasps(38, 16.1), wasps(54, 12.1), wasps(70, 8.1),
      exit(90, 0.6),
    ],
  },

  {
    name: '10. Björnens mardröm',
    difficulty: 5,
    polygons: [
      cave(
        // Act 1: long run-up and a gap. Act 2: a climb past hung swarms.
        // Act 3: a tall hall for the gravity flip.
        [[0, 0], [18, 0], [23, 2.6], [26, 3.6],
         [26, -10], [30.5, -10], [30.5, 2],
         [34, 2], [40, 5], [48, 5], [52, 2], [58, 2], [62, 0], [90, 0]],
        [[0, 20], [26, 20], [30, 14], [56, 14], [58, 12], [90, 12]]
      ),
      rect(54, 7, 1.4, 7),
    ],
    objects: [
      start(3, 1.1),
      hive(10, 0.6), hive(15, 0.6),
      wasps(28, -9.4),
      hive(37, 4.1), hive(45, 5.6),
      wasps(44, 9.5), wasps(50, 9.5),
      hive(56, 2.6),
      // Flip up and finish along the ceiling.
      hive(66, 0.6, GRAVITY_DIR.UP),
      hive(72, 11.4), hive(78, 11.4), hive(83, 11.4),
      exit(87, 11.4),
    ],
  },

  // ---------------------------------------------------------------------
  // Second half. Same vocabulary as the first ten, but longer, tighter and
  // with less room to recover from a bad landing.
  // ---------------------------------------------------------------------

  {
    name: '11. Dubbelhoppet',
    difficulty: 5,
    polygons: [
      ...grassyCave(
        [[0, 0], [14, 0], [19, 2.6], [22, 3.6],
         [22, -8], [26.5, -8], [26.5, 2],
         [34, 2], [39, 4.6], [42, 5.6],
         [42, -8], [46.5, -8], [46.5, 3],
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
    difficulty: 5,
    polygons: [
      cave(
        [[0, 0], [8, 0], [8.6, 0.5], [12, 0.5], [12.6, 0], [20, 0],
         [20.6, 0.5], [24, 0.5], [24.6, 0], [34, 0],
         [34.6, 0.5], [38, 0.5], [38.6, 0], [50, 0]],
        [[0, 15], [6, 15], [6, 3.5], [11, 3.5], [11, 15],
         [16, 15], [16, 3.4], [22, 3.4], [22, 15],
         [27, 15], [27, 3.3], [33, 3.3], [33, 15],
         [38, 15], [38, 3.5], [43, 3.5], [43, 15], [50, 15]]
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
    difficulty: 6,
    polygons: [
      ...grassyCave(
        [[0, 0], [10, 0], [14, 2], [22, 2], [26, 0], [36, 0],
         [40, 2], [48, 2], [52, 0], [64, 0]],
        [[0, 15], [64, 15]]
      ),
    ],
    objects: [
      start(3, 1.1),
      // Every swarm clears a smooth line by about a metre. Land badly and it
      // is the swarm you hit, not the ground.
      wasps(7, 3.4), wasps(17, 5.4), wasps(20, 5.4),
      wasps(30, 3.4), wasps(33, 3.4),
      wasps(43, 5.4), wasps(46, 5.4), wasps(57, 3.4),
      hive(12, 1.6), hive(24, 2.6), hive(31, 0.6), hive(44, 2.6), hive(54, 0.6),
      exit(61, 0.6),
    ],
  },

  {
    name: '14. Klyftan',
    difficulty: 6,
    polygons: [
      ...grassyCave(
        [[0, 0], [10, 0], [20, -8], [30, -8], [48, 0], [60, 0], [64, 2], [76, 2]],
        [[0, 16], [76, 16]]
      ),
    ],
    objects: [
      start(3, 1.1),
      hive(8, 0.6),
      hive(16, -3.4), hive(25, -7.4), hive(38, -3.4),
      wasps(22, -4.6), wasps(27, -4.6),
      hive(55, 0.6), hive(70, 2.6),
      exit(74, 2.6),
    ],
  },

  {
    name: '15. Takridaren',
    difficulty: 6,
    polygons: [
      cave(
        [[0, 0], [64, 0]],
        [[0, 12], [64, 12]]
      ),
      // Ceiling bumps. Once gravity is inverted these are the steps you ride
      // over, so they are kept to half a metre.
      rect(24, 11.5, 2.5, 0.5),
      rect(34, 11.5, 2.5, 0.5),
      rect(44, 11.5, 2.5, 0.5),
    ],
    objects: [
      start(3, 1.1),
      hive(9, 0.6), hive(15, 0.6),
      hive(20, 0.6, GRAVITY_DIR.UP),
      hive(30, 11.4), hive(40, 11.4), hive(50, 11.4), hive(57, 11.4),
      exit(61, 11.4),
    ],
  },

  {
    name: '16. Uppstigningen',
    difficulty: 7,
    polygons: [
      cave(
        [[0, 0], [72, 0]],
        [[0, 20], [9, 20], [9, 3.6], [18, 3.6], [18, 20], [72, 20]]
      ),
      // One long wedge up to the gallery. Its tip points the way you are
      // already going, so you ride onto it instead of into its underside —
      // and the squeeze beneath it means the low road ends here.
      block([[22, 0], [40, 7.0], [72, 7.0], [72, 6.2], [40, 6.2]]),
      rect(50, 12.0, 1.4, 8),
      rect(62, 12.0, 1.4, 8),
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
    difficulty: 7,
    polygons: [
      cave(
        [[0, 22], [9, 22], [16, 17], [25, 17], [32, 12], [41, 12],
         [48, 7], [57, 7], [64, 2], [78, 2], [84, 0], [96, 0]],
        [[0, 32], [96, 32]]
      ),
    ],
    objects: [
      start(3, 23.1),
      hive(6, 22.6), hive(20, 17.6), hive(36, 12.6), hive(52, 7.6), hive(70, 2.6),
      // Carry too much speed off a ramp and you land in one of these.
      wasps(21, 21.4), wasps(37, 16.4), wasps(53, 11.4), wasps(69, 6.4),
      wasps(74, 5.4),
      exit(92, 0.6),
    ],
  },

  {
    name: '18. Bikupan',
    difficulty: 7,
    polygons: [
      cave(
        [[0, 0], [76, 0]],
        [[0, 30], [76, 30]]
      ),
      // Six landings in a row. Each deck ends in a short down-ramp so you
      // roll off rather than step off, which turns a 4 m plunge into a 2.5 m
      // one — still a test, but a landing rather than a coin toss.
      block([[0, 25.0], [10, 25.0], [14, 23.5], [14, 22.9], [10, 24.4], [0, 24.4]]),
      block([[0, 21.0], [20, 21.0], [24, 19.5], [24, 18.9], [20, 20.4], [0, 20.4]]),
      block([[0, 17.0], [30, 17.0], [34, 15.5], [34, 14.9], [30, 16.4], [0, 16.4]]),
      block([[0, 13.0], [40, 13.0], [44, 11.5], [44, 10.9], [40, 12.4], [0, 12.4]]),
      block([[0, 9.0], [48, 9.0], [52, 7.5], [52, 6.9], [48, 8.4], [0, 8.4]]),
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
    difficulty: 7,
    polygons: [
      ...grassyCave(
        [[0, 0], [12, 0], [17, 2.6], [20, 3.6],
         [20, -8], [24.5, -8], [24.5, 2],
         [32, 2], [36, 5], [44, 5], [48, 2], [60, 2],
         [64, 0], [78, 0], [82, 2.4], [90, 2.4], [94, 0], [106, 0]],
        [[0, 20], [34, 20], [38, 13], [58, 13], [62, 20], [106, 20]]
      ),
      rect(52, 6.0, 1.4, 7),
      rect(70, 0, 1.4, 1.1),
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
    difficulty: 7,
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
];
