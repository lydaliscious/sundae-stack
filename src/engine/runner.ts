import { Sfx } from "@/audio/sfx";
import { DEFAULT_CONFIG, type GameConfig } from "@/game/config";
import {
  createGame,
  distinctFlavors,
  isRoundActive,
  pendingValue,
  setHold,
  spillsLeft,
  startRound,
  stepGame,
  timeLeft,
} from "@/game/sim";
import type { GameEvent, GameState } from "@/game/types";
import { LittlePoseAdapter } from "@/input/adapters/little-pose";
import { MediaPipePoseAdapter } from "@/input/adapters/mediapipe-pose";
import type { PoseInputAdapter, PoseSample } from "@/input/adapters/types";
import { CalibrationFlow } from "@/input/calibration";
import { defaultCalibration, toUnit, type Calibration } from "@/input/mapping";
import { DEFAULT_MOVEMENT, Movement } from "@/input/movement";
import { DEFAULT_TRACKING, TrackingMonitor } from "@/input/tracking";
import { can, emit, isHosted, littleApp } from "@/little/host";
import { Renderer, type Scene } from "@/render/renderer";
import { describeSundae, sundaeThumbnail } from "@/render/thumbnail";
import { initialHud, sameHud, Store, type Banner, type Hud, type Mode, type UiState } from "./store";

/** Fixed simulation step. Rendering runs at the display's rate and interpolates. */
export const STEP = 1 / 120;
const MAX_STEPS_PER_FRAME = 12;
const POSE_FIRST_FRAME_TIMEOUT_MS = 4000;
/** Little's pose stream must produce at least one confident hip reading this soon, or we use the on-device tracker. */
const POSE_QUALITY_TIMEOUT_MS = 8000;
/**
 * In development (`little dev`), Little's pose runs remotely and lags, so the on-device tracker goes
 * first. On a television the host's pose runs on the device, so production keeps Little first.
 */
const PREFER_ON_DEVICE = process.env.NODE_ENV !== "production";
const RESULTS_DELAY_MS = 900;

const BEST_KEY = "sundae-stack:best";
const PREFS_KEY = "sundae-stack:prefs";

export type ActionOutcome = { ok: boolean; detail?: string; say?: string };

/**
 * Owns the game: the fixed-timestep loop, the pure simulation, input (pose or keys → one movement
 * path), the renderer and the audio. React only renders the DOM overlays from `store`.
 */
export class GameRunner {
  readonly config: GameConfig;
  readonly state: GameState;
  readonly store: Store<UiState>;
  readonly movement: Movement;
  readonly sfx = new Sfx();

  private renderer: Renderer | null = null;
  private raf = 0;
  private last = 0;
  private acc = 0;
  private clock = 0;

  private monitor = new TrackingMonitor();
  private flow = new CalibrationFlow();
  private calibration: Calibration | null = null;
  private adapter: PoseInputAdapter | null = null;
  private adapterStart: Promise<void> | null = null;
  private adapterToken = 0;
  lastSample: PoseSample | null = null;
  private resumeAfterCalibration = false;
  private trackingHeld = false;
  private visible = true;
  private awaySources = new Set<string>();
  private bannerTimer: ReturnType<typeof setTimeout> | null = null;
  private resultsTimer: ReturnType<typeof setTimeout> | null = null;
  private hudThrottle = 0;

  constructor(config: GameConfig = DEFAULT_CONFIG) {
    this.config = config;
    this.state = createGame(1, config);
    this.movement = new Movement({ ...DEFAULT_MOVEMENT, minX: config.player.minX, maxX: config.player.maxX });
    const prefs = readPrefs();
    this.sfx.enabled = prefs.sound;
    this.store = new Store<UiState>({
      screen: "menu",
      mode: prefs.mode,
      sound: prefs.sound,
      paused: false,
      pauseReason: null,
      hud: { ...initialHud, timeLeft: config.roundSeconds, spillsLeft: config.maxSpills },
      banner: null,
      tracking: { status: "off", problem: null, source: null, starting: false, error: null },
      calibration: { step: "center", progress: 0, unit: 0, usedDefault: false },
      results: null,
      best: readBest(),
      hosted: false,
    });
  }

  // ── lifecycle ────────────────────────────────────────────────────────────────────────────

