// Port of src/physics/forces.cpp from elma-classic, plus the object
// interaction rules from src/game/game.cpp.

import { add, sub, neg, scale, dot, rot90, len } from './vec2.js';
import { rigidbodyMovement, bodyMovement } from './move.js';
import { getTwoAnchorPoints, getTouchingObject } from './collision.js';
import {
  SPRING_TENSION_COEFFICIENT, SPRING_RESISTANCE_COEFFICIENT,
  GRAVITY, HEAD_RADIUS, HEAD_UP, VOLT_DELAY,
  ANGULAR_SPRING_TENSION_COEFFICIENT, ANGULAR_SPRING_RESISTANCE_COEFFICIENT,
  COUNTERVOLT_ANGULAR_VELOCITY,
  GRAVITY_DIR, GRAVITY_VECTORS, OBJ,
} from './constants.js';
import { specOf, DEFAULT_VEHICLE } from './vehicles.js';

const makeBody = (def) => ({
  rotation: 0,
  angularVelocity: 0,
  radius: def.radius,
  mass: def.mass,
  inertia: def.inertia,
  r: { ...def.r },
  v: { x: 0, y: 0 },
  touchingEdge: false,
});

export class Motor {
  /**
   * @param {string} [vehicleId] which machine this is. Defaults to the
   *   motorbike, whose spec is the ported constants unchanged.
   */
  constructor(vehicleId = DEFAULT_VEHICLE) {
    this.vehicleId = vehicleId;
    this.spec = specOf(vehicleId);
    // Carried on the motor rather than looked up, so a ghost's pose — which
    // is motor-shaped but has no spec — can be drawn the same way.
    this.frameColor = this.spec.frameColor;
    this.pedals = this.spec.pedals;
    this.body = this.spec.body;
    this.init();
  }

  init() {
    // In the original's physics space an unflipped bike drives towards -x:
    // positive gas torque spins the wheel counter-clockwise, which rolls it
    // left. Our levels run left to right, so we spawn in the mirrored state.
    // That reuses the original's own mirroring rather than flipping signs on
    // the constants, which would be easy to get subtly wrong.
    this.flipped = true;
    this.gravityDirection = GRAVITY_DIR.DOWN;
    this.prevBrake = false;

    this.bike = makeBody(this.spec.bike);
    this.leftWheel = makeBody(this.spec.leftWheel);
    this.rightWheel = makeBody(this.spec.rightWheel);

    this.bodyR = { ...this.spec.bodyR };
    this.bodyV = { x: 0, y: 0 };

    this.appleCount = 0;
    this.leftWheelBrakeRotation = 0;
    this.rightWheelBrakeRotation = 0;
    this.voltingRight = false;
    this.voltingLeft = false;
    this.rightVoltTime = -1;
    this.leftVoltTime = -1;
    this.angularVelocityPreRightVolt = -1;
    this.angularVelocityPreLeftVolt = -1;

    this.frictionVolume = 0;
    // Compressed air, in seconds of jet left. Full at the start of a run,
    // drained while the jet is on, refilled while a wheel is on the ground.
    // Simulation state, not presentation: it has to be in the snapshot the
    // autopilot restores and it has to replay identically.
    this.thrustLeft = this.spec.thrustTank;
    this.thrusting = false;
    setHeadPosition(this);
  }

  // Offset everything so the bike centre lands on the start marker.
  spawn(startPosition) {
    const off = sub(startPosition, this.spec.bike.r);
    this.bike.r = add(this.bike.r, off);
    this.leftWheel.r = add(this.leftWheel.r, off);
    this.rightWheel.r = add(this.rightWheel.r, off);
    this.bodyR = add(this.bodyR, off);
    setHeadPosition(this);
  }

  turn() {
    this.flipped = !this.flipped;
    setHeadPosition(this);
  }
}

export function setHeadPosition(mot) {
  const i1 = { x: Math.cos(mot.bike.rotation), y: Math.sin(mot.bike.rotation) };
  const j1 = rot90(i1);
  const s = mot.flipped ? 0.09 : -0.09;
  // The bikes use the ported 0.63. The car sits its driver lower — see the
  // note on HEAD_UP in constants.js.
  const up = mot.spec ? mot.spec.headUp : HEAD_UP;
  mot.headR = {
    x: mot.bodyR.x + i1.x * s + j1.x * up,
    y: mot.bodyR.y + i1.y * s + j1.y * up,
  };
}

