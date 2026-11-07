import { WORLD } from "@/game/config";
import { layoutStack } from "@/game/stack";
import type { FallingItem, GameEvent, GameState, StackScoop, SundaeRecord } from "@/game/types";
import { drawFallingItem } from "./items";
import { Effects } from "./effects";
import { COUNTER_TOP_Y, paintParlor } from "./parlor";
import { clamp01, easeInOut, easeOut, lerp, type Ctx } from "./shapes";
import { drawBowlBack, drawBowlFront, drawStack, drawSundaeRecord } from "./sundae";
import {
  drawToddlerArmsAndHead,
  drawToddlerBody,
  drawToddlerHands,
  headCenter,
  type Expression,
  type ToddlerPose,
} from "./toddler";

export type Scene = "menu" | "calibrate" | "game" | "results";

export interface FrameInfo {
  scene: Scene;
  /** Bowl x for this frame (world px). */
  playerX: number;
  /** Real seconds since the last frame (0 while frozen). */
  dt: number;
  /** Interpolation between the last two simulation steps. */
  alpha: number;
}

const SPILL = { surprised: 0.34, blinkEnd: 0.52, tiltPeak: 0.28, tiltBack: 0.95, giggleTail: 0.7 };
const SERVE = { hold: 0.55, fly: 1.35, settle: 1.65 };
const MAX_TUMBLERS = 8;

/**
 * Draws the game on a 1920×1080 canvas. All gameplay facts come from `GameState`; this class only
 * keeps cosmetic animation state (walk cycle, wobble, particles, the spill and serve timelines),
 * advanced with a clock that stops whenever the game is frozen.
 */
export class Renderer {
  private ctx: Ctx;
  private parlor: HTMLCanvasElement;
  private effects: Effects;
  private clock = 0;
  private rand = mulberry(12345);

  private lastX: number | null = null;
  private vel = 0;
  private walk = 0;
  private walkPhase = 0;
  private sway = 0;
  private swayV = 0;
  private look = { x: 0, y: -0.4 };
  private blinkAt = 2;
  private landAt = -10;
  private rainbowAt = -10;
  private wastedAt = -10;

  private spill: { at: number; x: number; dir: number; toy: FallingItem } | null = null;
  private speckleReveal = new Map<number, number>();
  private serve: { at: number; record: SundaeRecord; slot: number } | null = null;
  private bowlPopAt = -10;

  constructor(canvas: HTMLCanvasElement) {
    canvas.width = WORLD.width;
    canvas.height = WORLD.height;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Canvas 2D is not available.");
    this.ctx = ctx;
    this.parlor = document.createElement("canvas");
    this.parlor.width = WORLD.width;
    this.parlor.height = WORLD.height;
    paintParlor(this.parlor.getContext("2d")!);
    this.effects = new Effects(1012);
  }

  /** A new round: forget every cosmetic leftover. */
  reset() {
    this.effects.clear();
    this.spill = null;
    this.serve = null;
    this.speckleReveal.clear();
    this.sway = this.swayV = 0;
    this.landAt = this.rainbowAt = this.wastedAt = -10;
  }

