import type { FallingItem, Flavor, Topping, Toy } from "@/game/types";
import { INK, SAUCE, SPRINKLE_COLORS, TOY_COLORS, WHIP } from "./palette";
import { circle, ellipse, fillInk, font, hash01, linear, radial, roundRect, type Ctx } from "./shapes";
import { drawCherry, drawScoop } from "./sundae";

/** Draws one falling item centred at (x, y). `t` is the animation clock (seconds). */
export function drawFallingItem(ctx: Ctx, item: FallingItem, x: number, y: number, t: number) {
  const r = item.radius;
  const wobble = Math.sin(t * 3 + item.spin * 10) * 0.08;
  // A soft halo keeps every item readable against the parlor.
  ctx.fillStyle = item.kind === "toy" ? "rgba(255, 90, 110, 0.16)" : "rgba(255, 255, 255, 0.55)";
  circle(ctx, x, y, r * 1.22);
  ctx.fill();

  ctx.save();
  ctx.translate(x, y);
  switch (item.kind) {
    case "scoop":
      ctx.rotate(wobble);
      drawScoop(ctx, 0, 4, r, item.variant as Flavor, item.spin * 100);
      break;
    case "topping":
      ctx.rotate(wobble);
      drawToppingIcon(ctx, item.variant as Topping, r, item.spin);
      break;
    case "cherry": {
      const pulse = 0.5 + 0.5 * Math.sin(t * 6);
      ctx.fillStyle = `rgba(255, 70, 100, ${0.12 + pulse * 0.14})`;
      circle(ctx, 0, 0, r * (1.45 + pulse * 0.15));
      ctx.fill();
      ctx.rotate(wobble * 0.6);
      drawCherry(ctx, 0, r * 0.25, r * 0.85, Math.sin(t * 4));
      break;
    }
    case "toy":
      drawToy(ctx, item.variant as Toy, r, item.spin, t);
      break;
  }
  ctx.restore();
}

export function drawToppingIcon(ctx: Ctx, topping: Topping, r: number, seed: number) {
  if (topping === "sprinkles") {
    // A little shaker full of rainbow sprinkles.
    const w = r * 1.15;
    const h = r * 1.35;
    roundRect(ctx, -w / 2, -h * 0.32, w, h * 0.92, r * 0.24);
    fillInk(ctx, linear(ctx, -w / 2, 0, w / 2, 0, [[0, "#e7f6ff"], [0.4, "#ffffff"], [1, "#cde9fb"]]), INK, r * 0.09);
    ctx.save();
    roundRect(ctx, -w / 2 + 5, -h * 0.12, w - 10, h * 0.66, r * 0.18);
    ctx.clip();
    ctx.lineCap = "round";
    ctx.lineWidth = r * 0.1;
    for (let i = 0; i < 18; i++) {
      const sx = (hash01(seed, i) - 0.5) * w * 0.85;
      const sy = -h * 0.08 + hash01(seed, 30 + i) * h * 0.62;
      const a = hash01(seed, 60 + i) * Math.PI;
      ctx.strokeStyle = SPRINKLE_COLORS[i % SPRINKLE_COLORS.length];
      ctx.beginPath();
      ctx.moveTo(sx - Math.cos(a) * r * 0.08, sy - Math.sin(a) * r * 0.08);
      ctx.lineTo(sx + Math.cos(a) * r * 0.08, sy + Math.sin(a) * r * 0.08);
      ctx.stroke();
    }
    ctx.restore();
    // Pink lid with holes.
    roundRect(ctx, -w * 0.55, -h * 0.62, w * 1.1, h * 0.34, r * 0.16);
    fillInk(ctx, linear(ctx, 0, -h * 0.62, 0, -h * 0.28, [[0, "#ffc1d4"], [1, "#ff8fb1"]]), INK, r * 0.09);
    ctx.fillStyle = INK;
    for (let i = -1; i <= 1; i++) {
      circle(ctx, i * w * 0.26, -h * 0.47, r * 0.055);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    roundRect(ctx, -w * 0.38, -h * 0.05, w * 0.1, h * 0.4, 4);
    ctx.fill();
    return;
  }
  if (topping === "sauce") {
    // A big glossy drop of chocolate sauce.
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.05);
    ctx.bezierCurveTo(r * 0.25, -r * 0.55, r * 0.85, -r * 0.05, r * 0.82, r * 0.32);
    ctx.bezierCurveTo(r * 0.8, r * 0.8, r * 0.38, r * 1.0, 0, r * 1.0);
    ctx.bezierCurveTo(-r * 0.38, r * 1.0, -r * 0.8, r * 0.8, -r * 0.82, r * 0.32);
    ctx.bezierCurveTo(-r * 0.85, -r * 0.05, -r * 0.25, -r * 0.55, 0, -r * 1.05);
    ctx.closePath();
    fillInk(ctx, radial(ctx, -r * 0.3, 0, r * 0.05, 0, r * 0.2, r * 1.1, [[0, SAUCE.light], [1, SAUCE.base]]), INK, r * 0.09);
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ellipse(ctx, -r * 0.32, r * 0.2, r * 0.13, r * 0.28, 0.2);
    ctx.fill();
    circle(ctx, -r * 0.18, -r * 0.3, r * 0.07);
    ctx.fill();
    return;
  }
  // Whipped cream dollop.
  const tiers: [number, number, number][] = [
    [r * 0.5, r * 0.95, r * 0.36],
    [r * 0.1, r * 0.72, r * 0.32],
    [-r * 0.28, r * 0.46, r * 0.26],
  ];
  for (const [dy, rx, ry] of tiers) {
    ellipse(ctx, 0, dy, rx, ry);
    fillInk(ctx, radial(ctx, -rx * 0.4, dy - ry * 0.6, 1, 0, dy, rx * 1.2, [[0, WHIP.base], [1, WHIP.shade]]), INK, r * 0.08);
  }
  ctx.beginPath();
  ctx.moveTo(-r * 0.18, -r * 0.48);
  ctx.quadraticCurveTo(0, -r * 1.0, r * 0.26, -r * 0.8);
  ctx.quadraticCurveTo(r * 0.12, -r * 0.55, -r * 0.18, -r * 0.48);
  fillInk(ctx, WHIP.base, INK, r * 0.07);
}