  attach(canvas: HTMLCanvasElement) {
    this.renderer = new Renderer(canvas);
    this.renderer.miniConfig = this.config;
    this.last = performance.now() / 1000;
    const frame = (ms: number) => {
      this.raf = requestAnimationFrame(frame);
      this.frame(ms / 1000);
    };
    this.raf = requestAnimationFrame(frame);
  }

  detach() {
    cancelAnimationFrame(this.raf);
    this.renderer = null;
    this.stopAdapter();
    if (this.bannerTimer) clearTimeout(this.bannerTimer);
    if (this.resultsTimer) clearTimeout(this.resultsTimer);
  }

  private frame(now: number) {
    const real = Math.min(0.1, Math.max(0, now - this.last));
    this.last = now;
    const ui = this.store.get();
    if (this.adapter) {
      this.monitor.tick(now);
      this.syncTracking();
    }

    let playerX = this.movement.worldX;
    let alpha = 1;
    let scene: Scene = ui.screen;
    const frozen = this.state.holds.size > 0;

    if (ui.screen === "game") {
      this.acc += real;
      let steps = 0;
      while (this.acc >= STEP && steps < MAX_STEPS_PER_FRAME) {
        this.acc -= STEP;
        steps++;
        if (this.state.holds.size === 0) this.movement.update(STEP);
        for (const ev of stepGame(this.state, STEP, { playerX: this.movement.worldX })) this.onGameEvent(ev);
      }
      if (steps === MAX_STEPS_PER_FRAME) this.acc = 0;
      alpha = this.acc / STEP;
      playerX = this.movement.worldX;
    } else if (ui.screen === "calibrate") {
      this.movement.update(real);
      playerX = this.movement.worldX;
    } else if (ui.screen === "menu") {
      this.clock += real;
      playerX = 960 + Math.sin(this.clock * 0.7) * 110;
      scene = "menu";
    } else {
      this.movement.setTarget(0);
      this.movement.update(real);
      playerX = this.movement.worldX;
    }

    this.renderer?.draw(this.state, { scene, playerX, dt: frozen ? 0 : real, alpha });

    this.hudThrottle -= real;
    if (this.hudThrottle <= 0) {
      this.hudThrottle = 0.08;
      this.publishHud();
    }
  }

  // ── game flow (the same actions back the UI buttons, the remote and Little tools) ─────────

  startGame(mode: Mode): ActionOutcome {
    this.sfx.unlock();
    this.cancelResults();
    this.store.set({ mode, results: null });
    savePrefs({ mode, sound: this.store.get().sound });
    if (mode === "camera") {
      if (!this.calibration) {
        this.resumeAfterCalibration = false;
        this.goCalibrate();
        return { ok: true, say: "Let's set up the camera. Stand in the middle first." };
      }
      void this.ensureAdapter();
    } else {
      this.stopAdapter();
    }
    this.beginRound();
    return { ok: true };
  }

  recalibrate(): ActionOutcome {
    this.sfx.unlock();
    const ui = this.store.get();
    this.resumeAfterCalibration = ui.screen === "game" && isRoundActive(this.state);
    if (this.resumeAfterCalibration && !ui.paused) this.pause();
    this.store.set({ mode: "camera" });
    this.goCalibrate();
    return { ok: true, say: "Stand in the middle, then step left and right when I ask." };
  }

  confirmCalibration(): ActionOutcome {
    if (this.store.get().screen !== "calibrate" || !this.calibration || this.flow.step !== "test") {
      return { ok: false, detail: "Calibration isn't finished yet: the player still needs to stand centre, step left, then step right." };
    }
    this.sfx.play("go");
    if (this.resumeAfterCalibration && isRoundActive(this.state)) {
      this.resumeAfterCalibration = false;
      this.store.set({ screen: "game" });
      this.syncTracking();
      this.resume();
      return { ok: true };
    }
    this.beginRound();
    return { ok: true };
  }

  /** Skips the walk-through and uses a default range around where the player stands now. */
  skipCalibration(): ActionOutcome {
    if (this.store.get().screen !== "calibrate") return { ok: false, detail: "Camera setup isn't open." };
    if (this.store.get().tracking.error) {
      return { ok: false, detail: "The camera isn't working, so there's nothing to steer with. Use redo_calibration to retry the camera, or start_game with mode keyboard." };
    }
    const center = this.monitor.x ?? 0.5;
    this.calibration = defaultCalibration(center);
    this.flow.step = "test";
    this.store.set((s) => ({ calibration: { ...s.calibration, step: "test", progress: 0, usedDefault: true } }));
    return { ok: true };
  }

