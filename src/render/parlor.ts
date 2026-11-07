import { WORLD } from "@/game/config";
import { FLAVOR } from "./palette";
import { circle, ellipse, linear, radial, roundRect, type Ctx } from "./shapes";

export const COUNTER_TOP_Y = 846;
const FLOOR_Y = 968;

/**
 * The ice-cream parlor, painted once into an offscreen canvas. It stays soft and low-contrast
 * (pale stripes, gentle shapes in the margins) so falling items are always easy to pick out.
 */
export function paintParlor(ctx: Ctx) {
  const { width: W, height: H } = WORLD;

  ctx.fillStyle = linear(ctx, 0, 0, 0, H, [[0, "#fff6ec"], [0.7, "#ffeede"], [1, "#ffe6d6"]]);
  ctx.fillRect(0, 0, W, H);

  // Wide mint stripes.
  for (let x = -40; x < W; x += 160) {
    ctx.fillStyle = "rgba(186, 236, 214, 0.32)";
    ctx.fillRect(x, 0, 80, COUNTER_TOP_Y);
  }

  // Wainscot.
  ctx.fillStyle = linear(ctx, 0, 690, 0, COUNTER_TOP_Y, [[0, "#ffe0e8"], [1, "#ffd2de"]]);
  ctx.fillRect(0, 700, W, COUNTER_TOP_Y - 700);
  ctx.fillStyle = "#ffc4d4";
  ctx.fillRect(0, 692, W, 10);

  // Hanging pendant lamps with a warm glow (top band, behind the HUD).
  for (const x of [380, 960, 1540]) {
    ctx.fillStyle = radial(ctx, x, 200, 10, x, 210, 220, [[0, "rgba(255, 236, 170, 0.45)"], [1, "rgba(255, 236, 170, 0)"]]);
    circle(ctx, x, 210, 220);
    ctx.fill();
    ctx.strokeStyle = "rgba(140, 100, 100, 0.35)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, 70);
    ctx.lineTo(x, 160);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 46, 196);
    ctx.quadraticCurveTo(x - 40, 150, x, 150);
    ctx.quadraticCurveTo(x + 40, 150, x + 46, 196);
    ctx.closePath();
    ctx.fillStyle = "rgba(255, 178, 200, 0.7)";
    ctx.fill();
    ctx.fillStyle = "rgba(255, 246, 200, 0.85)";
    ellipse(ctx, x, 198, 24, 9);
    ctx.fill();
  }

  // Left margin: a soft ice-cream-cone sign.
  paintConeSign(ctx, 112, 430);
  // Right margin: a little flavor board.
  paintFlavorBoard(ctx, 1808, 420);

  // Striped awning across the top with a scalloped edge.
  const stripeW = 96;
  for (let i = 0; i * stripeW < W; i++) {
    ctx.fillStyle = i % 2 ? "#fff8f2" : "#ffb3c8";
    ctx.fillRect(i * stripeW, 0, stripeW, 70);
    ctx.beginPath();
    ctx.arc(i * stripeW + stripeW / 2, 70, stripeW / 2, 0, Math.PI);
    ctx.fill();
  }
  ctx.fillStyle = "rgba(160, 80, 100, 0.12)";
  ctx.fillRect(0, 0, W, 8);

  // Back counter.
  ctx.fillStyle = linear(ctx, 0, COUNTER_TOP_Y, 0, FLOOR_Y, [[0, "#c6efdc"], [1, "#a9e2c9"]]);
  ctx.fillRect(0, COUNTER_TOP_Y, W, FLOOR_Y - COUNTER_TOP_Y);
  for (let x = 40; x < W; x += 120) {
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    roundRect(ctx, x, COUNTER_TOP_Y + 34, 80, FLOOR_Y - COUNTER_TOP_Y - 54, 16);
    ctx.fill();
  }
  ctx.fillStyle = linear(ctx, 0, COUNTER_TOP_Y - 14, 0, COUNTER_TOP_Y + 16, [[0, "#ffffff"], [1, "#ffe3ea"]]);
  roundRect(ctx, -10, COUNTER_TOP_Y - 14, W + 20, 30, 12);
  ctx.fill();
  ctx.fillStyle = "rgba(160, 90, 110, 0.15)";
  ctx.fillRect(0, COUNTER_TOP_Y + 14, W, 6);

  // Checkered floor.
  const tile = 60;
  for (let y = FLOOR_Y; y < H; y += tile) {
    for (let x = 0; x < W; x += tile) {
      ctx.fillStyle = (x / tile + (y - FLOOR_Y) / tile) % 2 ? "#ffe2ea" : "#fff7f1";
      ctx.fillRect(x, y, tile, tile);
    }
  }
  ctx.fillStyle = "rgba(120, 70, 80, 0.12)";
  ctx.fillRect(0, FLOOR_Y, W, 6);
}

function paintConeSign(ctx: Ctx, x: number, y: number) {
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, x - 82, y - 170, 164, 330, 40);
  ctx.fill();
  ctx.strokeStyle = "#ffb3c8";
  ctx.lineWidth = 8;
  ctx.stroke();
  // Cone.
  ctx.beginPath();
  ctx.moveTo(x - 44, y - 6);
  ctx.lineTo(x, y + 120);
  ctx.lineTo(x + 44, y - 6);
  ctx.closePath();
  ctx.fillStyle = "#f6c27a";
  ctx.fill();
  ctx.strokeStyle = "rgba(170, 110, 60, 0.6)";
  ctx.lineWidth = 3;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(x + i * 18 - 20, y);
    ctx.lineTo(x + i * 18 + 20, y + 60);
    ctx.stroke();
  }
  for (const [dy, f] of [
    [-30, FLAVOR.mint.base],
    [-86, FLAVOR.strawberry.base],
  ] as const) {
    circle(ctx, x, y + dy, 48);
    ctx.fillStyle = f;
    ctx.fill();
  }
  ctx.restore();
}

function paintFlavorBoard(ctx: Ctx, x: number, y: number) {
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = "#fffaf3";
  roundRect(ctx, x - 82, y - 160, 164, 320, 26);
  ctx.fill();
  ctx.strokeStyle = "#a9e2c9";
  ctx.lineWidth = 8;
  ctx.stroke();
  const flavors = [FLAVOR.vanilla, FLAVOR.strawberry, FLAVOR.chocolate, FLAVOR.mint];
  flavors.forEach((f, i) => {
    circle(ctx, x - 36, y - 104 + i * 70, 22);
    ctx.fillStyle = f.base;
    ctx.fill();
    ctx.fillStyle = "rgba(160, 110, 110, 0.45)";
    roundRect(ctx, x - 4, y - 112 + i * 70, 54, 14, 7);
    ctx.fill();
  });
  ctx.restore();
}