  handle(ev: GameEvent, state: GameState) {
    const t = this.clock;
    const cfg = state.config;
    switch (ev.type) {
      case "scoop":
        this.landAt = t;
        this.effects.splash(ev.x, ev.y, [ev.flavor], 5, this.rand, 0.45);
        this.effects.text(`+${cfg.points.scoop}`, ev.x + 120, ev.y - 30, "#ff5f8f");
        break;
      case "topping":
        this.landAt = t;
        this.effects.sparkle(ev.x, ev.y - 20, 8, this.rand);
        this.effects.text(`+${cfg.points.topping}`, ev.x + 120, ev.y - 30, "#a66cff");
        break;
      case "topping-wasted":
        this.wastedAt = t;
        this.effects.sparkle(ev.x, ev.y, 5, this.rand, ["#e8e0e0", "#ffffff"]);
        this.effects.text("Scoop first!", ev.x, ev.y - 60, "#9b8a8f", 44);
        break;
      case "rainbow":
        this.rainbowAt = t;
        this.effects.sparkle(ev.x, ev.y - 30, 26, this.rand, ["#ff6f91", "#ffc75f", "#57c7ff", "#8be08b", "#b388ff"]);
        break;
      case "served": {
        this.serve = { at: t, record: ev.record, slot: ev.record.id - 1 };
        const top = layoutStack(ev.record.scoops, cfg).surfaceY;
        this.effects.confetti(ev.x, top - 20, 46, this.rand);
        this.effects.sparkle(ev.x, top - 40, 16, this.rand);
        this.effects.text(`+${ev.record.points}`, ev.x, top - 90, "#ff4f7d", 72, 1.4);
        break;
      }
      case "spill": {
        const dir = ev.toy.x >= ev.x ? -1 : 1;
        this.spill = { at: t, x: ev.x, dir, toy: { ...ev.toy } };
        const layout = layoutStack(ev.sundae.scoops, cfg);
        const scoops = ev.sundae.scoops.slice(-MAX_TUMBLERS);
        const offset = ev.sundae.scoops.length - scoops.length;
        scoops.forEach((sc, i) => this.effects.tumble(ev.x, layout.scoopY[offset + i], cfg.stack.scoopRadius * 0.9, sc.flavor, dir, i, this.rand));
        this.effects.splash(ev.x, cfg.toddler.rimY - 10, ev.sundae.scoops.map((s) => s.flavor), 26, this.rand);
        ev.speckles.forEach((sp, i) => this.speckleReveal.set(sp.id, t + 0.3 + i * 0.07));
        break;
      }
      case "phase":
        if (ev.phase === "playing" && this.serve) this.bowlPopAt = this.serve.at + SERVE.fly;
        break;
    }
  }

  draw(state: GameState | null, frame: FrameInfo) {
    const ctx = this.ctx;
    const dt = Math.min(frame.dt, 0.1);
    this.clock += dt;
    const t = this.clock;
    const cfg = state?.config;

    this.updateMotion(frame.playerX, dt);
    this.effects.update(dt);

    ctx.drawImage(this.parlor, 0, 0);

    // Served sundaes wait on the counter.
    if (state && cfg) {
      const flying = this.serve && t - this.serve.at < SERVE.fly ? this.serve.record.id : -1;
      for (const rec of state.served) {
        if (rec.id === flying) continue;
        const { x, y } = counterSlot(rec.id - 1);
        this.drawMini(ctx, x, y, rec.scoops, 0.4);
      }
    }
    this.effects.drawBehind(ctx);

    const scene = frame.scene;
    const toddlerX = frame.playerX;
    const rimY = cfg?.toddler.rimY ?? 580;
    const feetY = cfg?.toddler.feetY ?? 1036;
    const spillT = this.spill ? t - this.spill.at : 99;
    const serveT = this.serve ? t - this.serve.at : 99;

    // Bowl tilt and jolt during a spill.
    let tilt = 0;
    let jolt = 0;
    if (this.spill && spillT < SPILL.tiltBack + 0.25) {
      const d = this.spill.dir;
      if (spillT < SPILL.tiltPeak) tilt = d * 0.7 * easeOut(spillT / SPILL.tiltPeak);
      else if (spillT < SPILL.tiltBack) tilt = d * 0.7;
      else tilt = d * 0.7 * (1 - easeInOut(clamp01((spillT - SPILL.tiltBack) / 0.25)));
      if (spillT < 0.18) jolt = Math.sin(spillT * 90) * 10 * (1 - spillT / 0.18);
    }

    const pose = this.pose(state, scene, toddlerX + jolt, rimY, feetY, spillT, serveT);
    drawToddlerBody(ctx, pose);
    drawToddlerArmsAndHead(ctx, pose);

    // Bowl + stack.
    const bowlPop = t - this.bowlPopAt < 0.35 ? Math.sin(((t - this.bowlPopAt) / 0.35) * Math.PI) * 0.12 : 0;
    ctx.save();
    ctx.translate(toddlerX + jolt, rimY + 70);
    ctx.rotate(tilt);
    ctx.scale(1 + bowlPop, 1 + bowlPop);
    ctx.translate(-(toddlerX + jolt), -(rimY + 70));
    drawBowlBack(ctx, toddlerX + jolt, rimY);
    if (state && cfg) {
      let scoops: readonly StackScoop[] = state.sundae.scoops;
      let cherry = false;
      if (this.serve && serveT < SERVE.hold) {
        scoops = this.serve.record.scoops;
        cherry = true;
      } else if (scene === "menu") {
        scoops = MENU_SUNDAE;
        cherry = true;
      } else if (scene === "results") {
        scoops = [];
      }
      const landPop = Math.max(0, 1 - (t - this.landAt) / 0.22);
      drawStack(ctx, toddlerX + jolt, rimY, scoops, cfg, { sway: this.sway, cherry, landPop });
    }
    drawBowlFront(ctx, toddlerX + jolt, rimY);
    ctx.restore();
    drawToddlerHands(ctx, { ...pose, x: toddlerX + jolt });

    // The served sundae flies to its spot on the counter.
    if (this.serve && cfg && serveT >= SERVE.hold && serveT < SERVE.fly) {
      const k = easeInOut((serveT - SERVE.hold) / (SERVE.fly - SERVE.hold));
      const to = counterSlot(this.serve.slot);
      const fromX = toddlerX;
      const x = lerp(fromX, to.x, k);
      const y = lerp(rimY, to.y, k) - Math.sin(k * Math.PI) * 160;
      this.drawMini(ctx, x, y, this.serve.record.scoops, lerp(1, 0.4, k));
    }

    // Falling items.
    if (state && scene === "game") {
      for (const it of state.items) {
        const y = lerp(it.prevY, it.y, frame.alpha);
        drawFallingItem(ctx, it, it.x, y, t);
      }
    }

    // The toy that caused a spill bounces away.
    if (this.spill && spillT < 1.2) {
      const toy = this.spill.toy;
      const k = spillT;
      const x = toy.x - this.spill.dir * 520 * k;
      const y = toy.y - 520 * k + 1500 * k * k;
      ctx.save();
      ctx.globalAlpha = clamp01(1.4 - k);
      drawFallingItem(ctx, { ...toy, spin: toy.spin + k }, x, y, t * 3);
      ctx.restore();
    }

    this.effects.draw(ctx);
  }

