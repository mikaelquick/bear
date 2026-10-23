// Replays and ghosts.
//
// A replay stores one (frame duration, input flags) pair per rendered frame —
// about 5 bytes a frame, so a minute of driving is a few kilobytes. Playing it
// back means re-running the same simulation, not reading back positions.
//
// Caveat: this relies on floating point reproducibility. Within one browser it
// is exact. Across engines `sin`/`cos`/`atan2` are not bit-identical, so a
// replay recorded elsewhere may drift. Nothing breaks if it does — the ghost
// simply follows a slightly different line.

import { createRun, advanceFrame, INPUT } from './sim.js';
import { TIME_TO_CENTISECONDS } from './constants.js';

export const REPLAY_VERSION = 1;
const MAX_FRAMES = 18000; // ~5 minutes at 60fps

export { INPUT };

export class Recorder {
  constructor() {
    this.reset();
  }

  reset() {
    this.dts = [];
    this.flags = [];
    this.overflowed = false;
  }

  // `dtMs` must be the exact value handed to advanceFrame. The caller rounds
  // it to float32 first so storing it is lossless.
  record(dtMs, flags) {
    if (this.dts.length >= MAX_FRAMES) {
      this.overflowed = true;
      return;
    }
    this.dts.push(dtMs);
    this.flags.push(flags);
  }

  get frameCount() {
    return this.dts.length;
  }

  // Null when the run is too long to store faithfully.
  encode() {
    if (this.overflowed) return null;
    return encodeFrames(this.dts, this.flags);
  }
}

// [uint32 count][float32 dtMs × count][uint8 flags × count], base64'd.
export function encodeFrames(dts, flags) {
  const n = dts.length;
  const buffer = new ArrayBuffer(4 + n * 5);
  const view = new DataView(buffer);
  view.setUint32(0, n, true);
  for (let i = 0; i < n; i++) view.setFloat32(4 + i * 4, dts[i], true);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < n; i++) bytes[4 + n * 4 + i] = flags[i];
  return bytesToBase64(bytes);
}

export function decodeFrames(base64) {
  const bytes = base64ToBytes(base64);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const n = view.getUint32(0, true);
  if (bytes.length !== 4 + n * 5) throw new Error('trasig inspelning');
  const dts = new Float32Array(n);
  for (let i = 0; i < n; i++) dts[i] = view.getFloat32(4 + i * 4, true);
  const flags = bytes.slice(4 + n * 4);
  return { dts, flags };
}

