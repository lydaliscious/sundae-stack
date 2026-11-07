import type { GameConfig } from "@/game/config";
import { layoutStack } from "@/game/stack";
import type { Flavor, StackScoop, Topping } from "@/game/types";
import { BOWL, CHERRY, FLAVOR, INK, SAUCE, SPRINKLE_COLORS, WHIP } from "./palette";
import { circle, ellipse, fillInk, hash01, linear, radial, type Ctx } from "./shapes";

/** One ice-cream scoop: a soft dome with a scalloped, drippy skirt. */
export function drawScoop(ctx: Ctx, x: number, y: number, r: number, flavor: Flavor, seed: number, ink = r * 0.075) {
  const c = FLAVOR[flavor];
  const base = y + r * 0.22;
  const x0 = x + r * 0.99;
  const x1 = x - r * 0.99;
  const lobes = 5;

  const shape = () => {
    ctx.beginPath();
    ctx.arc(x, y, r, Math.PI * 0.94, Math.PI * 2.06);
    for (let i = 0; i < lobes; i++) {
      const xa = x0 + ((x1 - x0) * i) / lobes;
      const xb = x0 + ((x1 - x0) * (i + 1)) / lobes;
      const d = r * (0.16 + 0.2 * hash01(seed, i));
      ctx.bezierCurveTo(xa, base + d * 1.35, xb, base + d * 1.35, xb, base);
    }
    ctx.closePath();
  };

  shape();
  fillInk(
    ctx,
    radial(ctx, x - r * 0.35, y - r * 0.45, r * 0.08, x, y, r * 1.35, [
      [0, c.light],
      [0.45, c.base],
      [1, c.dark],
    ]),
    INK,
    ink,
  );

  // Flavor texture, clipped to the scoop.
  ctx.save();
  shape();
  ctx.clip();
  const bits = 9;
  for (let i = 0; i < bits; i++) {
    const a = hash01(seed, 20 + i) * Math.PI * 2;
    const d = Math.sqrt(hash01(seed, 40 + i)) * r * 0.82;
    const bx = x + Math.cos(a) * d;
    const by = y + Math.sin(a) * d * 0.8;
    if (flavor === "mint") {
      ctx.fillStyle = "#4a2a1c";
      ellipse(ctx, bx, by, r * 0.07, r * 0.045, a);
      ctx.fill();
    } else if (flavor === "strawberry") {
      ctx.fillStyle = "rgba(214, 66, 112, 0.55)";
      ellipse(ctx, bx, by, r * 0.06, r * 0.08, a);
      ctx.fill();
    } else if (flavor === "chocolate") {
      ctx.fillStyle = "rgba(255, 214, 180, 0.22)";
      ellipse(ctx, bx, by, r * 0.1, r * 0.035, a);
      ctx.fill();
    } else {
      ctx.fillStyle = "rgba(120, 80, 50, 0.35)";
      circle(ctx, bx, by, r * 0.022);
      ctx.fill();
    }
  }
  // Soft shade along the skirt.
  ctx.fillStyle = "rgba(0,0,0,0.06)";
  ellipse(ctx, x, base + r * 0.05, r * 1.05, r * 0.2);
  ctx.fill();
  ctx.restore();

  // Glossy highlight.
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ellipse(ctx, x - r * 0.38, y - r * 0.52, r * 0.24, r * 0.11, -0.55);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  circle(ctx, x - r * 0.08, y - r * 0.72, r * 0.05);
  ctx.fill();
}

