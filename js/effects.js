// Particles and screen shake. Everything here is cosmetic — it reads the
// simulation but never writes to it, so the physics stays deterministic.

import { themeFor } from './render.js';

const MAX_PARTICLES = 420;

export class Effects {
  constructor() {
    this.particles = [];
    this.shake = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this.flash = 0;
    this.flashColor = '255,255,255';
    // What the wheels throw up. Comes from the world being played: brown
    // grit in the forest was being kicked up on the snow, which read as
    // sand. Honey, wasps and the gravity flip look the same everywhere —
    // they are objects, not ground.
    this.spray = themeFor(null).spray;
  }

  setBiome(biome) {
    this.spray = themeFor(biome).spray;
  }

  clear() {
    this.particles.length = 0;
    this.shake = 0;
    this.flash = 0;
  }

  spawn(p) {
    if (this.particles.length >= MAX_PARTICLES) this.particles.shift();
    this.particles.push(p);
  }

  // Dust kicked up where a wheel slams into the ground. What it is made of
  // depends on what the ground is made of — see setBiome.
  dust(x, y, strength) {
    const count = Math.min(14, 3 + Math.round(strength * 10));
    const spray = this.spray;
    for (let i = 0; i < count; i++) {
      const a = Math.PI * (0.15 + Math.random() * 0.7);
      const speed = 0.6 + Math.random() * 2.4 * strength;
      this.spawn({
        x, y,
        vx: Math.cos(a) * speed * (Math.random() < 0.5 ? -1 : 1),
        vy: Math.sin(a) * speed,
        life: 0, maxLife: (0.35 + Math.random() * 0.4) * spray.life,
        size: 0.05 + Math.random() * 0.1,
        drag: 2.2, gravity: spray.gravity,
        color: spray.color,
      });
    }
    this.addShake(Math.min(strength * 5, 7));
  }

  // Golden burst when a hive is collected.
  honeyBurst(x, y) {
    for (let i = 0; i < 20; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 4;
      this.spawn({
        x, y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        life: 0, maxLife: 0.5 + Math.random() * 0.5,
        size: 0.05 + Math.random() * 0.09,
        drag: 1.6, gravity: -6,
        color: Math.random() < 0.35 ? '255,228,150' : '240,168,48',
      });
    }
  }

  // Bees scatter off a disturbed hive.
  bees(x, y) {
    for (let i = 0; i < 7; i++) {
      const a = Math.random() * Math.PI * 2;
      this.spawn({
        x, y,
        vx: Math.cos(a) * (1 + Math.random() * 2),
        vy: Math.sin(a) * (1 + Math.random() * 2),
        life: 0, maxLife: 0.8 + Math.random() * 0.6,
        size: 0.045, drag: 0.4, gravity: 0, wobble: 14 + Math.random() * 10,
        color: '245,197,24',
      });
    }
  }

  gravityFlip(x, y) {
    for (let i = 0; i < 28; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 6;
      this.spawn({
        x, y,
        vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
        life: 0, maxLife: 0.6 + Math.random() * 0.5,
        size: 0.04 + Math.random() * 0.07,
        drag: 2.4, gravity: 0,
        color: '159,224,255',
      });
    }
    this.addShake(5);
    this.flashWith(0.35, '120,200,255');
  }

  deathPoof(x, y) {
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 4;
      this.spawn({
        x, y,
        vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
        life: 0, maxLife: 0.6 + Math.random() * 0.6,
        size: 0.07 + Math.random() * 0.12,
        drag: 2.0, gravity: -4,
        color: Math.random() < 0.5 ? '138,90,51' : '90,60,35',
      });
    }
    this.addShake(11);
    this.flashWith(0.5, '224,69,58');
  }

  finishBurst(x, y) {
    for (let i = 0; i < 60; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 8;
      this.spawn({
        x, y,
        vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
        life: 0, maxLife: 0.9 + Math.random() * 0.9,
        size: 0.05 + Math.random() * 0.12,
        drag: 1.2, gravity: -7,
        color: ['240,168,48', '255,228,150', '255,255,255'][Math.floor(Math.random() * 3)],
      });
    }
    this.flashWith(0.3, '255,220,140');
  }

  addShake(amount) {
    this.shake = Math.min(16, Math.max(this.shake, amount));
  }

  flashWith(amount, color) {
    this.flash = Math.max(this.flash, amount);
    this.flashColor = color;
  }

  update(dt) {
    const list = this.particles;
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.life += dt;
      if (p.life >= p.maxLife) { list.splice(i, 1); continue; }
      if (p.wobble) p.vx += Math.sin(p.life * p.wobble) * 6 * dt;
      const drag = Math.max(0, 1 - p.drag * dt);
      p.vx *= drag;
      p.vy = (p.vy + p.gravity * dt) * drag;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }

    this.shake *= Math.exp(-7 * dt);
    if (this.shake < 0.05) this.shake = 0;
    this.shakeX = (Math.random() * 2 - 1) * this.shake;
    this.shakeY = (Math.random() * 2 - 1) * this.shake;

    this.flash = Math.max(0, this.flash - dt * 1.8);
  }
}
