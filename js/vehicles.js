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
  GAS_TORQUE, MAX_ANGULAR_VELOCITY, VOLT_ANGULAR_VELOCITY, BODY_DY, HEAD_UP,
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
                 pedals = false, body = 'bike', volt = true, canTurn = true,
                 bodyDy = BODY_DY, headUp = HEAD_UP,
                 thrust = 0, thrustTank = 0, thrustRefill = 1,
                 selfLevel = 0, selfLevelDamping = 0 }) {
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
    bodyDy,
    headUp,
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
    // Which silhouette the renderer draws around all this: 'bike' or 'car'.
    body,
    // Can it volt? Everything on two wheels can. The car cannot, and gets
    // the thruster in place of it.
    volt,
    // Can it turn round on the spot? A bike can. The car cannot: its one
    // spare button is the jet, and a machine the player cannot turn must
    // not be turned by the scripted driver either, or the test would prove
    // a level with a move nobody has.
    canTurn,
    // Compressed air, fired straight down out of the floor. `thrust` is the
    // force in newtons while the jet is on, `thrustTank` how many seconds of
    // it there are, `thrustRefill` how many seconds on the ground it takes
    // to fill an empty tank. Zero thrust means no jet and no gauge.
    thrust,
    thrustTank,
    thrustRefill,
    // Fly-by-wire. An angular spring towards upright that only runs while
    // the wheels are off the ground. A machine with no volt cannot right
    // itself, so without this one bad launch leaves it upside down with
    // its jet pointing at the sky and the run is over. Zero for anything
    // that can volt — a bike straightening itself would take the game away
    // from the player.
    selfLevel,
    selfLevelDamping,
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
  {
    id: 'car',
    name: 'Elbilen',
    emoji: '🚙',
    // Not offered unless a level asks for it by name. Every other machine
    // is a bike and can be sent at any of the twenty; the car has no volt
    // and cannot even turn round, so half of them are impossible in it.
    // Putting the exception on the odd machine rather than on the twenty
    // levels is what keeps those levels saying nothing about vehicles at
    // all — the same way they say nothing about which world they are in.
    general: false,
    // The odd one out, and deliberately so. It cannot volt at all, and in
    // its place it has compressed air it can fire out of the floor — so
    // instead of rotating itself out of trouble it simply leaves the
    // ground. That makes it a different game with the same physics, which
    // is why it lives on its own levels rather than being offered on the
    // twenty built for a bike.
    //
    // Long, heavy and low: a wheelbase of 2.6 and most of the mass in the
    // frame is what keeps it level without a volt to straighten it. The
    // inertia is deliberately far higher than the bikes' — it is what
    // stops the jet from spinning the thing like a top the moment the nose
    // drops.
    //
    // Nothing here is a ported constant. The whole vehicle is ours.
    spec: build({
      // 3.4 m, not the 2.6 it started at. The real truck puts its wheels
      // 64 % of its length apart; at 2.6 under a 5.8 m body the car hung
      // 1.6 m out at each end and the back drooped like a melted wedge.
      // This also makes it steadier, which suits it.
      wheelbase: 3.4,
      mass: 260,
      inertia: 260 * 1.05 * 1.05,
      wheelRadius: 0.38,
      wheelMass: 12,
      wheelInertia: 0.2 * 12 * 0.38 * 0.38,
      // 62 rad/s on a 0.38 m wheel is about 23.5 m/s, call it 85 km/h, and
      // it is the second answer to this question. The first try left the
      // cap where the bikes have it and the car did 168 on the flat, which
      // is not a go-kart but a blur; 45 was then too sedate for something
      // meant to feel like a fast electric car. The ceiling on this is the
      // camera, not the engine: the view is about 24 m wide and the lead
      // caps at 4.5 m, so past roughly 25 m/s you arrive at things before
      // you can see them.
      gasTorque: 950,
      maxAngularVelocity: 62,
      voltAngularVelocity: 0,
      frameColor: '#c9ced6',
      body: 'car',
      volt: false,
      canTurn: false,
      // You sit lower in a car than on a motorbike, and here that is not
      // only true but necessary: the head is what kills you, so it has to
      // be visibly inside the cabin, and a head perched at bike height
      // needed a roof so tall the car came out shaped like a tent. The
      // body spring's allowed box (move.js) bottoms out around 0.2, so
      // this is about as low as the rider goes.
      bodyDy: 0.22,
      // And his head sits 0.34 above that rather than the bikes' 0.63.
      // This is the number that decides how tall the car is: the head is
      // the hitbox, so it has to be inside the roof, and at bike height
      // the roof had to go so high the thing came out shaped like a van —
      // 2.2 times longer than tall against the real truck's 3.2. Lower
      // also happens to be true: you do not sit in a car with your head
      // where a motorcyclist's is.
      headUp: 0.24,
      // It takes 2840 N to hold the car's own 284 kg still, so 4200 is
      // about a half-g climb: enough to leave the ground deliberately,
      // nowhere near enough to fly. The tank is the whole game — a second
      // and a half of air, and a second and a half on the ground to fill
      // it again, so a jump is something you spend rather than something
      // you hold.
      thrust: 4200,
      thrustTank: 1.5,
      thrustRefill: 1.5,
      // Enough to pull a full rotation's worth of error out in about half
      // a second, damped so it settles rather than wobbles.
      selfLevel: 3000,
      selfLevelDamping: 1100,
    }),
  },
];

export const DEFAULT_VEHICLE = 'motorbike';

export const hasThruster = (spec) => spec.thrust > 0 && spec.thrustTank > 0;

/**
 * The machines a level may be ridden on, in menu order. A level that names
 * none means all of them.
 * @param {object} data raw level data
 */
export const vehiclesFor = (data) =>
  data && data.vehicles
    ? VEHICLES.filter((v) => data.vehicles.includes(v.id))
    : VEHICLES.filter((v) => v.general !== false);

export const findVehicle = (id) =>
  VEHICLES.find((v) => v.id === id) || VEHICLES[0];

export const specOf = (id) => findVehicle(id).spec;
