// Physics constants ported verbatim from elma-classic (src/physics/init.cpp,
// src/physics/forces.cpp, include/main.h, include/physics/pacer.h).
// Changing any of these changes the feel of the game. They are not tuning knobs.

export const GROUND_ESCAPE_VELOCITY = 0.01; // m/s, to detach a wheel from ground
export const WHEEL_DEFORMATION_LENGTH = 0.005; // m the wheel sinks into ground
export const GRAVITY = 10.0; // m/s^2
export const TWO_POINT_DISCRIMINATION_DISTANCE = 0.1; // m

export const VOLT_DELAY = 0.4;
export const LEVEL_END_DELAY = 1.0;

export const SPRING_TENSION_COEFFICIENT = 10000.0; // N/m
export const SPRING_RESISTANCE_COEFFICIENT = 1000.0; // N/(m/s)

export const HEAD_RADIUS = 0.238; // m
export const OBJECT_RADIUS = 0.4; // m

export const MAX_ANGULAR_VELOCITY = 110.0;
export const GAS_TORQUE = 600.0;
export const ANGULAR_SPRING_TENSION_COEFFICIENT = 1000.0;
export const ANGULAR_SPRING_RESISTANCE_COEFFICIENT = 100.0;

export const VOLT_ANGULAR_VELOCITY = 12.0;
export const COUNTERVOLT_ANGULAR_VELOCITY = 3.0;

export const BUMP_THRESHOLD = 1.5; // min speed loss for a bump sound

// Rigid body defaults. Positions are the original spawn layout; only the
// relative offsets derived from them actually matter.
export const DEFAULT_BIKE = {
  radius: 0.3,
  mass: 200.0,
  inertia: 200.0 * 0.55 * 0.55, // note: 0.55, not the 0.3 radius above
  r: { x: 2.75, y: 3.6 },
};
export const DEFAULT_LEFT_WHEEL = {
  radius: 0.4,
  mass: 10.0,
  inertia: 0.32,
  r: { x: 1.9, y: 3.0 },
};
export const DEFAULT_RIGHT_WHEEL = {
  radius: 0.4,
  mass: 10.0,
  inertia: 0.32,
  r: { x: 3.6, y: 3.0 },
};
export const DEFAULT_BODY_R = { x: 2.75, y: 4.04 };

// Derived relative offsets
export const LEFT_WHEEL_DX = DEFAULT_LEFT_WHEEL.r.x - DEFAULT_BIKE.r.x; // -0.85
export const LEFT_WHEEL_DY = DEFAULT_LEFT_WHEEL.r.y - DEFAULT_BIKE.r.y; // -0.6
export const RIGHT_WHEEL_DX = DEFAULT_RIGHT_WHEEL.r.x - DEFAULT_BIKE.r.x; // 0.85
export const RIGHT_WHEEL_DY = DEFAULT_RIGHT_WHEEL.r.y - DEFAULT_BIKE.r.y; // -0.6
export const BODY_DY = DEFAULT_BODY_R.y - DEFAULT_BIKE.r.y; // 0.44

// Time. The simulation runs in its own time unit; one real millisecond is
// MS_TO_PHYS_TIME simulation units. The displayed clock converts back, so
// elapsed sim time * TIME_TO_CENTISECONDS is real hundredths of a second.
const STOPWATCH_MULTIPLIER = 0.182;
const STOPWATCH_TO_PHYS_TIME = 0.0024;
export const MS_TO_PHYS_TIME = STOPWATCH_MULTIPLIER * STOPWATCH_TO_PHYS_TIME;
export const TIME_TO_CENTISECONDS =
  100.0 / (STOPWATCH_MULTIPLIER * 1000.0 * STOPWATCH_TO_PHYS_TIME);
export const PHYS_MAX_TIMESTEP = 0.0055;

export const GRAVITY_DIR = {
  UP: 0,
  DOWN: 1,
  LEFT: 2,
  RIGHT: 3,
};

export const GRAVITY_VECTORS = {
  [GRAVITY_DIR.DOWN]: { x: 0, y: -1 },
  [GRAVITY_DIR.UP]: { x: 0, y: 1 },
  [GRAVITY_DIR.LEFT]: { x: -1, y: 0 },
  [GRAVITY_DIR.RIGHT]: { x: 1, y: 0 },
};

export const OBJ = {
  EXIT: 'exit', // honey pot (the original's flower)
  APPLE: 'apple', // beehive (the original's apple / food)
  KILLER: 'killer', // wasp swarm
  START: 'start',
};