function drawToy(ctx: Ctx, toy: Toy, r: number, seed: number, t: number) {
  // A rotating dashed ring says "dodge me" without being scary.
  ctx.save();
  ctx.rotate(t * 1.5);
  ctx.setLineDash([r * 0.32, r * 0.22]);
  ctx.lineWidth = r * 0.08;
  ctx.strokeStyle = "rgba(240, 70, 90, 0.75)";
  circle(ctx, 0, 0, r * 1.18);
  ctx.stroke();
  ctx.restore();

  const color = TOY_COLORS[Math.floor(seed * TOY_COLORS.length) % TOY_COLORS.length];
  if (toy === "block") {
    ctx.rotate(Math.sin(t * 2 + seed * 6) * 0.25 + seed);
    const s = r * 1.5;
    roundRect(ctx, -s / 2, -s / 2, s, s, r * 0.24);
    fillInk(ctx, color, INK, r * 0.1);
    roundRect(ctx, -s / 2 + r * 0.14, -s / 2 + r * 0.14, s - r * 0.28, s - r * 0.28, r * 0.16);
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = INK;
    ctx.lineWidth = r * 0.07;
    ctx.font = font(700, r);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const letter = "ABC"[Math.floor(seed * 3) % 3];
    ctx.strokeText(letter, 0, r * 0.06);
    ctx.fillText(letter, 0, r * 0.06);
    return;
  }
  // Rubber ball with stripes and a star.
  ctx.rotate(t * 2.4 + seed * 6);
  circle(ctx, 0, 0, r);
  fillInk(ctx, color, INK, r * 0.1);
  ctx.save();
  circle(ctx, 0, 0, r);
  ctx.clip();
  ctx.fillStyle = TOY_COLORS[(Math.floor(seed * TOY_COLORS.length) + 2) % TOY_COLORS.length];
  ctx.fillRect(-r, -r * 0.22, r * 2, r * 0.44);
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fillRect(-r, -r * 0.22, r * 2, r * 0.07);
  ctx.fillRect(-r, r * 0.15, r * 2, r * 0.07);
  ctx.restore();
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ellipse(ctx, -r * 0.4, -r * 0.45, r * 0.22, r * 0.12, -0.6);
  ctx.fill();
  circle(ctx, 0, 0, r);
  ctx.lineWidth = r * 0.1;
  ctx.strokeStyle = INK;
  ctx.stroke();
}