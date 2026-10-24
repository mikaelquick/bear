// Canvas 2D renderer. The world is metres with +y up; screen is pixels with
// +y down, so every transform flips y.

import { rot90 } from './vec2.js';
import { HEAD_RADIUS, OBJECT_RADIUS, OBJ, GRAVITY_DIR } from './constants.js';

const PALETTE = {
  skyTop: '#1b2a4a',
  skyBottom: '#39506e',
  ground: '#2a1f17',
  groundLight: '#3d2d20',
  edge: '#6b5440',
  grass: '#3f6b36',
  grassLight: '#6fa85a',
  fur: '#8a5a33',
  furDark: '#6b4425',
  furLight: '#a8703f',
  snout: '#d9b38c',
  tyre: '#1a1a1d',
  rim: '#c9ced6',
  frame: '#d04a3a',
  honey: '#f0a830',
  honeyDark: '#b87412',
  wasp: '#f5c518',
  waspDark: '#232323',
  danger: '#e0453a',
};

// Lighten (t > 0) or darken (t < 0) a #rrggbb by a fraction, so one frame
// colour per vehicle is enough to paint its whole gradient.
function shade(hex, t) {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c) => Math.round(t > 0 ? c + (255 - c) * t : c * (1 + t));
  const r = mix((n >> 16) & 255), g = mix((n >> 8) & 255), b = mix(n & 255);
  return `rgb(${r},${g},${b})`;
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.scale = 52; // pixels per metre
    this.cam = { x: 0, y: 0 };
    this.lead = { x: 0, y: 0 };
    this.camInit = false;
    this.shakeX = 0;
    this.shakeY = 0;
    this.stars = makeStars(140);
    this.horizonY = 0;
  }

  resize() {
    // Capped: phones report 3x, which triples the fill cost for no visible
    // gain on a flat-shaded 2D scene.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = w;
    this.h = h;
  }

  // Pixels per metre, chosen so the view always covers a useful slice of
  // track. A phone at 852x393 was showing 16 m, which is not enough warning
  // to react to anything; this gives it 24 m.
  fitScale() {
    const MIN_WIDTH_M = 22;
    const MIN_HEIGHT_M = 11;
    this.scale = clamp(
      Math.min(this.w / MIN_WIDTH_M, this.h / MIN_HEIGHT_M), 26, 52
    );
  }

  // World -> screen. Screen shake is folded in here so everything drawn in
  // world space shakes together and the HUD (drawn in DOM) does not.
  sx(x) { return (x - this.cam.x) * this.scale + this.w / 2 + this.shakeX; }
  sy(y) { return -(y - this.cam.y) * this.scale + this.h / 2 + this.shakeY; }
  // Screen -> world
  wx(px) { return (px - this.w / 2 - this.shakeX) / this.scale + this.cam.x; }
  wy(py) { return -(py - this.h / 2 - this.shakeY) / this.scale + this.cam.y; }

  // Follows the bike, looking ahead in the direction it is actually moving so
  // there is time to read what is coming.
  followCamera(target, dt, snap = false, velocity = null) {
    if (velocity) {
      const want = {
        x: clamp(velocity.x * 0.26, -4.5, 4.5),
        y: clamp(velocity.y * 0.14, -2.5, 2.5),
      };
      const kl = snap ? 1 : 1 - Math.exp(-3 * dt);
      this.lead.x += (want.x - this.lead.x) * kl;
      this.lead.y += (want.y - this.lead.y) * kl;
    }
    // Sit the bike slightly below centre. Centred, the lower third of a short
    // screen is solid rock you will never touch; this trades it for sky and
    // terrain you are about to ride into.
    const bias = (BIKE_SCREEN_FRACTION - 0.5) * this.h / this.scale;
    const tx = target.x + this.lead.x;
    const ty = target.y + this.lead.y + bias;
    if (!this.camInit || snap) {
      this.cam.x = tx;
      this.cam.y = ty;
      this.camInit = true;
      return;
    }
    const k = 1 - Math.exp(-12 * dt);
    this.cam.x += (tx - this.cam.x) * k;
    this.cam.y += (ty - this.cam.y) * k;
  }

  clear() {
    const { ctx } = this;
    const g = ctx.createLinearGradient(0, 0, 0, this.h);
    g.addColorStop(0, PALETTE.skyTop);
    g.addColorStop(1, PALETTE.skyBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.w, this.h);
    this.drawParallax();
  }

  // Three slow layers behind the level: stars, far ridge, near ridge.
  drawParallax() {
    const { ctx } = this;
    const cx = this.cam.x;
    const cy = this.cam.y;

    ctx.save();
    for (const st of this.stars) {
      const px = mod(st.x - cx * 0.04 * this.scale * 0.02, 1) * this.w;
      const py = mod(st.y - cy * 0.02 * this.scale * 0.01, 1) * this.h * 0.7;
      ctx.globalAlpha = st.a;
      ctx.fillStyle = '#cfe0ff';
      ctx.fillRect(px, py, st.s, st.s);
    }
    ctx.restore();

    this.ridge(0.14, 2.5, '#24314a', 9, 160);
    this.ridge(0.3, 0.8, '#1b2838', 6, 110);
  }

  // A distant ridge line. It is anchored to a world altitude so it reads as
  // scenery beyond the level rather than a band stuck to the screen.
  ridge(parallax, heightAboveHorizon, color, amplitude, wavelength) {
    const { ctx } = this;
    const offset = this.cam.x * this.scale * parallax;
    const worldY = this.horizonY + heightAboveHorizon;
    const yBase = this.h / 2 - (worldY - this.cam.y) * this.scale * parallax;
    ctx.beginPath();
    ctx.moveTo(0, this.h);
    for (let px = 0; px <= this.w; px += 8) {
      const t = (px + offset) / wavelength;
      const y = yBase - (Math.sin(t) + Math.sin(t * 0.47 + 1.7) * 0.6) * amplitude;
      ctx.lineTo(px, y);
    }
    ctx.lineTo(this.w, this.h);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  drawTerrain(level) {
    const { ctx } = this;

    // Even-odd over [full screen + every polygon] fills exactly the solid
    // side: outside the cave is rock, the cave interior shows the sky
    // through, and blocks nested inside the cave become rock again.
    const gg = ctx.createLinearGradient(0, 0, 0, this.h);
    gg.addColorStop(0, PALETTE.groundLight);
    gg.addColorStop(1, PALETTE.ground);
    ctx.beginPath();
    ctx.rect(0, 0, this.w, this.h);
    for (const poly of level.polygons) {
      if (poly.grass) continue;
      this.tracePolygon(poly);
    }
    ctx.fillStyle = gg;
    ctx.fill('evenodd');

    // Strata, clipped to the rock, to stop the fill reading as flat paint.
    ctx.save();
    ctx.clip('evenodd');
    ctx.strokeStyle = 'rgba(0,0,0,0.16)';
    ctx.lineWidth = Math.max(1, this.scale * 0.05);
    ctx.beginPath();
    const spacing = 1.6; // metres
    const firstBand = Math.floor(this.wy(this.h) / spacing) * spacing;
    const lastBand = this.wy(0);
    for (let wy = firstBand; wy <= lastBand; wy += spacing) {
      const y = this.sy(wy);
      const wobble = Math.sin(wy * 0.9) * this.scale * 0.1;
      ctx.moveTo(0, y + wobble);
      ctx.lineTo(this.w, y - wobble);
    }
    ctx.stroke();
    ctx.restore();

    // Edges. Surfaces you can land on get a lit rim so they read at a glance.
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = PALETTE.edge;
    ctx.beginPath();
    for (const poly of level.polygons) {
      if (poly.grass) continue;
      this.tracePolygon(poly);
    }
    ctx.stroke();
    this.drawLitEdges(level);

    this.drawGrass(level);
  }

  // Grass polygons never collide; they are a painted line along a surface.
  // Drawn open rather than closed, so a floor profile can be reused as-is.
  drawGrass(level) {
    const { ctx } = this;
    const s = this.scale;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.lineWidth = Math.max(2, 0.13 * s);
    ctx.strokeStyle = PALETTE.grass;
    ctx.beginPath();
    for (const poly of level.polygons) {
      if (!poly.grass || poly.points.length < 2) continue;
      const pts = poly.points;
      ctx.moveTo(this.sx(pts[0].x), this.sy(pts[0].y));
      for (let i = 1; i < pts.length; i++) ctx.lineTo(this.sx(pts[i].x), this.sy(pts[i].y));
    }
    ctx.stroke();

    // Tufts, placed deterministically from world position so they do not
    // crawl as the camera moves.
    ctx.lineWidth = Math.max(1, 0.05 * s);
    ctx.strokeStyle = PALETTE.grassLight;
    ctx.beginPath();
    const spacing = 0.32;
    for (const poly of level.polygons) {
      if (!poly.grass || poly.points.length < 2) continue;
      const pts = poly.points;
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.hypot(dx, dy);
        const steps = Math.floor(len / spacing);
        for (let k = 0; k < steps; k++) {
          const t = (k + 0.5) / steps;
          const x = a.x + dx * t;
          const y = a.y + dy * t;
          const px = this.sx(x);
          if (px < -20 || px > this.w + 20) continue;
          const py = this.sy(y);
          const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
          const jitter = n - Math.floor(n); // 0..1, stable per position
          const height = (0.16 + jitter * 0.16) * s;
          const lean = (jitter - 0.5) * 0.5 * s;
          ctx.moveTo(px, py);
          ctx.lineTo(px + lean, py - height);
        }
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  // Highlight edges whose surface faces upwards, i.e. the ones you ride on.
  drawLitEdges(level) {
    const { ctx } = this;
    ctx.save();
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (const poly of level.polygons) {
      if (poly.grass) continue;
      const pts = poly.points;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.hypot(dx, dy);
        if (len < 0.001) continue;
        // Steeper than ~55 degrees is a wall, not a surface.
        if (Math.abs(dy / len) > 0.82) continue;
        const ax = this.sx(a.x);
        const ay = this.sy(a.y);
        const bx = this.sx(b.x);
        const by = this.sy(b.y);
        if (Math.max(ax, bx) < -40 || Math.min(ax, bx) > this.w + 40) continue;
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
      }
    }
    ctx.strokeStyle = 'rgba(190,160,120,0.45)';
    ctx.stroke();
    ctx.restore();
  }

  drawParticles(effects) {
    const { ctx } = this;
    for (const p of effects.particles) {
      const k = 1 - p.life / p.maxLife;
      ctx.globalAlpha = k * k;
      ctx.fillStyle = `rgb(${p.color})`;
      const r = p.size * this.scale * (0.5 + k * 0.5);
      ctx.beginPath();
      ctx.arc(this.sx(p.x), this.sy(p.y), Math.max(0.6, r), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Vignette always, plus a brief colour wash on big events.
  drawOverlays(effects) {
    const { ctx } = this;
    const grd = ctx.createRadialGradient(
      this.w / 2, this.h / 2, Math.min(this.w, this.h) * 0.35,
      this.w / 2, this.h / 2, Math.max(this.w, this.h) * 0.72
    );
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(1, 'rgba(0,0,0,0.42)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, this.w, this.h);

    if (effects && effects.flash > 0.001) {
      ctx.fillStyle = `rgba(${effects.flashColor},${effects.flash * 0.5})`;
      ctx.fillRect(0, 0, this.w, this.h);
    }
  }

  tracePolygon(poly) {
    const { ctx } = this;
    const pts = poly.points;
    if (pts.length < 2) return;
    ctx.moveTo(this.sx(pts[0].x), this.sy(pts[0].y));
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(this.sx(pts[i].x), this.sy(pts[i].y));
    }
    ctx.closePath();
  }

  // `armed` means every hive is collected, so the pot will actually finish
  // the level. Until then it is inert and should look it.
  drawObjects(level, time, armed = false) {
    for (const obj of level.objects) {
      if (obj.taken) continue;
      const x = this.sx(obj.x);
      const y = this.sy(obj.y);
      const r = OBJECT_RADIUS * this.scale;
      if (obj.type === OBJ.APPLE) this.drawHive(x, y, r, obj.gravity);
      else if (obj.type === OBJ.EXIT) this.drawHoneyPot(x, y, r, time, armed);
      else if (obj.type === OBJ.KILLER) this.drawWasps(x, y, r, time);
    }
  }

  // Beehive (a skep): stacked straw bands with an entrance hole.
  drawHive(x, y, r, gravity) {
    const { ctx } = this;
    ctx.save();
    ctx.translate(x, y);

    if (gravity !== undefined && gravity !== null) {
      // Gravity hives get a halo and an arrow showing the new "down".
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.35, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(120,200,255,0.18)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(150,220,255,0.75)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.moveTo(-r * 0.85, r * 0.9);
    ctx.lineTo(r * 0.85, r * 0.9);
    ctx.quadraticCurveTo(r * 0.95, -r * 0.2, 0, -r);
    ctx.quadraticCurveTo(-r * 0.95, -r * 0.2, -r * 0.85, r * 0.9);
    ctx.closePath();
    const g = ctx.createLinearGradient(-r, -r, r, r);
    g.addColorStop(0, '#e8c070');
    g.addColorStop(1, '#b8863a');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = '#7a5520';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Straw bands
    ctx.strokeStyle = 'rgba(122,85,32,0.55)';
    ctx.lineWidth = 1;
    for (let i = -1; i <= 2; i++) {
      const by = (i / 3) * r * 0.9;
      const half = r * 0.9 * Math.sqrt(Math.max(0, 1 - (by / (r * 1.2)) ** 2));
      ctx.beginPath();
      ctx.moveTo(-half, by);
      ctx.lineTo(half, by);
      ctx.stroke();
    }

    // Entrance
    ctx.beginPath();
    ctx.ellipse(0, r * 0.5, r * 0.18, r * 0.26, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#4a3010';
    ctx.fill();

    if (gravity !== undefined && gravity !== null) {
      const dirs = {
        [GRAVITY_DIR.UP]: [0, -1], [GRAVITY_DIR.DOWN]: [0, 1],
        [GRAVITY_DIR.LEFT]: [-1, 0], [GRAVITY_DIR.RIGHT]: [1, 0],
      };
      // Screen y is already flipped relative to world, so UP draws upward.
      const [dx, dy] = dirs[gravity] || [0, 1];
      ctx.strokeStyle = '#9fe0ff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(dx * r * 0.2, dy * r * 0.2);
      ctx.lineTo(dx * r * 1.1, dy * r * 1.1);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(dx * r * 1.3, dy * r * 1.3);
      ctx.lineTo(dx * r * 0.7 - dy * r * 0.35, dy * r * 0.7 + dx * r * 0.35);
      ctx.lineTo(dx * r * 0.7 + dy * r * 0.35, dy * r * 0.7 - dx * r * 0.35);
      ctx.closePath();
      ctx.fillStyle = '#9fe0ff';
      ctx.fill();
    }

    ctx.restore();
  }

  drawHoneyPot(x, y, r, time, armed) {
    const { ctx } = this;
    ctx.save();
    ctx.translate(x, y);
    const speed = armed ? 7 : 3;
    const pulse = 1 + (armed ? 0.16 : 0.05) * Math.sin(time * speed);
    const reach = (armed ? 2.9 : 1.7) * pulse;

    ctx.beginPath();
    ctx.arc(0, 0, r * reach, 0, Math.PI * 2);
    const glow = ctx.createRadialGradient(0, 0, r * 0.3, 0, 0, r * reach);
    glow.addColorStop(0, `rgba(240,168,48,${armed ? 0.62 : 0.3})`);
    glow.addColorStop(1, 'rgba(240,168,48,0)');
    ctx.fillStyle = glow;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(-r * 0.6, -r * 0.7);
    ctx.lineTo(r * 0.6, -r * 0.7);
    ctx.quadraticCurveTo(r * 1.0, r * 0.2, r * 0.55, r * 0.95);
    ctx.lineTo(-r * 0.55, r * 0.95);
    ctx.quadraticCurveTo(-r * 1.0, r * 0.2, -r * 0.6, -r * 0.7);
    ctx.closePath();
    const g = ctx.createLinearGradient(-r, -r, r, r);
    g.addColorStop(0, PALETTE.honey);
    g.addColorStop(1, PALETTE.honeyDark);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = '#6d4208';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#f7e3b0';
    ctx.fillRect(-r * 0.78, -r * 0.95, r * 1.56, r * 0.3);
    ctx.strokeRect(-r * 0.78, -r * 0.95, r * 1.56, r * 0.3);
    ctx.restore();
  }

  // Wasp swarm: the original's spinning spiked killer ball.
  drawWasps(x, y, r, time) {
    const { ctx } = this;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(time * 3.2);

    ctx.beginPath();
    const spikes = 9;
    for (let i = 0; i < spikes * 2; i++) {
      const a = (i / (spikes * 2)) * Math.PI * 2;
      const rr = i % 2 === 0 ? r : r * 0.55;
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fillStyle = PALETTE.wasp;
    ctx.fill();
    ctx.strokeStyle = PALETTE.waspDark;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, r * 0.42, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE.waspDark;
    ctx.fill();
    ctx.restore();
  }

  drawBike(mot, dead) {
    const { ctx } = this;
    const rot = mot.bike.rotation;
    const i1 = { x: Math.cos(rot), y: Math.sin(rot) };
    const j1 = rot90(i1);
    const face = mot.flipped ? 1 : -1; // see Motor.init: flipped means facing +x

    // Bike-local point (forward, up) in metres -> world point.
    const toWorld = (fwd, up) => ({
      x: mot.bike.r.x + i1.x * fwd * face + j1.x * up,
      y: mot.bike.r.y + i1.y * fwd * face + j1.y * up,
    });
    const handlebar = toWorld(0.58, 0.44);

    // Suspension arms double as the forks. They are genuinely springs, so
    // drawing them as straight struts to the wheel hubs is honest.
    const [bx, by] = [this.sx(mot.bike.r.x), this.sy(mot.bike.r.y)];
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#8e939b';
    ctx.lineWidth = 0.1 * this.scale;
    ctx.beginPath();
    ctx.moveTo(bx, by); ctx.lineTo(this.sx(mot.leftWheel.r.x), this.sy(mot.leftWheel.r.y));
    ctx.moveTo(bx, by); ctx.lineTo(this.sx(mot.rightWheel.r.x), this.sy(mot.rightWheel.r.y));
    ctx.stroke();

    this.drawWheel(mot.leftWheel);
    this.drawWheel(mot.rightWheel);
    this.drawFrame(mot, bx, by, rot, face);
    this.drawBear(mot, handlebar, toWorld, face, dead);
  }

  // Frame drawn in bike-local metres: +x forward, +y up. The transform maps
  // that onto the screen (which has +y down), mirroring on x when turned.
  drawFrame(mot, bx, by, rot, face) {
    const { ctx } = this;
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(-rot);
    ctx.scale(face * this.scale, -this.scale);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // Exhaust
    ctx.strokeStyle = '#9aa0aa';
    ctx.lineWidth = 0.09;
    ctx.beginPath();
    ctx.moveTo(0.1, -0.02);
    ctx.quadraticCurveTo(-0.35, -0.06, -0.62, 0.08);
    ctx.stroke();

    // Main body: tank, seat and tail as one silhouette
    ctx.beginPath();
    ctx.moveTo(-0.58, 0.22);
    ctx.lineTo(-0.44, 0.3);
    ctx.lineTo(-0.1, 0.31);
    ctx.quadraticCurveTo(0.14, 0.46, 0.34, 0.38);
    ctx.lineTo(0.46, 0.2);
    ctx.lineTo(0.3, 0.04);
    ctx.lineTo(-0.16, -0.04);
    ctx.quadraticCurveTo(-0.46, 0.0, -0.58, 0.22);
    ctx.closePath();
    // Each machine has its own frame colour; the light and dark ends are
    // mixed from it so one number paints the whole frame.
    const base = mot.frameColor || PALETTE.frame;
    const g = ctx.createLinearGradient(-0.6, 0, 0.5, 0.45);
    g.addColorStop(0, shade(base, -0.3));
    g.addColorStop(0.5, base);
    g.addColorStop(1, shade(base, 0.35));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = shade(mot.frameColor || PALETTE.frame, -0.5);
    ctx.lineWidth = 0.03;
    ctx.stroke();

    // Seat
    ctx.beginPath();
    ctx.moveTo(-0.5, 0.29);
    ctx.lineTo(-0.08, 0.3);
    ctx.lineTo(-0.1, 0.36);
    ctx.lineTo(-0.48, 0.34);
    ctx.closePath();
    ctx.fillStyle = '#20232a';
    ctx.fill();

    // Fork stem and handlebar
    ctx.strokeStyle = '#3a3f49';
    ctx.lineWidth = 0.07;
    ctx.beginPath();
    ctx.moveTo(0.36, 0.14);
    ctx.lineTo(0.58, 0.44);
    ctx.stroke();
    ctx.strokeStyle = '#c9ced6';
    ctx.lineWidth = 0.08;
    ctx.beginPath();
    ctx.moveTo(0.5, 0.44);
    ctx.lineTo(0.68, 0.44);
    ctx.stroke();

    // Headlight
    ctx.beginPath();
    ctx.arc(0.52, 0.28, 0.1, 0, Math.PI * 2);
    ctx.fillStyle = '#ffe9a8';
    ctx.fill();
    ctx.strokeStyle = '#6d1d14';
    ctx.lineWidth = 0.025;
    ctx.stroke();

    ctx.restore();
  }

  // The best run, drawn translucent. `pose` is motor-shaped, so this is the
  // same drawing code the player gets.
  drawGhost(pose) {
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha = 0.45;
    // Washed out as well as translucent, so it never reads as a second bear.
    // `filter` is ignored by older engines; the alpha alone still works.
    ctx.filter = 'grayscale(0.9) brightness(1.3)';
    this.drawBike(pose, false);
    ctx.restore();
  }

  drawWheel(wheel) {
    const { ctx } = this;
    const s = this.scale;
    const x = this.sx(wheel.r.x);
    const y = this.sy(wheel.r.y);
    const r = wheel.radius * s;

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE.tyre;
    ctx.fill();
    ctx.lineWidth = 0.055 * s;
    ctx.strokeStyle = '#3a3a40';
    ctx.stroke();

    ctx.save();
    ctx.translate(x, y);
    // World y is flipped on screen, so positive rotation must draw clockwise.
    ctx.rotate(-wheel.rotation);
    ctx.strokeStyle = PALETTE.rim;
    ctx.lineWidth = Math.max(1, 0.035 * s);
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * r * 0.72, Math.sin(a) * r * 0.72);
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  drawBear(mot, handlebar, toWorld, face, dead) {
    const { ctx } = this;
    const s = this.scale;

    const bodyX = this.sx(mot.bodyR.x);
    const bodyY = this.sy(mot.bodyR.y);
    const headX = this.sx(mot.headR.x);
    const headY = this.sy(mot.headR.y);
    const hr = HEAD_RADIUS * s;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Legs down to the footpeg, drawn first so the torso overlaps them.
    const peg = toWorld(0.08, -0.16);
    ctx.strokeStyle = PALETTE.furDark;
    ctx.lineWidth = 0.19 * s;
    ctx.beginPath();
    ctx.moveTo(bodyX, bodyY);
    ctx.lineTo(this.sx(peg.x), this.sy(peg.y));
    ctx.stroke();

    // Torso: tapered, wider at the hips than the shoulders.
    const dx = headX - bodyX;
    const dy = headY - bodyY;
    const l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l;
    const ny = dx / l;
    const hip = 0.23 * s;
    const shoulder = 0.19 * s;
    ctx.beginPath();
    ctx.moveTo(bodyX + nx * hip, bodyY + ny * hip);
    ctx.lineTo(headX + nx * shoulder, headY + ny * shoulder);
    ctx.lineTo(headX - nx * shoulder, headY - ny * shoulder);
    ctx.lineTo(bodyX - nx * hip, bodyY - ny * hip);
    ctx.closePath();
    ctx.fillStyle = PALETTE.fur;
    ctx.fill();
    ctx.strokeStyle = PALETTE.furDark;
    ctx.lineWidth = Math.max(1, 0.025 * s);
    ctx.stroke();

    // Arm reaching for the handlebar
    const shoulderPoint = {
      x: mot.bodyR.x + (mot.headR.x - mot.bodyR.x) * 0.78,
      y: mot.bodyR.y + (mot.headR.y - mot.bodyR.y) * 0.78,
    };
    ctx.strokeStyle = PALETTE.furDark;
    ctx.lineWidth = 0.15 * s;
    ctx.beginPath();
    ctx.moveTo(this.sx(shoulderPoint.x), this.sy(shoulderPoint.y));
    ctx.lineTo(this.sx(handlebar.x), this.sy(handlebar.y));
    ctx.stroke();

    // Ears
    for (const sgn of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(headX + sgn * hr * 0.68, headY - hr * 0.78, hr * 0.44, 0, Math.PI * 2);
      ctx.fillStyle = PALETTE.furDark;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(headX + sgn * hr * 0.68, headY - hr * 0.78, hr * 0.22, 0, Math.PI * 2);
      ctx.fillStyle = '#5a3620';
      ctx.fill();
    }

    // Head. This circle is exactly the hitbox, so the player can read it.
    ctx.beginPath();
    ctx.arc(headX, headY, hr, 0, Math.PI * 2);
    const g = ctx.createRadialGradient(
      headX - hr * 0.3, headY - hr * 0.35, hr * 0.1, headX, headY, hr
    );
    g.addColorStop(0, PALETTE.furLight);
    g.addColorStop(1, PALETTE.fur);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = Math.max(1.2, 0.035 * s);
    ctx.strokeStyle = dead ? PALETTE.danger || '#e0453a' : PALETTE.furDark;
    ctx.stroke();

    // Muzzle and nose, facing the direction of travel
    const dir = face;
    ctx.beginPath();
    ctx.ellipse(headX + dir * hr * 0.52, headY + hr * 0.26, hr * 0.46, hr * 0.34, 0, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE.snout;
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(headX + dir * hr * 0.82, headY + hr * 0.14, hr * 0.16, hr * 0.12, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#2a1a0e';
    ctx.fill();

    // Eye
    if (dead) {
      ctx.strokeStyle = '#1b1109';
      ctx.lineWidth = Math.max(1.5, hr * 0.14);
      const ex = headX + dir * hr * 0.22;
      const ey = headY - hr * 0.22;
      const k = hr * 0.2;
      ctx.beginPath();
      ctx.moveTo(ex - k, ey - k); ctx.lineTo(ex + k, ey + k);
      ctx.moveTo(ex + k, ey - k); ctx.lineTo(ex - k, ey + k);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(headX + dir * hr * 0.26, headY - hr * 0.22, hr * 0.13, 0, Math.PI * 2);
      ctx.fillStyle = '#1b1109';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(headX + dir * hr * 0.31, headY - hr * 0.27, hr * 0.05, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
  }
}

// Where the bike sits vertically in the frame, as a fraction from the top.
const BIKE_SCREEN_FRACTION = 0.58;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const mod = (v, m) => ((v % m) + m) % m;

function makeStars(count) {
  const stars = [];
  // Fixed layout, so the sky does not shimmer between frames.
  let seed = 20260101;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let i = 0; i < count; i++) {
    stars.push({ x: rand(), y: rand(), s: rand() < 0.8 ? 1 : 2, a: 0.15 + rand() * 0.55 });
  }
  return stars;
}

export { PALETTE };
