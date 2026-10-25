// Attract mode: the scripted driver plays a level behind the menu. It uses
// the real physics and the real renderer, so what you see is the game.

import { Level } from './level.js';
import { LEVELS } from './levels.js';
import { Driver, jitteredParams } from './driver.js';
import { createRun, advanceFrame, INPUT } from './sim.js';

const RESTART_DELAY = 1.4; // real seconds after a crash or a win

export class Demo {
  constructor(renderer, effects) {
    this.renderer = renderer;
    this.effects = effects;
    this.levelIndex = Math.floor(Math.random() * LEVELS.length);
    this.restart(true);
  }

  restart(nextLevel = false) {
    if (nextLevel) this.levelIndex = (this.levelIndex + 1) % LEVELS.length;
    this.level = new Level(LEVELS[this.levelIndex]);
    this.renderer.setBiome(this.level.biome);
    this.effects.setBiome(this.level.biome);
    this.renderer.horizonY =
      this.level.bounds.maxY * 0.55 + this.level.bounds.minY * 0.45;
    this.run = createRun(this.level);
    this.driver = new Driver(jitteredParams((Math.random() * 1e9) | 0));
    this.deadTimer = 0;
    this.alive = true;
    this.attempts = 0;
    this.effects.clear();
    this.renderer.lead.x = 0;
    this.renderer.lead.y = 0;
    this.renderer.followCamera(this.run.motor.bike.r, 0, true, this.run.motor.bike.v);
  }

  get motor() {
    return this.run.motor;
  }

  step(realDtMs) {
    if (!this.alive) {
      this.deadTimer += realDtMs / 1000;
      if (this.deadTimer > RESTART_DELAY) {
        // Three crashes on the same level and we move on, so the menu never
        // sits on a run the driver cannot do.
        this.attempts++;
        const next = this.attempts >= 3 || this.finished;
        const index = this.levelIndex;
        this.restart(next);
        if (!next) { this.levelIndex = index; this.attempts = 0; }
      }
      return;
    }

    // The driver decides once per rendered frame, same as a human pressing
    // keys, and turns the bike itself rather than via the TURN flag.
    const run = this.run;
    const inp = this.driver.inputs(this.level, run.motor, run.time, realDtMs / 1000);
    let flags = 0;
    if (inp.gas) flags |= INPUT.GAS;
    if (inp.brake) flags |= INPUT.BRAKE;
    if (inp.leftVolt) flags |= INPUT.LEFT;
    if (inp.rightVolt) flags |= INPUT.RIGHT;

    const result = advanceFrame(this.level, run, realDtMs, flags, {
      onBump: (vol, point) => this.effects.dust(point.x, point.y, vol),
      onObject: (obj) => {
        if (obj.gravity !== undefined && obj.gravity !== null) {
          this.effects.gravityFlip(obj.x, obj.y);
        } else {
          this.effects.honeyBurst(obj.x, obj.y);
          this.effects.bees(obj.x, obj.y);
        }
      },
    });

    if (result === 'dead') {
      this.effects.deathPoof(run.motor.headR.x, run.motor.headR.y);
      this.alive = false;
      this.finished = false;
    } else if (result === 'finish') {
      this.effects.finishBurst(run.motor.bike.r.x, run.motor.bike.r.y);
      this.alive = false;
      this.finished = true;
    }
  }

  render(realDtSeconds, wallClock) {
    const r = this.renderer;
    this.effects.update(realDtSeconds);
    r.shakeX = this.effects.shakeX * 0.4;
    r.shakeY = this.effects.shakeY * 0.4;
    r.followCamera(this.motor.bike.r, realDtSeconds, false,
                   this.alive ? this.motor.bike.v : null);
    r.clear();
    r.drawTerrain(this.level);
    r.drawObjects(this.level, wallClock, this.motor.appleCount >= this.level.totalApples);
    r.drawBike(this.motor, !this.alive && !this.finished, 'demo');
    r.drawParticles(this.effects);
    r.drawOverlays(this.effects);
  }

  get levelName() {
    return LEVELS[this.levelIndex].name;
  }
}
