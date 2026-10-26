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
function build({ wheelbase, mass, inertia, wheelRadius, rearWheelRadius = null,
                 wheelMass, wheelInertia,
                 gasTorque, maxAngularVelocity, voltAngularVelocity, frameColor,
                 pedals = false, body = 'bike', wheelStyle = null,
                 volt = true, canTurn = true,
                 bodyDy = BODY_DY, headUp = HEAD_UP,
                 thrust = 0, thrustTank = 0, thrustRefill = 1,
                 selfLevel = 0, selfLevelDamping = 0, balanceOnGround = false,
                 gravityScale = 1, launchBoost = 1, launchFade = 0.4 }) {
  const half = wheelbase / 2;
  const anchor = DEFAULT_BIKE.r;
  const wheelY = anchor.y - WHEEL_DROP;
  // The two wheels are usually the same size, and `rearWheelRadius` is for
  // the one machine that is a trike. Inertia follows the radius so a
  // different wheel keeps the original's inertia-to-mr² ratio rather than
  // being invented; same size means a multiply by exactly 1, so every
  // other machine comes out of the arithmetic it always did.
  //
  // Note what a different rear wheel also does: the hubs hang at the same
  // height, so a smaller one puts its contact point higher and the whole
  // machine sits nose-up. On a trike that is not a bug, it is what a trike
  // looks like.
  const wheel = (x, radius) => ({
    radius,
    mass: wheelMass,
    inertia: wheelInertia * (radius / wheelRadius) ** 2,
    r: { x, y: wheelY },
  });
  const rear = rearWheelRadius || wheelRadius;
  return {
    bike: { radius: DEFAULT_BIKE.radius, mass, inertia, r: { ...anchor } },
    // Spawned flipped, which is facing +x, so the left wheel is the one
    // behind: the trailing wheel that drives, and the trike's small one.
    leftWheel: wheel(anchor.x - half, rear),
    rightWheel: wheel(anchor.x + half, wheelRadius),
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
    // Which silhouette the renderer draws around all this: 'bike', 'car',
    // 'space' or 'heavy'. The frame is the only part that changes — the
    // wheels stand where the physics puts them and the bear sits where the
    // spring leaves him, whatever is drawn between them.
    body,
    // And which wheels under it: 'disc' like the motorbike, 'spoked' like
    // the bicycle, or 'fat' for something that needs to look like it
    // weighs what it weighs. Pedals imply spokes, because that is the same
    // fact about the machine said twice.
    wheelStyle: wheelStyle || (pedals ? 'spoked' : 'disc'),
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
    // Whether that spring also runs while a wheel is on the ground. True
    // for the unicycle and nothing else: see the note in forces.js.
    balanceOnGround,
    // What gravity this machine falls under, as a multiple of the ported
    // 10 m/s². Mass does not do this on its own: in a rigid-body sim every
    // body falls at the same rate whatever it weighs, so a heavy machine
    // that should *feel* heavy has to be told to. 1 is the ported number
    // and the branch that reads this is a plain multiply, so the bikes come
    // out bit-identical.
    gravityScale,
    // Rivstart. An electric motor pulls hardest from a standstill, so gas
    // torque is multiplied by this at zero wheel speed and falls back to
    // the plain figure by `launchFade` of the top speed. 1 skips it.
    launchBoost,
    launchFade,
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
      // And his head sits a little above that rather than the bikes' 0.63.
      // This is the number that decides how tall the car is: the head is
      // the hitbox, so it has to be inside the roof, and at bike height
      // the roof had to go so high the thing came out shaped like a van —
      // 2.2 times longer than tall against the real truck's 3.2. Lower
      // also happens to be true: you do not sit in a car with your head
      // where a motorcyclist's is.
      //
      // 0.24 still sat him up in the glass with his ears at the roof, so
      // he came down another ten centimetres and settled into the seat.
      // The seat in drawBearDriving is in car-local metres and had to come
      // down with him. Lowering the hitbox makes the car a touch more
      // forgiving under a low ceiling; the Beta levels still pass.
      headUp: 0.14,
      // It takes 2840 N to hold the car's own 284 kg still, so 4200 is
      // about a half-g climb: enough to leave the ground deliberately,
      // nowhere near enough to fly. The tank is the whole game — a second
      // and a half of air, and a second and a half on the ground to fill
      // it again, so a jump is something you spend rather than something
      // you hold.
      // A car is heavy and should fall like it. The bikes keep the ported
      // 10 m/s²; this one gets 13, which is what reads as weight — it
      // lands sooner and sits harder on its springs. Everything that has
      // to hold it up was rescaled with it, the jet below included.
      gravityScale: 1.3,
      // And it pulls like an electric motor: a bit over twice the torque
      // off the line, back to the plain 950 by two fifths of top speed.
      // The ice cap in forces.js is deliberately left on the plain figure,
      // so a rivstart on Isbanan is still a rivstart that goes nowhere.
      launchBoost: 2.2,
      launchFade: 0.4,
      // 2840 N held the car's own 284 kg at the ported gravity and 4200
      // was about a half-g climb. At 13 m/s² it weighs 3692, so the same
      // climb against the same weight wants 5400. Left at 4200 the jet
      // would have become a shrug, and the jet is the whole game.
      thrust: 5400,
      thrustTank: 1.5,
      thrustRefill: 1.5,
      // Enough to pull a full rotation's worth of error out in about half
      // a second, damped so it settles rather than wobbles.
      selfLevel: 3000,
      selfLevelDamping: 1100,
    }),
  },

  // ---------------------------------------------------------------------
  // The two below are Beta's, and they exist to be played with. Neither is
  // offered anywhere a normal run goes: they have `general: false` and one
  // level apiece, so a player who never opens Beta never meets them.
  //
  // They are the same idea twice, pointing opposite ways. Both are plain
  // bikes with a volt — no new button to learn, nothing in the controls
  // that is not already there — and the only thing really changed is what
  // gravity they fall under. That is enough to make them feel like two
  // different games, which is the thing worth finding out.
  // ---------------------------------------------------------------------
  {
    id: 'moonbike',
    name: 'Måncykeln',
    emoji: '🌙',
    general: false,
    // 0.42 g. A gap you would have to earn on the motorbike is a stroll,
    // and a landing that would break your neck is a feather.
    //
    // What it gives up is not speed, it is grip on its own nose. Torque
    // through the back wheel pitches the frame up, and what holds the
    // front down is weight — of which there is now two fifths. So the
    // throttle is something you tap rather than hold, and the pull is a
    // notch under the bicycle's to make that playable rather than cruel.
    // Under a low ceiling it is the worst machine in the game: it takes an
    // age to come back down and there is nothing to be done about it.
    spec: build({
      wheelbase: 1.45,
      mass: 110,
      inertia: 110 * 0.45 * 0.45,
      wheelRadius: 0.38,
      wheelMass: 6,
      wheelInertia: 0.2 * 6 * 0.38 * 0.38,
      gasTorque: 360,
      maxAngularVelocity: 92,
      voltAngularVelocity: 13,
      frameColor: '#cfd6ff',
      // Thin tube, big hollow wheels, and a pack slung under it that is
      // lit whenever the machine is: the drawing has to say "this weighs
      // nothing" before the first jump does. Feet on pegs, not on a crank
      // — nobody pedals in space.
      body: 'space',
      wheelStyle: 'spoked',
      gravityScale: 0.42,
    }),
  },
  {
    id: 'magnet',
    name: 'Magneten',
    emoji: '🧲',
    general: false,
    // 1.7 g, and the name is the explanation a child needs: it is pulled
    // at the ground. Heavy, long and strong — it climbs what nothing else
    // climbs and it launches off a ramp like a thrown brick.
    //
    // And then it comes straight back down. Air time is what it trades:
    // over a gap it is the worst machine here, and the slow volt means
    // that what little time it has in the air is not enough to sort
    // itself out in. Fly it flat or do not fly it.
    spec: build({
      wheelbase: 1.9,
      mass: 320,
      inertia: 320 * 0.6 * 0.6,
      wheelRadius: 0.42,
      wheelMass: 16,
      wheelInertia: 0.2 * 16 * 0.42 * 0.42,
      gasTorque: 1000,
      maxAngularVelocity: 96,
      voltAngularVelocity: 8,
      frameColor: '#7a45d6',
      // A big heavy hoj, drawn like one: a long slab of a tank, a wide
      // guard over each wheel and tyres with tread you can count.
      body: 'heavy',
      wheelStyle: 'fat',
      gravityScale: 1.7,
      launchBoost: 1.8,
    }),
  },
  {
    id: 'trike',
    name: 'Trehjulingen',
    emoji: '🛺',
    general: false,
    // A child's trike, which from the side is a big front wheel, a little
    // one at the back and not much in between. The small driven wheel is
    // the whole character: top speed is the wheel cap times *its* radius,
    // so 86 × 0.26 is about 22 m/s however hard it pulls.
    //
    // It trades air for footing. Long for its height, heavy down low and
    // with a volt of 7 against the motorbike's 12, it is the one machine
    // that will not loop itself when you open the throttle on a climb —
    // and the one that cannot do anything useful once it leaves the
    // ground. Nose-up at rest, because the back wheel is smaller than the
    // front one and the hubs hang level.
    spec: build({
      wheelbase: 1.15,
      mass: 150,
      inertia: 150 * 0.5 * 0.5,
      wheelRadius: 0.44,
      rearWheelRadius: 0.26,
      wheelMass: 8,
      wheelInertia: 0.2 * 8 * 0.44 * 0.44,
      gasTorque: 520,
      maxAngularVelocity: 86,
      voltAngularVelocity: 7,
      frameColor: '#e2563f',
      pedals: true,
      body: 'trike',
      wheelStyle: 'disc',
    }),
  },
  {
    id: 'unicycle',
    name: 'Enhjulingen',
    emoji: '🎪',
    general: false,
    // One wheel. The simulation has exactly two and always will — it is
    // the ported one — so this is two wheels 14 cm apart with a single
    // wheel drawn over the pair. That is a liberty, and it is the honest
    // kind: with the contact patches that close together the machine
    // pitches as freely as a real unicycle does, which is the thing being
    // modelled. What it costs is a frame held up by two springs instead of
    // one, so it rides a little stiffer than its weight suggests.
    //
    // Nothing holds the nose down, so the throttle loops it on sight and
    // the gas torque is small for that reason. In return the volt is 20,
    // far and away the quickest here: it can be anywhere in the air it
    // wants to be. A machine for turning on a coin and for nothing else.
    spec: build({
      wheelbase: 0.14,
      mass: 70,
      // Not 70 × 0.28². The inertia is the one number this machine turns
      // out to live or die by, and it was found by measurement rather than
      // by taste: the scripted driver clears the level on 8 seeds in 10 at
      // 70 × 0.41², on 2 to 6 anywhere in 11–14, and on *none at all* at
      // 10 or below, where the thing simply loops itself off the start
      // line. A cliff on one side and a plateau on the other, so this sits
      // on the plateau. See the sweep in the commit message.
      inertia: 70 * 0.41 * 0.41,
      wheelRadius: 0.45,
      wheelMass: 5,
      wheelInertia: 0.2 * 5 * 0.45 * 0.45,
      gasTorque: 220,
      maxAngularVelocity: 80,
      voltAngularVelocity: 20,
      frameColor: '#f2c14e',
      pedals: true,
      body: 'uni',
      wheelStyle: 'spoked',
      selfLevel: 900,
      selfLevelDamping: 300,
      balanceOnGround: true,
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
