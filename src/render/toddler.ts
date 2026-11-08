import { FACE, type Speckle } from "@/game/speckles";
import { FLAVOR, HAIR, INK, IRIS, PANTS, ROMPER, SHOE, SKIN } from "./palette";
import { circle, ellipse, fillInk, radial, star, type Ctx } from "./shapes";

export type Expression = "mischief" | "happy" | "excited" | "proud" | "surprised" | "giggle" | "worried" | "focused";

export interface ToddlerPose {
  /** Bowl centre x (world); the body follows it. */
  x: number;
  feetY: number;
  /** World y of the bowl rim (the hands grip just below it). */
  rimY: number;
  /** Walk cycle phase (radians) and how much of a step is showing (0..1). */
  walkPhase: number;
  walk: number;
  /** Body lean (radians), from movement. */
  lean: number;
  /** Vertical bounce (px, negative = up). */
  bounce: number;
  /** Where the eyes look: −1..1 on each axis. */
  look: { x: number; y: number };
  expression: Expression;
  /** 0 open … 1 closed. */
  blink: number;
  /** Head tilt (radians) on top of the lean. */
  headTilt: number;
  /** Speckles on the face, each with a 0..1 reveal scale. */
  speckles: { speckle: Speckle; scale: number }[];
  /** Seconds, for idle motion (breathing, hair bounce). */
  time: number;
}

export const HEAD_R = 104;
const HEAD_Y = -268;
const SHOULDER = { x: 60, y: -186 };

export function headCenter(p: ToddlerPose) {
  return {
    x: p.x + Math.sin(p.lean) * -HEAD_Y * 0.55,
    y: p.feetY + HEAD_Y + p.bounce + Math.sin(p.time * 2.2) * 1.5,
  };
}

/** Body, arms and head: everything that sits behind the bowl. */
export function drawToddlerBody(ctx: Ctx, p: ToddlerPose) {
  const { x, feetY } = p;
  const step = Math.sin(p.walkPhase) * p.walk;
  const breathe = 1 + Math.sin(p.time * 2.2) * 0.012;

  // Floor shadow.
  ctx.fillStyle = "rgba(120, 70, 80, 0.18)";
  ellipse(ctx, x, feetY + 4, 92, 16);
  ctx.fill();

  ctx.save();
  ctx.translate(x, feetY + p.bounce);
  // Legs and shoes: small alternating sideways steps.
  for (const side of [-1, 1]) {
    const lift = Math.max(0, side * step) * 14;
    const shift = side * step * 7;
    const lx = side * 30 + shift;
    ctx.beginPath();
    ctx.roundRect(lx - 20, -80 - lift, 40, 64, 16);
    fillInk(ctx, PANTS.base, INK, 5);
    ellipse(ctx, lx + side * 4, -16 - lift, 34, 19);
    fillInk(ctx, radial(ctx, lx - 6, -24 - lift, 2, lx, -16 - lift, 36, [[0, SHOE.light], [1, SHOE.base]]), INK, 5);
    ctx.fillStyle = SHOE.sole;
    ctx.beginPath();
    ctx.ellipse(lx + side * 4, -6 - lift, 30, 6, 0, 0, Math.PI);
    ctx.fill();
    ctx.strokeStyle = "rgba(91,58,63,0.5)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(lx - 10, -28 - lift);
    ctx.lineTo(lx + 12, -26 - lift);
    ctx.stroke();
  }

  // Torso: a round little romper, leaning with movement.
  ctx.rotate(p.lean);
  ctx.save();
  ctx.translate(0, -122);
  ctx.scale(breathe, breathe);
  // Pants seat.
  for (const side of [-1, 1]) {
    ellipse(ctx, side * 34, 52, 34, 22);
    fillInk(ctx, PANTS.base, INK, 5);
  }
  // Blue long-sleeve top with a white star on the chest.
  ctx.beginPath();
  ctx.moveTo(-58, -58);
  ctx.bezierCurveTo(-92, -10, -92, 52, -40, 62);
  ctx.quadraticCurveTo(0, 70, 40, 62);
  ctx.bezierCurveTo(92, 52, 92, -10, 58, -58);
  ctx.quadraticCurveTo(0, -78, -58, -58);
  ctx.closePath();
  fillInk(ctx, radial(ctx, -26, -30, 6, 0, 0, 100, [[0, ROMPER.light], [0.6, ROMPER.base], [1, ROMPER.dark]]), INK, 6);
  // Hem.
  ctx.strokeStyle = "rgba(30, 40, 90, 0.35)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-66, 44);
  ctx.quadraticCurveTo(0, 58, 66, 44);
  ctx.stroke();
  star(ctx, 8, 2, 30, 0.45, 5, -0.12);
  fillInk(ctx, ROMPER.star, "rgba(30, 40, 90, 0.35)", 3);
  ctx.restore();
  ctx.restore();
}

