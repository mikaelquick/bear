// What you ride. One of these is the Elasto Mania bike, unchanged; the rest
// are ours.
//
// The physics constants in constants.js are a verbatim port and say plainly
// that they are not tuning knobs. That still holds: the motorbike's spec
// below *is* those constants, and `test/physics.test.js` is what proves it
// — if a single number here drifts, the ported physics changes under it and
// those tests fail. Every other vehicle is an open deviation, written down
// in one place rather than scattered through forces.js.
//
// A vehicle is only worth having if it is better at something. A machine
// that is merely slower is never the right answer to any level, so each one
// trades: the bicycle gives up speed and pull for lightness, a short
// wheelbase and a quicker flip, which is what makes it the one to take into
// a tight shaft and the wrong one for a long open run.

import {
  DEFAULT_BIKE, DEFAULT_LEFT_WHEEL, DEFAULT_RIGHT_WHEEL, DEFAULT_BODY_R,
  GAS_TORQUE, MAX_ANGULAR_VELOCITY, VOLT_ANGULAR_VELOCITY, BODY_DY,
} from './constants.js';

// The wheels sit this far below the bike's centre. Shared by every vehicle:
// it is the height the rider's weight hangs at, not a property of the frame.
const WHEEL_DROP = DEFAULT_BIKE.r.y - DEFAULT_LEFT_WHEEL.r.y; // 0.6

/**
 * Turn the handful of numbers that describe a machine into the full spec
 * the simulation reads. Keeping the derivation here means a vehicle is
 * authored as "how long, how heavy, how strong" rather than as a pile of
 * absolute spawn coordinates.
 */
function build({ wheelbase, mass, inertia, wheelRadius, wheelMass, wheelInertia,
                 gasTorque, maxAngularVelocity, voltAngularVelocity, frameColor,
                 pedals = false }) {
  const half = wheelbase / 2;
  const anchor = DEFAULT_BIKE.r;
  const wheelY = anchor.y - WHEEL_DROP;
  const wheel = (x) => ({ radius: wheelRadius, mass: wheelMass, inertia: wheelInertia, r: { x, y: wheelY } });
  return {
    bike: { radius: DEFAULT_BIKE.radius, mass, inertia, r: { ...anchor } },
    leftWheel: wheel(anchor.x - half),
    rightWheel: wheel(anchor.x + half),
    bodyR: { ...DEFAULT_BODY_R },
    leftWheelDx: -half,
    leftWheelDy: -WHEEL_DROP,
    rightWheelDx: half,
    rightWheelDy: -WHEEL_DROP,
    bodyDy: BODY_DY,
    gasTorque,
    maxAngularVelocity,
    voltAngularVelocity,
    // Presentation, not physics, but it belongs with the machine: the
    // renderer reads it so the two are told apart at a glance. The
    // silhouette already differs — shorter, smaller wheels — and the
    // colour finishes the job.
    frameColor,
    // A bicycle is pedalled and a motorbike is not, so the rider's legs
    // either turn a crank or rest on a peg.
    pedals,
  };
}

export const VEHICLES = [
  {
    id: 'motorbike',
    name: 'Motorcykeln',
    emoji: '🏍️',
    // Exactly the ported constants. Do not tune these: they are what
    // makes this game feel like Elasto Mania, and physics.test.js checks.
    spec: build({
      wheelbase: (DEFAULT_RIGHT_WHEEL.r.x - DEFAULT_LEFT_WHEEL.r.x), // 1.7
      mass: DEFAULT_BIKE.mass,
      inertia: DEFAULT_BIKE.inertia,
      wheelRadius: DEFAULT_LEFT_WHEEL.radius,
      wheelMass: DEFAULT_LEFT_WHEEL.mass,
      wheelInertia: DEFAULT_LEFT_WHEEL.inertia,
      gasTorque: GAS_TORQUE,
      maxAngularVelocity: MAX_ANGULAR_VELOCITY,
      voltAngularVelocity: VOLT_ANGULAR_VELOCITY,
      frameColor: '#d04a3a',
    }),
  },
  {
    id: 'bicycle',
    name: 'Cykeln',
    emoji: '🚲',
    // Gives up speed and pull for lightness, a short wheelbase and a
    // quicker flip. Top speed is the wheel cap times the wheel radius:
    // 98 x 0.36 against the motorbike's 110 x 0.4, so four fifths of it,
    // on four fifths of the pull. Wheel inertia keeps the original's ratio
    // to m*r² (0.2), so the smaller wheel spins up in proportion rather
    // than by invention.
    //
    // All twenty levels are proven finishable on this, same as on the
    // motorbike — test/levels.test.js holds that line for every vehicle.
    // Getting there was a lesson in not trusting one run: three levels
    // looked impossible at first and two more after a tuning change, and
    // in both cases the vehicle was fine and the scripted driver had
    // simply had bad luck with its seed. The test tries several now.
    spec: build({
      wheelbase: 1.3,
      mass: 120,
      inertia: 120 * 0.45 * 0.45,
      wheelRadius: 0.36,
      wheelMass: 7,
      wheelInertia: 0.2 * 7 * 0.36 * 0.36,
      gasTorque: 420,
      maxAngularVelocity: 98,
      voltAngularVelocity: 15,
      frameColor: '#2f9fb8',
      pedals: true,
    }),
  },
];

export const DEFAULT_VEHICLE = 'motorbike';

export const findVehicle = (id) =>
  VEHICLES.find((v) => v.id === id) || VEHICLES[0];

export const specOf = (id) => findVehicle(id).spec;
