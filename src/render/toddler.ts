import { FACE, type Speckle } from "@/game/speckles";
import { FLAVOR, HAIR, INK, ROMPER, SHOE, SKIN } from "./palette";
import { circle, ellipse, fillInk, radial, type Ctx } from "./shapes";

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
    ctx.roundRect(lx - 19, -78 - lift, 38, 62, 18);
    fillInk(ctx, SKIN.base, INK, 5);
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
  for (const side of [-1, 1]) {
    ellipse(ctx, side * 34, 52, 34, 22);
    fillInk(ctx, ROMPER.base, INK, 5);
  }
  ctx.beginPath();
  ctx.moveTo(-58, -58);
  ctx.bezierCurveTo(-92, -10, -92, 52, -40, 62);
  ctx.quadraticCurveTo(0, 70, 40, 62);
  ctx.bezierCurveTo(92, 52, 92, -10, 58, -58);
  ctx.quadraticCurveTo(0, -78, -58, -58);
  ctx.closePath();
  fillInk(ctx, radial(ctx, -26, -30, 6, 0, 0, 100, [[0, ROMPER.light], [0.6, ROMPER.base], [1, ROMPER.dark]]), INK, 6);
  // Bib pocket with a heart.
  ctx.beginPath();
  ctx.roundRect(-30, -12, 60, 42, 14);
  fillInk(ctx, ROMPER.pocket, INK, 4);
  ctx.fillStyle = "#ff7d9c";
  ctx.beginPath();
  ctx.moveTo(0, 18);
  ctx.bezierCurveTo(-16, 6, -12, -6, 0, 2);
  ctx.bezierCurveTo(12, -6, 16, 6, 0, 18);
  ctx.fill();
  // Buttons.
  for (const side of [-1, 1]) {
    circle(ctx, side * 34, -40, 6);
    fillInk(ctx, "#fff6d8", INK, 3);
  }
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
    ctx.lineWidth = 42;
    ctx.stroke();
    ctx.strokeStyle = SKIN.base;
    ctx.lineWidth = 32;
    ctx.stroke();
    // Puffy sleeve.
    circle(ctx, shx + side * 4, shoulderY + 6, 30);
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

  // Ears.
  for (const side of [-1, 1]) {
    circle(ctx, side * R * 0.96, R * 0.08, R * 0.2);
    fillInk(ctx, SKIN.base, INK, 5);
    circle(ctx, side * R * 0.98, R * 0.08, R * 0.1);
    ctx.fillStyle = SKIN.shade;
    ctx.fill();
  }

  // Hair tuft curling up from the crown (behind the head outline).
  const bob = Math.sin(p.time * 5) * 3 + p.bounce * 0.15;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-R * 0.05, -R * 0.9);
  ctx.bezierCurveTo(-R * 0.1, -R * 1.25 + bob, R * 0.3, -R * 1.3 + bob, R * 0.22, -R * 1.08 + bob);
  ctx.bezierCurveTo(R * 0.16, -R * 0.98 + bob, R * 0.04, -R * 1.04 + bob, R * 0.1, -R * 1.12 + bob);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 17;
  ctx.stroke();
  ctx.strokeStyle = HAIR.base;
  ctx.lineWidth = 10;
  ctx.stroke();

  // Head.
  circle(ctx, 0, 0, R);
  fillInk(ctx, radial(ctx, -R * 0.35, -R * 0.4, R * 0.1, 0, 0, R * 1.15, [[0, SKIN.light], [0.6, SKIN.base], [1, SKIN.shade]]), INK, 6);

  // Hair cap with a soft fringe.
  ctx.save();
  circle(ctx, 0, 0, R - 3);
  ctx.clip();
  ctx.beginPath();
  ctx.moveTo(-R, -R * 0.25);
  ctx.bezierCurveTo(-R * 0.9, -R * 1.2, R * 0.9, -R * 1.2, R, -R * 0.25);
  const bumps = 6;
  for (let i = 0; i < bumps; i++) {
    const xa = R - (2 * R * i) / bumps;
    const xb = R - (2 * R * (i + 1)) / bumps;
    const dip = i === 2 || i === 3 ? -R * 0.62 : -R * 0.42 - Math.abs(i - 2.5) * R * 0.02;
    ctx.quadraticCurveTo((xa + xb) / 2, dip + R * 0.16, xb, dip);
  }
  ctx.closePath();
  ctx.fillStyle = radial(ctx, -R * 0.3, -R * 0.9, 4, 0, -R * 0.6, R, [[0, HAIR.light], [1, HAIR.base]]);
  ctx.fill();
  ctx.restore();
  circle(ctx, 0, 0, R);
  ctx.lineWidth = 6;
  ctx.strokeStyle = INK;
  ctx.stroke();

  drawFace(ctx, R, p);

  // Ice-cream speckles live in head-local coordinates, so they move with the head.
  for (const { speckle, scale } of p.speckles) {
    if (scale <= 0) continue;
    drawSpeckle(ctx, speckle, R, scale);
  }
  ctx.restore();
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
    ctx.fillStyle = radial(ctx, lx, ly + ry * 0.3, 2, lx, ly, ry * 0.8, [[0, "#8a5a3c"], [1, "#3b2320"]]);
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
    default: {
      // Delighted, slightly mischievous lopsided grin.
      ctx.beginPath();
      ctx.moveTo(mx - R * 0.15, my - R * 0.02);
      ctx.quadraticCurveTo(mx - R * 0.02, my + R * 0.14, mx + R * 0.16, my - R * 0.07);
      ctx.quadraticCurveTo(mx + R * 0.02, my + R * 0.05, mx - R * 0.15, my - R * 0.02);
      fillInk(ctx, "#8c2f43", INK, 5);
    }
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