/** Arms reach from the shoulders up to the bowl, then the head goes on top. */
export function drawToddlerArmsAndHead(ctx: Ctx, p: ToddlerPose) {
  const head = headCenter(p);
  const shoulderY = p.feetY + p.bounce + SHOULDER.y;
  const sx = p.x + Math.sin(p.lean) * 120;
  const handY = p.rimY + 36;

  for (const side of [-1, 1]) {
    const shx = sx + side * SHOULDER.x;
    const hx = p.x + side * 112;
    const ex = (shx + hx) / 2 + side * 46;
    const ey = (shoulderY + handY) / 2 + 10;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(shx, shoulderY);
    ctx.quadraticCurveTo(ex, ey, hx, handY);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 44;
    ctx.stroke();
    // Long sleeves.
    ctx.strokeStyle = ROMPER.base;
    ctx.lineWidth = 34;
    ctx.stroke();
    circle(ctx, shx + side * 4, shoulderY + 6, 28);
    fillInk(ctx, ROMPER.base, INK, 5);
  }

  drawHead(ctx, head.x, head.y, p);
}

/** Chubby hands holding the bowl's sides, drawn over the bowl. */
export function drawToddlerHands(ctx: Ctx, p: ToddlerPose) {
  const handY = p.rimY + 36;
  for (const side of [-1, 1]) {
    const hx = p.x + side * 112;
    circle(ctx, hx, handY, 23);
    fillInk(ctx, radial(ctx, hx - 6, handY - 8, 2, hx, handY, 26, [[0, SKIN.light], [1, SKIN.base]]), INK, 5);
    ctx.strokeStyle = "rgba(91,58,63,0.45)";
    ctx.lineWidth = 3;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(hx - side * 10, handY + i * 8 - 2);
      ctx.lineTo(hx - side * 18, handY + i * 8 - 2);
      ctx.stroke();
    }
  }
}

function drawHead(ctx: Ctx, hx: number, hy: number, p: ToddlerPose) {
  const R = HEAD_R;
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(p.lean * 0.6 + p.headTilt);

  const hairFill = () => radial(ctx, -R * 0.35, -R * 1.0, 4, 0, -R * 0.3, R * 1.3, [[0, HAIR.light], [0.6, HAIR.base], [1, HAIR.dark]]);

  // The back of a dark bowl cut: a rounded helmet that covers the ears and stops at the cheeks.
  ctx.beginPath();
  ctx.moveTo(-R * 1.04, R * 0.26);
  ctx.bezierCurveTo(-R * 1.24, -R * 0.55, -R * 0.68, -R * 1.2, 0, -R * 1.16);
  ctx.bezierCurveTo(R * 0.68, -R * 1.2, R * 1.24, -R * 0.55, R * 1.04, R * 0.26);
  ctx.quadraticCurveTo(R * 0.94, R * 0.34, R * 0.84, R * 0.24);
  ctx.lineTo(-R * 0.84, R * 0.24);
  ctx.quadraticCurveTo(-R * 0.94, R * 0.34, -R * 1.04, R * 0.26);
  ctx.closePath();
  fillInk(ctx, hairFill(), INK, 7);

  // Head: a round face with chubby cheeks bulging a little at the sides. Stroking the union
  // first and filling over it leaves only the outer half of the outline visible.
  headPath(ctx, R);
  ctx.lineWidth = 12;
  ctx.strokeStyle = INK;
  ctx.lineJoin = "round";
  ctx.stroke();
  headPath(ctx, R);
  ctx.fillStyle = radial(ctx, -R * 0.35, -R * 0.4, R * 0.1, 0, 0, R * 1.15, [[0, SKIN.light], [0.6, SKIN.base], [1, SKIN.shade]]);
  ctx.fill();

  // Straight-cut bangs and side hair over the face, with a soft shine.
  ctx.save();
  headPath(ctx, R);
  ctx.clip();
  const bangs = () => {
    ctx.beginPath();
    ctx.moveTo(-R * 1.2, R * 0.24);
    ctx.lineTo(-R * 1.2, -R * 1.3);
    ctx.lineTo(R * 1.2, -R * 1.3);
    ctx.lineTo(R * 1.2, R * 0.24);
    ctx.lineTo(R * 0.86, R * 0.24);
    ctx.bezierCurveTo(R * 0.88, -R * 0.08, R * 0.8, -R * 0.32, R * 0.62, -R * 0.42);
    ctx.quadraticCurveTo(R * 0.3, -R * 0.36, 0, -R * 0.44);
    ctx.quadraticCurveTo(-R * 0.3, -R * 0.36, -R * 0.62, -R * 0.42);
    ctx.bezierCurveTo(-R * 0.8, -R * 0.32, -R * 0.88, -R * 0.08, -R * 0.86, R * 0.24);
    ctx.closePath();
  };
  bangs();
  ctx.fillStyle = hairFill();
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 235, 220, 0.28)";
  ctx.lineWidth = R * 0.07;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(0, -R * 0.15, R * 0.78, Math.PI * 1.24, Math.PI * 1.5);
  ctx.stroke();
  bangs();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.restore();

  drawFace(ctx, R, p);

  // Ice-cream speckles live in head-local coordinates, so they move with the head.
  for (const { speckle, scale } of p.speckles) {
    if (scale <= 0) continue;
    drawSpeckle(ctx, speckle, R, scale);
  }
  ctx.restore();
}