/** Toppings sit on a scoop's dome: sauce first, cream on top, sprinkles over everything. */
export function drawToppings(ctx: Ctx, x: number, y: number, r: number, toppings: readonly Topping[], seed: number) {
  if (!toppings.length) return;
  const has = (t: Topping) => toppings.includes(t);
  const count = (t: Topping) => toppings.filter((v) => v === t).length;

  if (has("sauce")) {
    ctx.beginPath();
    ctx.arc(x, y, r * 1.02, Math.PI * 1.08, Math.PI * 1.92);
    const xr = x + Math.cos(Math.PI * 1.92) * r * 1.02;
    const xl = x + Math.cos(Math.PI * 1.08) * r * 1.02;
    const yb = y + Math.sin(Math.PI * 1.08) * r * 1.02;
    const drips = 4;
    for (let i = 0; i < drips; i++) {
      const xa = xr + ((xl - xr) * i) / drips;
      const xb = xr + ((xl - xr) * (i + 1)) / drips;
      const d = r * (0.12 + 0.38 * hash01(seed, 60 + i)) * Math.min(2, count("sauce"));
      const mid = (xa + xb) / 2;
      ctx.quadraticCurveTo(xa, yb + r * 0.1, mid + r * 0.06, yb + d * 0.6);
      ctx.quadraticCurveTo(mid, yb + d + r * 0.08, mid - r * 0.06, yb + d * 0.6);
      ctx.quadraticCurveTo(xb, yb + r * 0.1, xb, yb);
    }
    ctx.closePath();
    fillInk(ctx, linear(ctx, x - r, y - r, x + r, y, [[0, SAUCE.light], [1, SAUCE.base]]), INK, r * 0.05);
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ellipse(ctx, x - r * 0.3, y - r * 0.78, r * 0.2, r * 0.06, -0.3);
    ctx.fill();
  }

  if (has("whip")) {
    const wy = y - r * 0.78;
    const tiers: [number, number, number][] = [
      [0, r * 0.62, r * 0.24],
      [-r * 0.2, r * 0.46, r * 0.21],
      [-r * 0.38, r * 0.28, r * 0.17],
    ];
    for (const [dy, rx, ry] of tiers) {
      ellipse(ctx, x, wy + dy, rx, ry);
      fillInk(ctx, radial(ctx, x - rx * 0.4, wy + dy - ry * 0.5, 1, x, wy + dy, rx * 1.2, [[0, WHIP.base], [1, WHIP.shade]]), INK, r * 0.05);
    }
    ctx.beginPath();
    ctx.moveTo(x - r * 0.1, wy - r * 0.48);
    ctx.quadraticCurveTo(x + r * 0.02, wy - r * 0.78, x + r * 0.16, wy - r * 0.62);
    ctx.quadraticCurveTo(x + r * 0.08, wy - r * 0.5, x - r * 0.1, wy - r * 0.48);
    fillInk(ctx, WHIP.base, INK, r * 0.045);
  }

  if (has("sprinkles")) {
    const n = 9 + 4 * Math.min(2, count("sprinkles") - 1);
    const lift = has("whip") ? r * 0.35 : 0;
    ctx.lineCap = "round";
    for (let i = 0; i < n; i++) {
      const a = Math.PI * (1.12 + 0.76 * hash01(seed, 80 + i));
      const d = r * (0.35 + 0.5 * hash01(seed, 100 + i));
      const sx = x + Math.cos(a) * d * (has("whip") ? 0.7 : 1);
      const sy = y + Math.sin(a) * d * 0.85 - lift;
      const rot = hash01(seed, 120 + i) * Math.PI;
      const len = r * 0.09;
      ctx.strokeStyle = SPRINKLE_COLORS[i % SPRINKLE_COLORS.length];
      ctx.lineWidth = r * 0.07;
      ctx.beginPath();
      ctx.moveTo(sx - Math.cos(rot) * len, sy - Math.sin(rot) * len);
      ctx.lineTo(sx + Math.cos(rot) * len, sy + Math.sin(rot) * len);
      ctx.stroke();
    }
  }
}