function clampWheelRotation(rb) {
  if (rb.rotation < -Math.PI) rb.rotation += 2 * Math.PI;
  if (rb.rotation > Math.PI) rb.rotation -= 2 * Math.PI;
}

// Spring tension + damping + the gas/brake reaction force for one wheel.
function calculateWheelForces(mot, rb, i1, j1, wheelDx, wheelDy, torqueWheel, out) {
  // (1) Spring tension, about the wheel's neutral position under the bike.
  const neutralRel = { x: i1.x * wheelDx + j1.x * wheelDy, y: i1.y * wheelDx + j1.y * wheelDy };
  const neutralAbs = add(neutralRel, mot.bike.r);
  const displacement = sub(neutralAbs, rb.r);

  let forceWheel;
  let forceBike;
  let torqueBike;
  if (Math.abs(displacement.x) > 0.0001 || Math.abs(displacement.y) > 0.0001) {
    const neutralLength = len(neutralRel);
    const u = scale(neutralRel, 1 / neutralLength);
    const uo = rot90(u);
    const tensionParallel = dot(displacement, u) * SPRING_TENSION_COEFFICIENT;
    const tensionOrthogonal = dot(displacement, uo) * SPRING_TENSION_COEFFICIENT;
    forceWheel = {
      x: u.x * tensionParallel + uo.x * tensionOrthogonal,
      y: u.y * tensionParallel + uo.y * tensionOrthogonal,
    };
    forceBike = neg(forceWheel);
    // Only the orthogonal component torques the bike.
    torqueBike = -tensionOrthogonal * neutralLength;
  } else {
    forceWheel = { x: 0, y: 0 };
    forceBike = { x: 0, y: 0 };
    torqueBike = 0;
  }

  // (2) Spring damping, about the *actual* bike->wheel spring.
  const currentSpring = sub(rb.r, mot.bike.r);
  const currentLength = len(currentSpring);
  const currentLengthRecip = 1 / currentLength;
  const currentUnit = scale(currentSpring, currentLengthRecip);
  const currentPerp = rot90(currentSpring);
  const currentUnitPerp = rot90(currentUnit);

  const relativeVelocity = sub(
    add(scale(currentPerp, mot.bike.angularVelocity), mot.bike.v),
    rb.v
  );
  const relParallel = dot(relativeVelocity, currentUnit);
  const relOrthogonal = dot(relativeVelocity, currentUnitPerp);
  const dampParallel = scale(currentUnit, relParallel * SPRING_RESISTANCE_COEFFICIENT);
  const dampOrthogonal = scale(currentUnitPerp, relOrthogonal * SPRING_RESISTANCE_COEFFICIENT);

  // (3) Gas/brake. The torque is applied through a "gear" whose radius is the
  // current spring length, so a compressed spring needs enormous force for the
  // same torque. That is where bug bounces come from.
  const gasbrake = scale(currentUnitPerp, torqueWheel * currentLengthRecip);

  out.forceWheel = {
    x: forceWheel.x + dampParallel.x + dampOrthogonal.x - gasbrake.x,
    y: forceWheel.y + dampParallel.y + dampOrthogonal.y - gasbrake.y,
  };
  out.torqueBike = torqueBike - dot(dampOrthogonal, currentPerp);
  out.forceBike = {
    x: forceBike.x - dampParallel.x - dampOrthogonal.x + gasbrake.x,
    y: forceBike.y - dampParallel.y - dampOrthogonal.y + gasbrake.y,
  };

  // Suspension squeak: only when the wheel is displaced and moving upwards.
  const jUp = { x: Math.cos(mot.bike.rotation - 0.5 * Math.PI), y: Math.sin(mot.bike.rotation - 0.5 * Math.PI) };
  const upDisp = dot(jUp, displacement);
  const upVel = dot(jUp, relativeVelocity);
  if (upDisp > 0 && upVel > 0) {
    mot.frictionVolume = Math.max(mot.frictionVolume, upDisp * upVel);
  }
}

const leftOut = {};
const rightOut = {};

/**
 * @param {boolean} [thrust] hold the compressed-air jet on. Vehicles with no
 *   tank ignore it entirely.
 */