  private drawMini(ctx: Ctx, x: number, baseY: number, scoops: readonly StackScoop[], scale: number) {
    if (!this.miniConfig) return;
    ctx.save();
    ctx.translate(x, baseY);
    ctx.scale(scale, scale);
    // Rim sits so the bowl's foot rests on baseY.
    drawSundaeRecord(ctx, 0, -100, scoops, this.miniConfig, true);
    ctx.restore();
  }

  /** Mini sundaes need a config for their layout; set by the runner. */
  miniConfig: GameState["config"] | null = null;

  private updateMotion(x: number, dt: number) {
    if (dt <= 0) return;
    if (this.lastX === null) this.lastX = x;
    const v = (x - this.lastX) / dt;
    this.lastX = x;
    this.vel = lerp(this.vel, v, 1 - Math.exp(-dt / 0.08));
    const speed = Math.abs(this.vel);
    this.walk = lerp(this.walk, clamp01(speed / 500), 1 - Math.exp(-dt / 0.1));
    this.walkPhase += dt * (speed > 40 ? 9 + speed / 120 : 0);
    if (speed <= 40) this.walkPhase = lerp(this.walkPhase, Math.round(this.walkPhase / Math.PI) * Math.PI, 1 - Math.exp(-dt / 0.08));
    // A soft spring makes the stack wobble when the toddler starts or stops (cosmetic only).
    const target = Math.max(-28, Math.min(28, -this.vel * 0.02));
    const acc = -140 * (this.sway - target) - 10 * this.swayV;
    this.swayV += acc * dt;
    this.sway += this.swayV * dt;
  }