  redoCalibration(): ActionOutcome {
    if (this.store.get().screen !== "calibrate") return { ok: false, detail: "Camera setup isn't open. Use recalibrate during a camera round." };
    void this.ensureAdapter();
    this.flow.restart();
    this.calibration = null;
    this.store.set((s) => ({ calibration: { ...s.calibration, step: "center", progress: 0, usedDefault: false } }));
    return { ok: true };
  }

  pause(reason: "user" | "away" = "user"): ActionOutcome {
    const ui = this.store.get();
    if (ui.screen !== "game" || !isRoundActive(this.state)) return { ok: false, detail: "No round is being played right now." };
    if (ui.paused) return { ok: true, detail: "Already paused." };
    setHold(this.state, "paused", true);
    this.movement.releaseKeys();
    this.store.set({ paused: true, pauseReason: reason });
    this.publishHud();
    emit("paused", {});
    return { ok: true };
  }

  resume(): ActionOutcome {
    this.sfx.unlock();
    const ui = this.store.get();
    if (!ui.paused) return { ok: false, detail: "The game isn't paused." };
    this.store.set({ paused: false, pauseReason: null });
    for (const ev of setHold(this.state, "paused", false)) this.onGameEvent(ev);
    this.publishHud();
    return { ok: true };
  }

  restart(): ActionOutcome {
    const ui = this.store.get();
    if (ui.screen === "menu" || ui.screen === "calibrate") return this.startGame(ui.mode);
    this.cancelResults();
    if (ui.mode === "camera") void this.ensureAdapter();
    this.beginRound();
    return { ok: true };
  }

  toggleSound(on?: boolean): ActionOutcome {
    const next = on ?? !this.store.get().sound;
    this.sfx.unlock();
    this.sfx.setEnabled(next);
    this.store.set({ sound: next });
    savePrefs({ mode: this.store.get().mode, sound: next });
    if (next) this.sfx.play("ui");
    return { ok: true, detail: `Sound is ${next ? "on" : "off"}.` };
  }

  showResults(): ActionOutcome {
    const ui = this.store.get();
    if (ui.results) {
      this.cancelResults();
      this.stopAdapter();
      this.store.set({ screen: "results", paused: false });
      return { ok: true };
    }
    return { ok: false, detail: "There are no results yet: a round ends after 60 seconds of play or three spills." };
  }

  toMenu(): ActionOutcome {
    this.cancelResults();
    this.stopAdapter();
    this.state.phase = "idle";
    this.state.holds.clear();
    this.state.resumeCountdown = 0;
    this.movement.reset(0);
    this.store.set({ screen: "menu", paused: false, pauseReason: null, banner: null });
    return { ok: true };
  }

