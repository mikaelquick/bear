// Tiny WebAudio synth. No asset files — everything is generated.
//
// Muted by default while we are waiting on proper sounds. Nothing here is
// wired to the simulation, so toggling it cannot affect a run or a replay.

export class Sfx {
  constructor(enabled = false) {
    this.ctx = null;
    this.enabled = enabled;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) this.silenceEngine();
  }

  // Browsers require a user gesture before audio starts. While muted we never
  // create an AudioContext at all.
  ensure() {
    if (!this.enabled) return null;
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
      this.initEngine();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  initEngine() {
    const ctx = this.ctx;
    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 60;
    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 500;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
  }

  // wheelSpeed in rad/s (0..110), gas is whether the throttle is open.
  engine(wheelSpeed, gas) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    const speed = Math.min(Math.abs(wheelSpeed), 110) / 110;
    this.engineOsc.frequency.setTargetAtTime(55 + speed * 190, t, 0.05);
    this.engineFilter.frequency.setTargetAtTime(300 + speed * 1400, t, 0.05);
    this.engineGain.gain.setTargetAtTime(gas ? 0.14 : 0.035, t, 0.08);
  }

  silenceEngine() {
    if (!this.ctx) return;
    this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
  }

  noise(duration, gain, filterFreq, type = 'lowpass') {
    const ctx = this.ensure();
    if (!ctx || !this.enabled) return;
    const n = Math.floor(ctx.sampleRate * duration);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start();
  }

  tone(freq, duration, gain = 0.2, type = 'sine', slideTo = null) {
    const ctx = this.ensure();
    if (!ctx || !this.enabled) return;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + duration);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    o.connect(g); g.connect(this.master);
    o.start();
    o.stop(ctx.currentTime + duration);
  }

  bump(volume) { this.noise(0.09, 0.25 * volume + 0.05, 900); }
  squeak(volume) {
    if (volume < 0.4) return;
    this.tone(700 + Math.random() * 300, 0.07, Math.min(volume * 0.012, 0.05), 'triangle');
  }
  apple() { this.tone(880, 0.12, 0.18, 'sine', 1400); }
  gravity() { this.tone(300, 0.4, 0.2, 'triangle', 900); }
  death() {
    this.noise(0.35, 0.4, 400);
    this.tone(160, 0.4, 0.22, 'sawtooth', 50);
  }
  finish() {
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => this.tone(f, 0.28, 0.2, 'triangle'), i * 95);
    });
  }
  turn() { this.noise(0.06, 0.1, 2500, 'bandpass'); }
}
