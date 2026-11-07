/**
 * Every sound is synthesized with WebAudio: no assets to load, nothing to license.
 * The context is created lazily on the first user gesture (browsers require one).
 */
export type Sound =
  | "scoop"
  | "topping"
  | "wasted"
  | "cherry-offer"
  | "serve"
  | "rainbow"
  | "bump"
  | "spill"
  | "giggle"
  | "tick"
  | "go"
  | "over"
  | "step"
  | "ui";

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  enabled = true;

  /** Call from a user gesture (key press / click). */
  unlock() {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  /** Silence everything while the app is paused or hidden. */
  suspend() {
    if (this.ctx && this.ctx.state === "running") void this.ctx.suspend();
  }

  resume() {
    if (this.ctx && this.ctx.state === "suspended" && this.enabled) void this.ctx.resume();
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    if (!on) this.suspend();
    else this.resume();
  }

  play(sound: Sound, variant = 0) {
    if (!this.enabled || !this.ctx || !this.master || this.ctx.state !== "running") return;
    const t = this.ctx.currentTime + 0.005;
    switch (sound) {
      case "scoop": {
        // A soft "plop" that climbs a little with each scoop.
        const base = 330 * Math.pow(1.06, Math.min(variant, 10));
        this.tone("sine", base * 1.6, base, t, 0.16, 0.5);
        this.noise(t, 0.05, 1800, 0.12);
        break;
      }
      case "topping":
        [0, 1, 2].forEach((i) => this.tone("triangle", 1046 * Math.pow(1.26, i), null, t + i * 0.05, 0.12, 0.22));
        break;
      case "wasted":
        this.tone("triangle", 520, 300, t, 0.18, 0.2);
        break;
      case "cherry-offer":
        this.tone("sine", 1318, null, t, 0.12, 0.18);
        this.tone("sine", 1760, null, t + 0.08, 0.16, 0.18);
        break;
      case "serve":
        [523, 659, 784, 1046].forEach((f, i) => this.tone("triangle", f, null, t + i * 0.09, 0.22, 0.32));
        this.tone("sine", 1568, null, t + 0.38, 0.4, 0.2);
        break;
      case "rainbow":
        [784, 988, 1175, 1568, 1976].forEach((f, i) => this.tone("sine", f, null, t + i * 0.06, 0.18, 0.22));
        break;
      case "bump":
        this.tone("square", 180, 90, t, 0.12, 0.25);
        this.noise(t, 0.06, 900, 0.25);
        break;
      case "spill":
        this.noise(t + 0.05, 0.35, 700, 0.35);
        this.tone("sine", 420, 140, t + 0.05, 0.35, 0.3);
        break;
      case "giggle":
        // Bouncy little "hee-hee-hee" chirps.
        for (let i = 0; i < 5; i++) {
          const f = 880 + (i % 2) * 140 + i * 30;
          this.tone("sine", f * 1.15, f, t + i * 0.085, 0.07, 0.22);
        }
        break;
      case "tick":
        this.tone("sine", 660, null, t, 0.12, 0.3);
        break;
      case "go":
        this.tone("triangle", 988, null, t, 0.12, 0.3);
        this.tone("triangle", 1318, null, t + 0.1, 0.25, 0.3);
        break;
      case "over":
        [784, 659, 523, 659, 784].forEach((f, i) => this.tone("triangle", f, null, t + i * 0.12, 0.2, 0.28));
        break;
      case "step":
        this.tone("sine", 520 + variant * 160, null, t, 0.12, 0.25);
        break;
      case "ui":
        this.tone("sine", 740, null, t, 0.06, 0.15);
        break;
    }
  }

  private tone(type: OscillatorType, f0: number, f1: number | null, at: number, dur: number, gain: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, at);
    if (f1 !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), at + dur);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(gain, at + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(g).connect(this.master!);
    osc.start(at);
    osc.stop(at + dur + 0.02);
  }

  private noise(at: number, dur: number, cutoff: number, gain: number) {
    const ctx = this.ctx!;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(filter).connect(g).connect(this.master!);
    src.start(at);
  }
}