export function simulateBikePhysics(level, mot, time, dt, gas, brake, rightVolt, leftVolt, onBump, thrust) {
  mot.frictionVolume = 0;

  // i1 points to the bike's right, j1 to its top.
  const i1 = { x: Math.cos(mot.bike.rotation), y: Math.sin(mot.bike.rotation) };
  const j1 = rot90(i1);

  // Latch wheel rotation on the frame the brake is pressed, so the brake acts
  // as an angular spring back towards that rotation ("hang stretch").
  if (!mot.prevBrake && brake) {
    mot.leftWheelBrakeRotation = mot.leftWheel.rotation - mot.bike.rotation;
    mot.rightWheelBrakeRotation = mot.rightWheel.rotation - mot.bike.rotation;
  }
  mot.prevBrake = brake;

  let torqueLeftWheel = 0;
  let torqueRightWheel = 0;

  if (gas) {
    // Only the trailing wheel drives, and it caps out at the vehicle's own
    // maximum: that cap times the wheel radius is its top speed.
    const { maxAngularVelocity, gasTorque } = mot.spec;
    const driven = mot.flipped ? mot.leftWheel : mot.rightWheel;
    // Rivstart, for a machine that has asked for one. An electric motor
    // pulls hardest from rest, so the torque starts multiplied and fades
    // to the plain figure as the wheel spins up. `launchBoost` 1 skips the
    // branch, which is both bikes, so the ported pull is untouched.
    let torque = gasTorque;
    const boost = mot.spec.launchBoost ?? 1;
    if (boost > 1) {
      const share = Math.abs(driven.angularVelocity) / maxAngularVelocity;
      const left = Math.max(0, 1 - share / (mot.spec.launchFade ?? 0.4));
      torque = gasTorque * (1 + (boost - 1) * left);
    }
    if (mot.flipped) {
      if (mot.leftWheel.angularVelocity > -maxAngularVelocity) torqueLeftWheel = -torque;
    } else {
      if (mot.rightWheel.angularVelocity < maxAngularVelocity) torqueRightWheel = torque;
    }
  }

  if (brake) {
    let relativeRotation =
      mot.leftWheel.rotation - (mot.bike.rotation + mot.leftWheelBrakeRotation);
    let relativeAngularVelocity = mot.leftWheel.angularVelocity - mot.bike.angularVelocity;
    torqueLeftWheel =
      -ANGULAR_SPRING_TENSION_COEFFICIENT * relativeRotation -
      ANGULAR_SPRING_RESISTANCE_COEFFICIENT * relativeAngularVelocity;

    relativeRotation =
      mot.rightWheel.rotation - (mot.bike.rotation + mot.rightWheelBrakeRotation);
    relativeAngularVelocity = mot.rightWheel.angularVelocity - mot.bike.angularVelocity;
    torqueRightWheel =
      -ANGULAR_SPRING_TENSION_COEFFICIENT * relativeRotation -
      ANGULAR_SPRING_RESISTANCE_COEFFICIENT * relativeAngularVelocity;
  } else {
    clampWheelRotation(mot.leftWheel);
    clampWheelRotation(mot.rightWheel);
  }

  // Ice. A slippery level puts a ceiling on what the contact patch can
  // carry: neither the engine nor the brake may ask a wheel for more torque
  // than this. So you pick speed up slowly, and — the part that is actually
  // the character of the world — you cannot take it off again.
  //
  // A ceiling rather than a scale, because the brake is an angular spring
  // here: halve its gain and it simply winds up twice as far and stops you
  // just the same. Capping it is what makes a brake that cannot hold.
  //
  // Only a wheel that is on the ground slips. In the air there is nothing to
  // grip, so the brake still locks the wheels for a volt exactly as it
  // always did. And grip 1 skips the branch altogether, which is every
  // forest level and every physics test, so the ported feel is untouched
  // where it matters.
  const grip = level.grip ?? 1;
  if (grip < 1) {
    const cap = grip * mot.spec.gasTorque;
    const slip = (t) => Math.max(-cap, Math.min(cap, t));
    if (mot.leftWheel.touchingEdge) torqueLeftWheel = slip(torqueLeftWheel);
    if (mot.rightWheel.touchingEdge) torqueRightWheel = slip(torqueRightWheel);
  }

  calculateWheelForces(mot, mot.leftWheel, i1, j1,
    mot.spec.leftWheelDx, mot.spec.leftWheelDy, torqueLeftWheel, leftOut);
  calculateWheelForces(mot, mot.rightWheel, i1, j1,
    mot.spec.rightWheelDx, mot.spec.rightWheelDy, torqueRightWheel, rightOut);

  let prevoltAngularVelocity = 0;
  if (rightVolt || leftVolt) prevoltAngularVelocity = mot.bike.angularVelocity;

  // --- Volt bookkeeping -------------------------------------------------
  // A volt grants free angular velocity immediately and takes it back a
  // quarter of the volt delay later. If you spent that rotation on linear
  // motion in the meantime, you keep the gain. This is the alovolt/supervolt
  // exploit the whole speedrunning scene is built on; it is deliberate.
  if (mot.voltingRight && (rightVolt || leftVolt || time > mot.rightVoltTime + VOLT_DELAY * 0.25)) {
    mot.bike.angularVelocity += mot.spec.voltAngularVelocity;
    mot.bike.angularVelocity = Math.min(mot.bike.angularVelocity, mot.angularVelocityPreRightVolt);
    if (mot.bike.angularVelocity > 0) {
      mot.bike.angularVelocity = Math.max(mot.bike.angularVelocity - COUNTERVOLT_ANGULAR_VELOCITY, 0);
    }
    mot.voltingRight = false;
    mot.angularVelocityPreRightVolt = -1;
    mot.rightVoltTime = -1;
  }
  if (mot.voltingLeft && (rightVolt || leftVolt || time > mot.leftVoltTime + VOLT_DELAY * 0.25)) {
    mot.bike.angularVelocity -= mot.spec.voltAngularVelocity;
    mot.bike.angularVelocity = Math.max(mot.bike.angularVelocity, mot.angularVelocityPreLeftVolt);
    if (mot.bike.angularVelocity < 0) {
      mot.bike.angularVelocity = Math.min(mot.bike.angularVelocity + COUNTERVOLT_ANGULAR_VELOCITY, 0);
    }
    mot.voltingLeft = false;
    mot.angularVelocityPreLeftVolt = -1;
    mot.leftVoltTime = -1;
  }

  if (rightVolt) {
    mot.voltingRight = true;
    mot.angularVelocityPreRightVolt = mot.bike.angularVelocity;
    mot.rightVoltTime = time;
    mot.bike.angularVelocity -= mot.spec.voltAngularVelocity;
  }
  if (leftVolt) {
    mot.voltingLeft = true;
    mot.angularVelocityPreLeftVolt = mot.bike.angularVelocity;
    mot.leftVoltTime = time;
    mot.bike.angularVelocity += mot.spec.voltAngularVelocity;
  }

  // Lean the rider into the volt instead of letting them flop backwards.
  if (rightVolt || leftVolt) {
    const relAngular = mot.bike.angularVelocity - prevoltAngularVelocity;
    const bodySpringPerp = rot90(sub(mot.bodyR, mot.bike.r));
    mot.bodyV = add(mot.bodyV, scale(bodySpringPerp, relAngular));
  }

  const direction = GRAVITY_VECTORS[mot.gravityDirection];

  // The jet. Air is blown straight out of the floor, so the push is along
  // the car's own up — pitch the nose and the thrust leans with it, which
  // is the only steering there is once the wheels have left the ground.
  // (There is pitch control without a volt: gas and brake torque the frame
  // through the wheels, exactly as they do on a bike in the air.)
  //
  // It pushes the frame, not the wheels. That is deliberate and it is what
  // makes it look right: the body rises first, the suspension stretches,
  // and the wheels are pulled up after it.
  // Presentation only, read by the renderer for the car's exhaust. Nothing
  // in the simulation looks at it, so it is not part of the snapshot.
  mot.gassing = gas;

  mot.thrusting = false;
  const tank = mot.spec.thrustTank;
  if (tank > 0) {
    const onGround = mot.leftWheel.touchingEdge || mot.rightWheel.touchingEdge;
    if (thrust && mot.thrustLeft > 0) {
      mot.thrusting = true;
      mot.thrustLeft = Math.max(0, mot.thrustLeft - dt);
    } else if (!thrust && onGround) {
      // Only with the button *released*. Refilling while it is held looks
      // harmless and is not: the first version refilled on the ground
      // whatever the player was doing, and since the tank fills at exactly
      // the rate it empties, holding the button down on the ground bought
      // an endless half-power hover. A jump has to be something you spend.
      mot.thrustLeft = Math.min(tank, mot.thrustLeft + dt * (tank / mot.spec.thrustRefill));
    }
  }
  const jet = mot.thrusting ? mot.spec.thrust : 0;

  // Fly-by-wire, for a machine that has no volt to straighten itself with.
  // An angular spring towards upright, running only while both wheels are
  // off the ground so it never fights the suspension on a bumpy road.
  // Upright means "opposing gravity", so it keeps working after a flip.
  let levelTorque = 0;
  if (mot.spec.selfLevel > 0 && !mot.leftWheel.touchingEdge && !mot.rightWheel.touchingEdge) {
    const upright = Math.atan2(-direction.y, -direction.x) - Math.PI / 2;
    let err = (upright - mot.bike.rotation) % (2 * Math.PI);
    if (err > Math.PI) err -= 2 * Math.PI;
    if (err < -Math.PI) err += 2 * Math.PI;
    levelTorque = mot.spec.selfLevel * err - mot.spec.selfLevelDamping * mot.bike.angularVelocity;
  }

  // Weight. A multiple of the ported constant, 1 for the bikes — and
  // `GRAVITY * 1` is exactly `GRAVITY`, so their forces come out of the
  // same arithmetic they always did.
  const gravity = GRAVITY * (mot.spec.gravityScale ?? 1);

  bodyMovement(mot, direction, i1, j1, dt);

  rigidbodyMovement(
    level,
    mot.bike,
    {
      x: leftOut.forceBike.x + rightOut.forceBike.x + direction.x * mot.bike.mass * gravity
         + j1.x * jet,
      y: leftOut.forceBike.y + rightOut.forceBike.y + direction.y * mot.bike.mass * gravity
         + j1.y * jet,
    },
    leftOut.torqueBike + rightOut.torqueBike + levelTorque,
    dt,
    false,
    onBump
  );
  rigidbodyMovement(
    level,
    mot.leftWheel,
    {
      x: leftOut.forceWheel.x + direction.x * mot.leftWheel.mass * gravity,
      y: leftOut.forceWheel.y + direction.y * mot.leftWheel.mass * gravity,
    },
    torqueLeftWheel,
    dt,
    true,
    onBump
  );
  rigidbodyMovement(
    level,
    mot.rightWheel,
    {
      x: rightOut.forceWheel.x + direction.x * mot.rightWheel.mass * gravity,
      y: rightOut.forceWheel.y + direction.y * mot.rightWheel.mass * gravity,
    },
    torqueRightWheel,
    dt,
    true,
    onBump
  );

  setHeadPosition(mot);
}