function headPath(ctx: Ctx, R: number) {
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, Math.PI * 2);
  for (const side of [-1, 1]) {
    ctx.moveTo(side * R * 0.5 + R * 0.5, R * 0.36);
    ctx.ellipse(side * R * 0.5, R * 0.36, R * 0.5, R * 0.46, 0, 0, Math.PI * 2);
  }
}

function drawFace(ctx: Ctx, R: number, p: ToddlerPose) {
  const e = p.expression;
  const closedHappy = e === "proud" || e === "giggle";
  const wide = e === "surprised" ? 1.18 : e === "excited" ? 1.06 : 1;

  // Cheeks.
  for (const ch of FACE.cheeks) {
    ctx.fillStyle = SKIN.blush;
    ellipse(ctx, ch.cx * R, ch.cy * R, R * 0.19, R * 0.12);
    ctx.fill();
  }

  // Brows.
  ctx.strokeStyle = HAIR.base;
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  for (const [i, eye] of FACE.eyes.entries()) {
    const side = i === 0 ? -1 : 1;
    const raise = e === "surprised" ? -R * 0.1 : e === "excited" || e === "proud" ? -R * 0.05 : 0;
    const worried = e === "worried" ? side * R * 0.05 : 0;
    const mischief = e === "mischief" && side === 1 ? -R * 0.04 : 0;
    ctx.beginPath();
    ctx.moveTo(eye.cx * R - side * R * 0.12, eye.cy * R - R * 0.27 + raise + mischief - worried);
    ctx.quadraticCurveTo(eye.cx * R, eye.cy * R - R * 0.34 + raise + mischief, eye.cx * R + side * R * 0.12, eye.cy * R - R * 0.27 + raise + mischief + worried);
    ctx.stroke();
  }

  // Eyes.
  for (const eye of FACE.eyes) {
    const ex = eye.cx * R;
    const ey = eye.cy * R;
    if (closedHappy) {
      ctx.strokeStyle = INK;
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(ex, ey + R * 0.06, R * 0.13, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
      continue;
    }
    const rx = R * 0.165 * wide;
    const ry = R * 0.21 * wide;
    const blink = Math.min(1, p.blink);
    if (blink > 0.85) {
      ctx.strokeStyle = INK;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(ex, ey - R * 0.02, R * 0.13, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
      continue;
    }
    ctx.save();
    ellipse(ctx, ex, ey, rx, ry * (1 - blink * 0.8));
    fillInk(ctx, "#ffffff", INK, 5);
    ellipse(ctx, ex, ey, rx, ry * (1 - blink * 0.8));
    ctx.clip();
    const lx = ex + p.look.x * rx * 0.38;
    const ly = ey + p.look.y * ry * 0.34;
    ellipse(ctx, lx, ly, rx * 0.78, ry * 0.74);
    ctx.fillStyle = radial(ctx, lx, ly + ry * 0.3, 2, lx, ly, ry * 0.8, [[0, IRIS.light], [1, IRIS.dark]]);
    ctx.fill();
    circle(ctx, lx, ly, rx * 0.42);
    ctx.fillStyle = "#1d1114";
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    circle(ctx, lx - rx * 0.3, ly - ry * 0.32, rx * 0.3);
    ctx.fill();
    circle(ctx, lx + rx * 0.28, ly + ry * 0.3, rx * 0.13);
    ctx.fill();
    if (e === "excited") {
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      circle(ctx, lx + rx * 0.3, ly - ry * 0.4, rx * 0.12);
      ctx.fill();
    }
    ctx.restore();
  }

  // Tiny nose.
  ellipse(ctx, FACE.nose.cx * R, FACE.nose.cy * R, R * 0.07, R * 0.05);
  fillInk(ctx, SKIN.shade, "rgba(91,58,63,0.5)", 3);
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  circle(ctx, FACE.nose.cx * R - R * 0.02, FACE.nose.cy * R - R * 0.015, R * 0.018);
  ctx.fill();

  drawMouth(ctx, R, e, p.time);
}

function drawMouth(ctx: Ctx, R: number, e: ToddlerPose["expression"], t: number) {
  const mx = FACE.mouth.cx * R;
  const my = FACE.mouth.cy * R;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const openSmile = (w: number, h: number) => {
    ctx.beginPath();
    ctx.moveTo(mx - w, my - h * 0.25);
    ctx.quadraticCurveTo(mx, my - h * 0.05, mx + w, my - h * 0.25);
    ctx.quadraticCurveTo(mx + w * 0.8, my + h, mx, my + h);
    ctx.quadraticCurveTo(mx - w * 0.8, my + h, mx - w, my - h * 0.25);
    ctx.closePath();
    fillInk(ctx, "#8c2f43", INK, 5);
    ctx.save();
    ctx.clip();
    ellipse(ctx, mx, my + h * 0.95, w * 0.6, h * 0.45);
    ctx.fillStyle = "#ff8aa0";
    ctx.fill();
    ctx.restore();
  };
  switch (e) {
    case "surprised":
      ellipse(ctx, mx, my + R * 0.02, R * 0.09, R * 0.11);
      fillInk(ctx, "#8c2f43", INK, 5);
      return;
    case "giggle": {
      const s = 1 + Math.sin(t * 22) * 0.08;
      openSmile(R * 0.2 * s, R * 0.17 * s);
      return;
    }
    case "excited":
    case "proud":
      openSmile(R * 0.21, R * 0.16);
      return;
    case "happy":
      openSmile(R * 0.17, R * 0.12);
      return;
    case "worried":
      ctx.strokeStyle = INK;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(mx - R * 0.1, my + R * 0.03);
      ctx.quadraticCurveTo(mx - R * 0.05, my - R * 0.02, mx, my + R * 0.03);
      ctx.quadraticCurveTo(mx + R * 0.05, my + R * 0.07, mx + R * 0.1, my + R * 0.02);
      ctx.stroke();
      return;
    case "focused":
      ctx.strokeStyle = INK;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(mx - R * 0.08, my + R * 0.02);
      ctx.quadraticCurveTo(mx, my + R * 0.06, mx + R * 0.08, my + R * 0.0);
      ctx.stroke();
      ellipse(ctx, mx + R * 0.09, my + R * 0.04, R * 0.035, R * 0.03);
      ctx.fillStyle = "#ff8aa0";
      ctx.fill();
      return;
    default:
      // A soft, sweet smile.
      ctx.strokeStyle = INK;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(mx - R * 0.13, my - R * 0.03);
      ctx.quadraticCurveTo(mx, my + R * 0.1, mx + R * 0.13, my - R * 0.03);
      ctx.stroke();
      return;
  }
}

function drawSpeckle(ctx: Ctx, sp: Speckle, R: number, scale: number) {
  const c = FLAVOR[sp.flavor];
  const x = sp.x * R;
  const y = sp.y * R;
  const r = sp.r * R * scale;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(sp.shape * Math.PI * 2);
  // A splat: a main blob plus two satellites.
  ctx.beginPath();
  ctx.ellipse(0, 0, r, r * 0.82, 0, 0, Math.PI * 2);
  ctx.moveTo(r * 1.45 + r * 0.32, r * 0.1);
  ctx.arc(r * 1.45, r * 0.1, r * 0.32, 0, Math.PI * 2);
  ctx.moveTo(-r * 0.4 + r * 0.24, -r * 1.25);
  ctx.arc(-r * 0.4, -r * 1.25, r * 0.24, 0, Math.PI * 2);
  ctx.fillStyle = c.splat;
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, r * 0.18);
  ctx.strokeStyle = sp.flavor === "vanilla" ? "rgba(190, 150, 90, 0.8)" : "rgba(91,58,63,0.55)";
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  circle(ctx, -r * 0.3, -r * 0.25, r * 0.28);
  ctx.fill();
  ctx.restore();
}