export function drawCherry(ctx: Ctx, x: number, y: number, r: number, sway = 0) {
  // Stem and leaf first, so the fruit sits in front of them.
  ctx.lineCap = "round";
  ctx.strokeStyle = INK;
  ctx.lineWidth = r * 0.26;
  const sx = x + r * 0.05;
  const sy = y - r * 0.7;
  const tx = x + r * (0.55 + sway * 0.2);
  const ty = y - r * 1.75;
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.quadraticCurveTo(x - r * 0.05, y - r * 1.35, tx, ty);
  ctx.stroke();
  ctx.strokeStyle = CHERRY.stem;
  ctx.lineWidth = r * 0.14;
  ctx.stroke();
  ellipse(ctx, tx + r * 0.38, ty + r * 0.08, r * 0.42, r * 0.2, 0.45);
  fillInk(ctx, CHERRY.leaf, INK, r * 0.08);
  ctx.strokeStyle = "rgba(60,110,40,0.6)";
  ctx.lineWidth = r * 0.05;
  ctx.beginPath();
  ctx.moveTo(tx + 2, ty);
  ctx.lineTo(tx + r * 0.7, ty + r * 0.22);
  ctx.stroke();

  circle(ctx, x, y, r);
  fillInk(
    ctx,
    radial(ctx, x - r * 0.35, y - r * 0.4, r * 0.05, x, y, r * 1.1, [
      [0, CHERRY.light],
      [0.5, CHERRY.base],
      [1, CHERRY.dark],
    ]),
    INK,
    r * 0.11,
  );
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ellipse(ctx, x - r * 0.38, y - r * 0.38, r * 0.22, r * 0.13, -0.7);
  ctx.fill();
  // The little dimple where the stem meets the fruit.
  ctx.strokeStyle = "rgba(120, 10, 30, 0.6)";
  ctx.lineWidth = r * 0.08;
  ctx.beginPath();
  ctx.arc(sx, sy + r * 0.05, r * 0.16, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();
}

export const BOWL_GEOM = { halfWidth: 120, rimRy: 21, depth: 76, bottomHalf: 54, footHalf: 46, footDepth: 16 } as const;

function bowlBodyPath(ctx: Ctx, x: number, rimY: number) {
  const g = BOWL_GEOM;
  ctx.beginPath();
  ctx.moveTo(x - g.halfWidth, rimY);
  ctx.bezierCurveTo(x - g.halfWidth, rimY + g.depth * 0.7, x - g.bottomHalf - 20, rimY + g.depth, x - g.bottomHalf, rimY + g.depth);
  ctx.lineTo(x + g.bottomHalf, rimY + g.depth);
  ctx.bezierCurveTo(x + g.bottomHalf + 20, rimY + g.depth, x + g.halfWidth, rimY + g.depth * 0.7, x + g.halfWidth, rimY);
  ctx.ellipse(x, rimY, g.halfWidth, g.rimRy, 0, 0, Math.PI, false);
  ctx.closePath();
}

/** The inside back of the bowl, drawn before the scoops. */
export function drawBowlBack(ctx: Ctx, x: number, rimY: number) {
  const g = BOWL_GEOM;
  ellipse(ctx, x, rimY, g.halfWidth, g.rimRy);
  fillInk(ctx, linear(ctx, x, rimY - g.rimRy, x, rimY + g.rimRy, [[0, BOWL.glassDark], [1, BOWL.glass]]), INK, 6);
}

/** The bowl's front, drawn over the bottom of the first scoop. */
export function drawBowlFront(ctx: Ctx, x: number, rimY: number) {
  const g = BOWL_GEOM;
  // Foot.
  ellipse(ctx, x, rimY + g.depth + g.footDepth * 0.6, g.footHalf, g.footDepth * 0.7);
  fillInk(ctx, BOWL.bandDark, INK, 5);

  bowlBodyPath(ctx, x, rimY);
  fillInk(
    ctx,
    linear(ctx, x - g.halfWidth, rimY, x + g.halfWidth, rimY, [
      [0, BOWL.glassDark],
      [0.3, BOWL.glassLight],
      [0.7, BOWL.glass],
      [1, BOWL.glassDark],
    ]),
    INK,
    0,
  );
  ctx.save();
  bowlBodyPath(ctx, x, rimY);
  ctx.clip();
  // A pastel band with polka dots, following the rim's curve.
  ctx.strokeStyle = BOWL.band;
  ctx.lineWidth = 22;
  ctx.beginPath();
  ctx.ellipse(x, rimY + 20, g.halfWidth + 4, g.rimRy + 4, 0, 0, Math.PI);
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  for (let i = 0; i < 7; i++) {
    const a = (Math.PI * (i + 0.5)) / 7;
    circle(ctx, x + Math.cos(a) * (g.halfWidth + 2), rimY + 20 + Math.sin(a) * (g.rimRy + 2), 4.5);
    ctx.fill();
  }
  // Glassy highlight.
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ellipse(ctx, x - g.halfWidth * 0.55, rimY + g.depth * 0.55, 9, 24, 0.35);
  ctx.fill();
  ctx.restore();
  bowlBodyPath(ctx, x, rimY);
  ctx.lineWidth = 6;
  ctx.strokeStyle = INK;
  ctx.stroke();
  // Rim lip.
  ctx.beginPath();
  ctx.ellipse(x, rimY, g.halfWidth, g.rimRy, 0, 0, Math.PI * 2);
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(x, rimY + 1, g.halfWidth - 8, g.rimRy - 5, 0, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();
}

export interface StackDrawOptions {
  /** Horizontal sway at the top of the stack (px), for a soft wobble. */
  sway?: number;
  cherry?: boolean;
  /** Extra scale pop on the top scoop when it has just landed (0..1). */
  landPop?: number;
}

/** Scoops (bottom first) with their toppings, laid out exactly as the simulation sees them. */
export function drawStack(ctx: Ctx, x: number, rimY: number, scoops: readonly StackScoop[], config: GameConfig, opts: StackDrawOptions = {}) {
  const layout = layoutStack(scoops, config);
  const dy = rimY - config.toddler.rimY;
  const r = config.stack.scoopRadius;
  const n = scoops.length;
  const sway = opts.sway ?? 0;
  const offsetAt = (i: number) => (n ? sway * Math.pow((i + 1) / n, 1.6) : 0);
  for (let i = 0; i < n; i++) {
    const sx = x + offsetAt(i);
    const sy = layout.scoopY[i] + dy;
    const pop = i === n - 1 ? (opts.landPop ?? 0) : 0;
    const rr = r * (1 + pop * 0.12);
    drawScoop(ctx, sx, sy, rr, scoops[i].flavor, i * 7.31 + 1.7);
    drawToppings(ctx, sx, sy, rr, scoops[i].toppings, i * 3.17 + 0.4);
  }
  if (opts.cherry && n) {
    const top = scoops[n - 1];
    const cy = layout.surfaceY + dy - 26 + (top.toppings.includes("whip") ? -6 : 0);
    drawCherry(ctx, x + offsetAt(n - 1), cy, 27);
  }
  return layout;
}

/** A whole sundae in its bowl (counter minis and results thumbnails). */
export function drawSundaeRecord(ctx: Ctx, x: number, rimY: number, scoops: readonly StackScoop[], config: GameConfig, cherry = true) {
  drawBowlBack(ctx, x, rimY);
  drawStack(ctx, x, rimY, scoops, config, { cherry });
  drawBowlFront(ctx, x, rimY);
}

/** Height of a full sundae above its rim, for fitting thumbnails. */
export function sundaeExtent(scoops: readonly StackScoop[], config: GameConfig) {
  const layout = layoutStack(scoops, config);
  return { above: layout.height + 80, below: BOWL_GEOM.depth + BOWL_GEOM.footDepth + 8 };
}