function bytesToBase64(bytes) {
  let binary = '';
  const chunk = 0x8000; // avoid blowing the argument limit on long runs
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Cheap content hash, so a replay is discarded when its level is edited.
export function levelFingerprint(level) {
  const text = JSON.stringify(level.toJSON());
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

// Re-runs a replay and samples the bike pose at every physics substep.
// Returns whatever it managed to simulate, even if the run diverged.
export function simulateReplay(level, frames) {
  level.objects.forEach((o) => { o.taken = false; });
  const run = createRun(level);
  const samples = [];
  // When each hive was collected, so playback can make them vanish on cue.
  const events = [];
  const hooks = {
    onSubstep: () => samples.push(pose(run.time, run.motor)),
    onObject: (obj, index) => events.push({ index, t: run.time }),
  };
  hooks.onSubstep();

  let outcome = 'normal';
  for (let i = 0; i < frames.dts.length; i++) {
    outcome = advanceFrame(level, run, frames.dts[i], frames.flags[i], hooks);
    if (outcome !== 'normal') break;
  }

  level.objects.forEach((o) => { o.taken = false; });
  return {
    samples,
    events,
    outcome,
    duration: run.time,
    centiseconds: run.time * TIME_TO_CENTISECONDS,
  };
}

function pose(time, m) {
  return {
    t: time,
    bx: m.bike.r.x, by: m.bike.r.y, brot: m.bike.rotation,
    lx: m.leftWheel.r.x, ly: m.leftWheel.r.y, lrot: m.leftWheel.rotation,
    rx: m.rightWheel.r.x, ry: m.rightWheel.r.y, rrot: m.rightWheel.rotation,
    yx: m.bodyR.x, yy: m.bodyR.y,
    hx: m.headR.x, hy: m.headR.y,
    flipped: m.flipped,
  };
}

const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;
// Shortest-arc interpolation, so a wheel spinning past PI does not unwind.
const lerpAngle = (a, b, t) => {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return a + d * t;
};

// Samples a simulated replay by simulation time, and shapes the result so the
// renderer can draw it with the same code it uses for the player.
export class Ghost {
  constructor(samples, centiseconds, events = []) {
    this.samples = samples;
    this.centiseconds = centiseconds;
    this.events = events;
    this.cursor = 0;
  }

  // Marks hives as taken to match a point in the run. Used by playback, which
  // has no simulation of its own to do it.
  applyPickups(level, time) {
    for (const obj of level.objects) obj.taken = false;
    for (const e of this.events) {
      if (e.t <= time && level.objects[e.index]) level.objects[e.index].taken = true;
    }
  }

  get duration() {
    return this.samples.length ? this.samples[this.samples.length - 1].t : 0;
  }

  rewind() {
    this.cursor = 0;
  }

  // Returns a fresh motor-shaped object for the renderer, or null past the
  // end. Fresh rather than reused: callers naturally hold on to two poses to
  // compare them, and a shared buffer makes that silently wrong.
  poseAt(time) {
    const s = this.samples;
    if (!s.length) return null;
    if (time > s[s.length - 1].t) return null;

    if (time < s[this.cursor].t) this.cursor = 0;
    while (this.cursor < s.length - 1 && s[this.cursor + 1].t <= time) this.cursor++;

    const a = s[this.cursor];
    const b = s[Math.min(this.cursor + 1, s.length - 1)];
    const span = b.t - a.t;
    const k = span > 1e-9 ? (time - a.t) / span : 0;

    const m = blankMotor();
    m.bike.r.x = lerp(a.bx, b.bx, k);
    m.bike.r.y = lerp(a.by, b.by, k);
    m.bike.rotation = lerpAngle(a.brot, b.brot, k);
    m.leftWheel.r.x = lerp(a.lx, b.lx, k);
    m.leftWheel.r.y = lerp(a.ly, b.ly, k);
    m.leftWheel.rotation = lerpAngle(a.lrot, b.lrot, k);
    m.rightWheel.r.x = lerp(a.rx, b.rx, k);
    m.rightWheel.r.y = lerp(a.ry, b.ry, k);
    m.rightWheel.rotation = lerpAngle(a.rrot, b.rrot, k);
    m.bodyR.x = lerp(a.yx, b.yx, k);
    m.bodyR.y = lerp(a.yy, b.yy, k);
    m.headR.x = lerp(a.hx, b.hx, k);
    m.headR.y = lerp(a.hy, b.hy, k);
    m.flipped = a.flipped;
    return m;
  }
}

function blankMotor() {
  return {
    bike: { r: { x: 0, y: 0 }, rotation: 0, radius: 0.3 },
    leftWheel: { r: { x: 0, y: 0 }, rotation: 0, radius: 0.4 },
    rightWheel: { r: { x: 0, y: 0 }, rotation: 0, radius: 0.4 },
    bodyR: { x: 0, y: 0 },
    headR: { x: 0, y: 0 },
    flipped: true,
  };
}

// Builds a ghost from stored replay data, or null if it cannot be used.
export function loadGhost(level, stored) {
  if (!stored || stored.v !== REPLAY_VERSION) return null;
  if (stored.fingerprint && stored.fingerprint !== levelFingerprint(level)) return null;
  try {
    const frames = decodeFrames(stored.frames);
    const result = simulateReplay(level, frames);
    if (result.samples.length < 2) return null;
    return new Ghost(result.samples, stored.time, result.events);
  } catch {
    return null;
  }
}
