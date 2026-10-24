// Game state machine.
//
// All simulation goes through sim.js, which only ever sees (frame duration,
// input flags). That keeps live play and replay playback on exactly the same
// code path, and is what makes a replay a few kilobytes of input.

import { TIME_TO_CENTISECONDS, LEVEL_END_DELAY } from './constants.js';
import { createRun, advanceFrame, INPUT } from './sim.js';
import { Recorder } from './replay.js';

export const STATE = {
  READY: 'ready',
  PLAYING: 'playing',
  DEAD: 'dead',
  FINISHED: 'finished',
};

export function formatTime(centiseconds) {
  const cs = Math.max(0, Math.round(centiseconds));
  const m = Math.floor(cs / 6000);
  const s = Math.floor((cs % 6000) / 100);
  const h = cs % 100;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(h).padStart(2, '0')}`;
}

const DRIVE_KEYS = [
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space',
];

export class Game {
  constructor(renderer, sfx, effects) {
    this.renderer = renderer;
    this.sfx = sfx;
    this.effects = effects;
    this.level = null;
    this.keys = new Set();
    this.state = STATE.READY;
    this.onFinish = null;
    this.paused = false;
    this.recorder = new Recorder();
    this.ghost = null;       // Ghost of the best run, or null
    this.showGhost = true;
  }

  // `vehicleId` sticks for every restart of this level, so pressing R does
  // not quietly put the player back on a different machine.
  load(level, vehicleId) {
    this.level = level;
    this.vehicleId = vehicleId;
    this.renderer.horizonY = level.bounds.maxY * 0.55 + level.bounds.minY * 0.45;
    this.restart();
  }

  // `ghost` may be null. Set after load(), since building it needs the
  // stored replay for this level.
  setGhost(ghost) {
    this.ghost = ghost;
    if (ghost) ghost.rewind();
  }

  restart() {
    for (const obj of this.level.objects) obj.taken = false;
    this.run = createRun(this.level, this.vehicleId);
    this.recorder.reset();

    this.state = STATE.READY;
    this.endTimer = 0;
    this.finalTime = 0;
    this.paused = false;
    if (this.ghost) this.ghost.rewind();
    this.effects.clear();
    this.renderer.lead.x = 0;
    this.renderer.lead.y = 0;
    this.renderer.followCamera(this.run.motor.bike.r, 0, true, this.run.motor.bike.v);
    this.sfx.silenceEngine();
  }

  get motor() {
    return this.run.motor;
  }

  get time() {
    return this.run.time;
  }

  togglePause() {
    if (this.state !== STATE.PLAYING && this.state !== STATE.READY) return false;
    this.paused = !this.paused;
    if (this.paused) this.sfx.silenceEngine();
    return this.paused;
  }

  keyDown(code) {
    // Any input starts the clock, like the original.
    if (this.state === STATE.READY && DRIVE_KEYS.includes(code)) this.state = STATE.PLAYING;
    this.keys.add(code);
  }

  keyUp(code) {
    this.keys.delete(code);
  }

  held(...codes) {
    return codes.some((c) => this.keys.has(c));
  }

  readInputFlags() {
    let flags = 0;
    if (this.held('ArrowUp', 'KeyW')) flags |= INPUT.GAS;
    if (this.held('ArrowDown', 'KeyS')) flags |= INPUT.BRAKE;
    if (this.held('ArrowLeft', 'KeyA')) flags |= INPUT.LEFT;
    if (this.held('ArrowRight', 'KeyD')) flags |= INPUT.RIGHT;
    if (this.keys.has('Space')) flags |= INPUT.TURN;
    return flags;
  }

  // `realDtMs` must already be rounded to float32 by the caller, so the value
  // the recorder stores is exactly the one the simulation consumed.
  step(realDtMs) {
    if (this.paused) return;

    if (this.state === STATE.FINISHED) {
      this.endTimer += realDtMs / 1000;
      return;
    }
    if (this.state !== STATE.PLAYING) return;

    const flags = this.readInputFlags();
    this.recorder.record(realDtMs, flags);

    const result = advanceFrame(this.level, this.run, realDtMs, flags, {
      onBump: (vol, point) => {
        this.sfx.bump(vol);
        this.effects.dust(point.x, point.y, vol);
      },
      onObject: (obj) => {
        if (obj.gravity !== undefined && obj.gravity !== null) {
          this.sfx.gravity();
          this.effects.gravityFlip(obj.x, obj.y);
        } else {
          this.sfx.apple();
          this.effects.honeyBurst(obj.x, obj.y);
          this.effects.bees(obj.x, obj.y);
        }
      },
      onTurn: () => this.sfx.turn(),
    });

    const mot = this.run.motor;
    if (result === 'dead') {
      this.state = STATE.DEAD;
      this.sfx.silenceEngine();
      this.sfx.death();
      this.effects.deathPoof(mot.headR.x, mot.headR.y);
      return;
    }
    if (result === 'finish') {
      this.state = STATE.FINISHED;
      this.finalTime = this.run.time * TIME_TO_CENTISECONDS;
      this.endTimer = 0;
      this.sfx.silenceEngine();
      this.sfx.finish();
      this.effects.finishBurst(mot.bike.r.x, mot.bike.r.y);
      if (this.onFinish) this.onFinish(this.finalTime, this.recorder);
      return;
    }

    this.sfx.engine(
      mot.flipped ? mot.leftWheel.angularVelocity : mot.rightWheel.angularVelocity,
      (flags & INPUT.GAS) !== 0 && (flags & INPUT.BRAKE) === 0
    );
    this.sfx.squeak(mot.frictionVolume);
  }

  get displayTime() {
    if (this.state === STATE.FINISHED) return this.finalTime;
    return this.run.time * TIME_TO_CENTISECONDS;
  }

  get applesLeft() {
    return this.level.totalApples - this.run.motor.appleCount;
  }

  get canShowResult() {
    return this.state === STATE.FINISHED && this.endTimer >= LEVEL_END_DELAY;
  }

  // Metres the ghost is ahead (positive) or behind (negative) right now, or
  // null when there is no ghost or it has already finished.
  get ghostLead() {
    if (!this.ghost || this.state !== STATE.PLAYING) return null;
    const pose = this.ghost.poseAt(this.run.time);
    if (!pose) return null;
    // Progress along x only. Crude, but readable at a glance.
    return pose.bike.r.x - this.run.motor.bike.r.x;
  }

  render(realDtSeconds, wallClock) {
    const r = this.renderer;
    const mot = this.run.motor;
    const live = this.state === STATE.PLAYING || this.state === STATE.READY;
    this.effects.update(this.paused ? 0 : realDtSeconds);
    r.shakeX = this.effects.shakeX;
    r.shakeY = this.effects.shakeY;
    r.followCamera(mot.bike.r, realDtSeconds, false, live ? mot.bike.v : null);
    r.clear();
    r.drawTerrain(this.level);
    r.drawObjects(this.level, wallClock, this.applesLeft === 0);

    if (this.ghost && this.showGhost) {
      const pose = this.ghost.poseAt(this.run.time);
      if (pose) r.drawGhost(pose);
    }

    r.drawBike(mot, this.state === STATE.DEAD);
    r.drawParticles(this.effects);
    r.drawOverlays(this.effects);
  }
}