  /** Arrow keys feed the same absolute movement target as the camera. Returns true if used. */
  key(e: KeyboardEvent, down: boolean): boolean {
    const ui = this.store.get();
    if (down) this.sfx.unlock();
    if (ui.screen !== "game" || ui.paused) return false;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      if (ui.mode === "keyboard") this.movement.setKey(e.key === "ArrowLeft" ? "left" : "right", down);
      return true;
    }
    return false;
  }

  /**
   * The app went off screen or came back. Several sources report this (Little's pause, the page's
   * visibility and focus); the game counts as away while any of them says so.
   */
  setAway(source: "little" | "page", away: boolean) {
    if (away) this.awaySources.add(source);
    else this.awaySources.delete(source);
    const visible = this.awaySources.size === 0;
    if (visible === this.visible) return;
    this.visible = visible;
    if (!visible) {
      if (this.store.get().screen === "game" && isRoundActive(this.state)) this.pause("away");
      setHold(this.state, "hidden", true);
      this.stopAdapter();
      this.sfx.suspend();
      this.movement.releaseKeys();
    } else {
      for (const ev of setHold(this.state, "hidden", false)) this.onGameEvent(ev);
      const ui = this.store.get();
      if (ui.mode === "camera" && (ui.screen === "game" || ui.screen === "calibrate")) void this.ensureAdapter();
      if (ui.sound) this.sfx.resume();
    }
  }

  /** Back on the main menu leaves the app (Home is the platform's; Back is ours). */
  async exitApp() {
    const app = littleApp();
    if (app && isHosted()) await app.exit();
  }

  status() {
    const ui = this.store.get();
    return {
      screen: ui.screen,
      mode: ui.mode,
      paused: ui.paused,
      sound: ui.sound,
      score: ui.hud.banked,
      pending: ui.hud.pending,
      secondsLeft: Math.ceil(ui.hud.timeLeft),
      spillsLeft: ui.hud.spillsLeft,
      scoops: ui.hud.scoops,
      flavors: ui.hud.flavors,
      rainbow: ui.hud.rainbow,
      cherryFalling: ui.hud.cherryFalling,
      sundaesServed: ui.hud.served,
      tracking: ui.tracking.status,
      trackingSource: ui.tracking.source,
      trackingProblem: ui.tracking.problem,
      trackingError: ui.tracking.error,
      calibrationStep: ui.screen === "calibrate" ? ui.calibration.step : null,
      onScreen: this.visible,
      awayBecause: [...this.awaySources],
      best: ui.best,
    };
  }

  // ── internals ───────────────────────────────────────────────────────────────────────────

  private beginRound() {
    this.cancelResults();
    this.renderer?.reset();
    this.acc = 0;
    startRound(this.state, { seed: (Math.random() * 2 ** 31) | 0 });
    this.movement.reset(0);
    this.trackingHeld = false;
    this.store.set({ screen: "game", paused: false, pauseReason: null, results: null, banner: null });
    this.syncTracking();
    this.publishHud();
    emit("round_started", { mode: this.store.get().mode });
  }

  private goCalibrate() {
    this.cancelResults();
    this.flow.restart();
    this.calibration = null;
    this.movement.reset(0);
    this.store.set((s) => ({
      screen: "calibrate",
      paused: s.paused,
      calibration: { step: "center", progress: 0, unit: 0, usedDefault: false },
    }));
    void this.ensureAdapter();
  }

  private async ensureAdapter(): Promise<void> {
    if (this.adapter || this.adapterStart) return this.adapterStart ?? undefined;
    const token = ++this.adapterToken;
    this.monitor.reset();
    this.store.set((s) => ({ tracking: { ...s.tracking, starting: true, error: null, status: "searching" } }));
    const onSample = (sample: PoseSample) => {
      if (token === this.adapterToken) this.onSample(sample);
    };
    this.adapterStart = (async () => {
      try {
        if (PREFER_ON_DEVICE && (await this.startMediaPipe(token, onSample))) return;
        if (token !== this.adapterToken) return;
        if (isHosted() && can("sense.pose")) {
          const little = new LittlePoseAdapter();
          let first: () => void = () => {};
          let confident = false;
          const gotFrame = new Promise<void>((resolve) => (first = resolve));
          await little.start((s) => {
            first();
            if (s.confidence >= DEFAULT_TRACKING.minConfidence) confident = true;
            onSample(s);
          });
          const ok = await Promise.race([gotFrame.then(() => true), sleep(POSE_FIRST_FRAME_TIMEOUT_MS).then(() => false)]);
          if (token !== this.adapterToken) return little.stop();
          if (ok) {
            this.adapter = little;
            this.store.set((s) => ({ tracking: { ...s.tracking, source: "little-pose", starting: false, error: null } }));
            // Frames that never find the hips (a zoomed-in or remote stream) would leave setup stuck.
            setTimeout(() => {
              if (token !== this.adapterToken || this.adapter !== little || confident) return;
              little.stop();
              this.adapter = null;
              this.monitor.reset();
              void this.startMediaPipe(token, onSample);
            }, POSE_QUALITY_TIMEOUT_MS);
            return;
          }
          // Granted but silent (e.g. `little dev` without realtime services): use the camera.
          little.stop();
        }
        if (!PREFER_ON_DEVICE) await this.startMediaPipe(token, onSample);
      } catch (err) {
        if (token !== this.adapterToken) return;
        const message = err instanceof Error ? err.message : "Couldn't start body tracking.";
        this.store.set((s) => ({ tracking: { ...s.tracking, starting: false, error: message, status: "off" } }));
      } finally {
        if (token === this.adapterToken) this.adapterStart = null;
      }
    })();
    return this.adapterStart;
  }

  /** On-device MediaPipe Pose on a camera opened through Little (or getUserMedia in a browser). */
  private async startMediaPipe(token: number, onSample: (sample: PoseSample) => void): Promise<boolean> {
    this.store.set((s) => ({ tracking: { ...s.tracking, starting: true, error: null, status: "searching" } }));
    try {
      const mp = new MediaPipePoseAdapter();
      await mp.start(onSample);
      if (token !== this.adapterToken) {
        mp.stop();
        return false;
      }
      this.adapter = mp;
      this.store.set((s) => ({ tracking: { ...s.tracking, source: "mediapipe", starting: false } }));
      return true;
    } catch (err) {
      if (token !== this.adapterToken) return false;
      const message = err instanceof Error ? err.message : "Couldn't start body tracking.";
      this.store.set((s) => ({ tracking: { ...s.tracking, starting: false, error: message, status: "off" } }));
      return false;
    }
  }

  private stopAdapter() {
    this.adapterToken++;
    this.adapter?.stop();
    this.adapter = null;
    this.adapterStart = null;
    this.lastSample = null;
    this.monitor.reset();
    this.store.set((s) => ({ tracking: { ...s.tracking, status: "off", starting: false, error: null } }));
  }

  get previewVideo(): HTMLVideoElement | null {
    return this.adapter?.video ?? null;
  }

  private onSample(sample: PoseSample) {
    this.lastSample = sample;
    const status = this.monitor.update(sample);
    const ui = this.store.get();
    const x = this.monitor.x;
    if (ui.screen === "calibrate") {
      if (status === "tracking" && x !== null) {
        if (this.flow.push(sample.t, x)) {
          this.sfx.unlock();
          this.sfx.play("step", ["left", "right", "test"].indexOf(this.flow.step));
          if (this.flow.step === "test") this.calibration = this.flow.calibration;
        }
        if (this.flow.step === "test" && this.calibration) this.movement.setTarget(toUnit(x, this.calibration));
      } else {
        this.flow.interrupt();
      }
      this.store.set((s) => ({
        calibration: {
          ...s.calibration,
          step: this.flow.step,
          progress: this.flow.progress,
          unit: this.calibration && x !== null ? toUnit(x, this.calibration) : 0,
        },
      }));
    } else if (ui.screen === "game" && ui.mode === "camera" && this.calibration && status === "tracking" && x !== null) {
      this.movement.setTarget(toUnit(x, this.calibration));
    }
    this.syncTracking();
  }

  /** Mirrors tracking health into the UI and, in a camera round, freezes the game on loss. */
  private syncTracking() {
    const ui = this.store.get();
    const status = this.adapter || this.adapterStart ? this.monitor.status : "off";
    if (ui.tracking.status !== status || ui.tracking.problem !== this.monitor.problem) {
      this.store.set((s) => ({ tracking: { ...s.tracking, status, problem: this.monitor.problem } }));
    }
    const shouldHold = ui.screen === "game" && ui.mode === "camera" && isRoundActive(this.state) && status !== "tracking";
    if (shouldHold === this.trackingHeld) return;
    this.trackingHeld = shouldHold;
    for (const ev of setHold(this.state, "tracking", shouldHold)) this.onGameEvent(ev);
    if (shouldHold) emit("tracking_lost", { problem: this.monitor.problem });
    else emit("tracking_restored", {});
    this.publishHud();
  }

  private onGameEvent(ev: GameEvent) {
    this.renderer?.handle(ev, this.state);
    const sfx = this.sfx;
    switch (ev.type) {
      case "scoop":
        sfx.play("scoop", ev.scoops);
        break;
      case "topping":
        sfx.play("topping");
        break;
      case "topping-wasted":
        sfx.play("wasted");
        this.banner("Catch a scoop first!", "info", 1400);
        break;
      case "cherry-offered":
        sfx.play("cherry-offer");
        break;
      case "rainbow":
        sfx.play("rainbow");
        this.banner("Rainbow Sundae! +30", "rainbow", 1800);
        emit("rainbow_sundae", { bonus: this.config.points.rainbow });
        break;
      case "served":
        sfx.play("serve");
        this.banner(`Sundae served! +${ev.record.points}`, "good", 1700);
        emit("sundae_served", {
          points: ev.record.points,
          scoops: ev.record.scoops.length,
          rainbow: ev.record.rainbow,
          score: ev.banked,
          sundaes: this.state.served.length,
        });
        break;
      case "spill":
        sfx.play("bump");
        sfx.play("spill");
        setTimeout(() => sfx.play("giggle"), 560);
        this.banner(ev.spills >= this.config.maxSpills ? "Oh no, the last bowl!" : "Splat! The sundae spilled", "bad", 1500);
        emit("sundae_spilled", { spillsLeft: spillsLeft(this.state), lostScoops: ev.sundae.scoops.length });
        break;
      case "countdown":
        if (ev.value > 0) sfx.play("tick");
        else sfx.play("go");
        break;
      case "phase":
        if (ev.phase === "playing" && this.state.activeTime === 0) sfx.play("go");
        break;
      case "round-over":
        this.finishRound();
        break;
    }
    if (ev.type !== "spawn") this.publishHud();
  }

  private finishRound() {
    this.sfx.play("over");
    const score = this.state.banked;
    const prevBest = readBest();
    const best = Math.max(prevBest, score);
    if (best > prevBest) writeBest(best);
    const reason = this.state.endReason ?? "time";
    const sundaes = this.state.served.map((rec) => ({
      id: rec.id,
      points: rec.points,
      rainbow: rec.rainbow,
      caption: describeSundae(rec),
      image: sundaeThumbnail(rec, this.config),
      scoops: rec.scoops.length,
    }));
    const results = { score, best, newBest: score > prevBest && score > 0, reason, sundaes };
    this.banner(reason === "time" ? "Time's up!" : "Three spills!", reason === "time" ? "good" : "bad", RESULTS_DELAY_MS + 200);
    emit("round_over", { score, best, newBest: results.newBest, reason, sundaes: sundaes.length });
    this.resultsTimer = setTimeout(() => {
      this.resultsTimer = null;
      this.stopAdapter();
      this.store.set({ screen: "results", results, best, paused: false });
    }, RESULTS_DELAY_MS);
    this.store.set({ results, best });
  }

  private cancelResults() {
    if (this.resultsTimer) clearTimeout(this.resultsTimer);
    this.resultsTimer = null;
  }

  private banner(text: string, tone: Banner["tone"], ms: number) {
    const id = (this.store.get().banner?.id ?? 0) + 1;
    const side = this.movement.worldX > 960 ? "left" : "right";
    this.store.set({ banner: { id, text, tone, side } });
    if (this.bannerTimer) clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => {
      if (this.store.get().banner?.id === id) this.store.set({ banner: null });
    }, ms);
  }

  private publishHud() {
    const s = this.state;
    const countdown =
      s.resumeCountdown > 0
        ? s.resumeCountdown
        : s.phase === "countdown"
          ? Math.max(0, s.config.countdownSeconds - s.phaseTime)
          : 0;
    const hud: Hud = {
      banked: s.banked,
      pending: pendingValue(s),
      timeLeft: timeLeft(s),
      spills: s.spills,
      spillsLeft: spillsLeft(s),
      scoops: s.sundae.scoops.length,
      toppings: s.sundae.scoops.reduce((n, sc) => n + sc.toppings.length, 0),
      flavors: distinctFlavors(s.sundae),
      rainbow: s.sundae.rainbow,
      cherryFalling: s.items.some((it) => it.kind === "cherry" && !it.resolved),
      phase: s.phase,
      countdown: Math.ceil(countdown),
      frozen: s.holds.size > 0,
      served: s.served.length,
    };
    if (!sameHud(hud, this.store.get().hud)) this.store.set({ hud });
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function readBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

function writeBest(v: number) {
  try {
    localStorage.setItem(BEST_KEY, String(v));
  } catch {
    // Private mode: the best score just isn't kept.
  }
}

function readPrefs(): { sound: boolean; mode: Mode } {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}");
    return { sound: raw.sound !== false, mode: raw.mode === "keyboard" ? "keyboard" : "camera" };
  } catch {
    return { sound: true, mode: "camera" };
  }
}

function savePrefs(p: { sound: boolean; mode: Mode }) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    // Not fatal.
  }
}