const headAnchors = [null, null];

// Returns 'dead' | 'finish' | 'normal'.
export function checkObjectCollision(level, mot, onApple) {
  // The head touching any line is instant death. Wheels and the head collide;
  // the rider's body passes through walls harmlessly.
  if (getTwoAnchorPoints(level, mot.headR, HEAD_RADIUS, headAnchors) > 0) return 'dead';

  const colliders = [
    [mot.leftWheel.r, mot.leftWheel.radius],
    [mot.rightWheel.r, mot.rightWheel.radius],
    [mot.headR, HEAD_RADIUS],
  ];

  let again = true;
  let result = 'normal';
  while (again) {
    again = false;
    for (const [r, radius] of colliders) {
      const index = getTouchingObject(level, r, radius);
      if (index < 0) continue;
      const obj = level.objects[index];

      if (obj.type === OBJ.KILLER) return 'dead';

      if (obj.type === OBJ.APPLE) {
        obj.taken = true;
        mot.appleCount++;
        if (obj.gravity !== undefined && obj.gravity !== null) {
          mot.gravityDirection = obj.gravity;
        }
        if (onApple) onApple(obj, index);
        again = true;
      } else if (obj.type === OBJ.EXIT) {
        if (mot.appleCount >= level.totalApples) result = 'finish';
      }
    }
  }
  return result;
}