  private pose(state: GameState | null, scene: Scene, x: number, rimY: number, feetY: number, spillT: number, serveT: number): ToddlerPose {
    const t = this.clock;
    const head = headCenter({ x, feetY, bounce: 0, lean: 0, time: t } as ToddlerPose);

    // Eyes follow the most relevant falling item.
    let lookTarget = { x: 0, y: -0.55 };
    let toyNear = false;
    if (state && scene === "game") {
      const surface = layoutStack(state.sundae.scoops, state.config).surfaceY;
      let best: FallingItem | null = null;
      for (const it of state.items) {
        if (it.resolved || it.y > surface) continue;
        if (it.kind === "toy") {
          if (surface - it.y < 330 && Math.abs(it.x - x) < 170) toyNear = true;
          continue;
        }
        if (!best || it.y > best.y) best = it;
      }
      if (best) {
        const dx = (best.x - head.x) / 420;
        const dy = (best.y - head.y) / 420;
        const m = Math.max(1, Math.hypot(dx, dy));
        lookTarget = { x: dx / m, y: dy / m };
      }
    } else if (scene === "menu" || scene === "results") {
      lookTarget = { x: Math.sin(t * 0.7) * 0.5, y: -0.1 };
    }
    const k = 1 - Math.exp(-Math.min(0.05, 1 / 60) / 0.09);
    this.look.x = lerp(this.look.x, lookTarget.x, k);
    this.look.y = lerp(this.look.y, lookTarget.y, k);

    // Blinks.
    if (t > this.blinkAt + 0.16) this.blinkAt = t + 2.2 + this.rand() * 3;
    let blink = t >= this.blinkAt ? Math.sin(((t - this.blinkAt) / 0.16) * Math.PI) : 0;

    const scoops = state?.sundae.scoops.length ?? 0;
    let expression: Expression = scoops >= 6 ? "excited" : scoops >= 3 ? "happy" : "mischief";
    let bounce = 0;
    let headTilt = Math.sin(t * 1.3) * 0.03;
    if (scoops >= 6) bounce = -Math.abs(Math.sin(t * 7)) * 5;
    if (toyNear) expression = "worried";
    if (t - this.rainbowAt < 1.1) {
      expression = "excited";
      bounce = -Math.abs(Math.sin(t * 12)) * 9;
    }
    if (t - this.wastedAt < 0.5) expression = "surprised";
    if (scene === "menu") expression = Math.sin(t * 0.5) > 0.3 ? "happy" : "mischief";

    if (serveT < SERVE.settle) {
      expression = "proud";
      headTilt = -0.08 + Math.sin(serveT * 8) * 0.03;
      bounce = serveT < 0.6 ? -Math.abs(Math.sin(serveT * 10)) * 12 : 0;
    }
    if (spillT < this.spillDuration(state) + SPILL.giggleTail) {
      if (spillT < SPILL.surprised) {
        expression = "surprised";
        blink = 0;
        bounce = -Math.sin(clamp01(spillT / SPILL.surprised) * Math.PI) * 14;
      } else if (spillT < SPILL.blinkEnd) {
        expression = "surprised";
        blink = Math.sin(((spillT - SPILL.surprised) / (SPILL.blinkEnd - SPILL.surprised)) * Math.PI);
      } else {
        expression = "giggle";
        headTilt = Math.sin(spillT * 18) * 0.07;
        bounce = -Math.abs(Math.sin(spillT * 16)) * 5;
      }
    }
    if (scene === "results" && state) {
      expression = state.endReason === "spills" ? "giggle" : "proud";
      headTilt = Math.sin(t * 6) * 0.04;
    }

    const speckles = (state?.speckles ?? []).map((sp) => {
      const at = this.speckleReveal.get(sp.id);
      const scale = at === undefined ? 1 : clamp01((t - at) / 0.12);
      return { speckle: sp, scale: scale > 0 ? Math.min(1.25, scale * 1.25) - (scale >= 1 ? 0.25 : 0) : 0 };
    });

    return {
      x,
      feetY,
      rimY,
      walkPhase: this.walkPhase,
      walk: this.walk,
      lean: Math.max(-0.07, Math.min(0.07, this.vel / 9000)),
      bounce,
      look: this.look,
      expression,
      blink,
      headTilt,
      speckles,
      time: t,
    };
  }

  private spillDuration(state: GameState | null) {
    return state?.config.spillSeconds ?? 1.15;
  }
}

const MENU_SUNDAE: StackScoop[] = [
  { flavor: "strawberry", toppings: ["sauce"] },
  { flavor: "mint", toppings: ["whip", "sprinkles"] },
];

/** Where the n-th served sundae sits on the back counter. */
export function counterSlot(n: number) {
  const slots = 13;
  const i = n % slots;
  return { x: 130 + i * 138, y: COUNTER_TOP_Y + 4 };
}

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
