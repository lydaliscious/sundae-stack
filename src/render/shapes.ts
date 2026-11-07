/** Small canvas helpers shared by the drawing modules. */

export type Ctx = CanvasRenderingContext2D;

/** Canvas text uses the page's rounded display font (next/font gives it a generated family name). */
let fontFamily = '"Fredoka", ui-rounded, system-ui, sans-serif';
export function setCanvasFont(family: string) {
  if (family.trim()) fontFamily = `${family}, ui-rounded, system-ui, sans-serif`;
}
export function font(weight: number, px: number) {
  return `${weight} ${Math.round(px)}px ${fontFamily}`;
}

/** Deterministic hash → 0..1, for stable per-item decoration. */
export function hash01(seed: number, i = 0): number {
  const s = Math.sin(seed * 9301.17 + i * 49297.31 + 233.7) * 43758.5453;
  return s - Math.floor(s);
}

export function radial(ctx: Ctx, x: number, y: number, r0: number, x1: number, y1: number, r1: number, stops: [number, string][]) {
  const g = ctx.createRadialGradient(x, y, r0, x1, y1, r1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

export function linear(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

export function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, Math.PI * 2);
}

export function circle(ctx: Ctx, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.01, r), 0, Math.PI * 2);
}

export function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Fill then outline the current path with the cartoon ink line. */
export function fillInk(ctx: Ctx, fill: string | CanvasGradient, ink: string, width: number) {
  ctx.fillStyle = fill;
  ctx.fill();
  if (width > 0) {
    ctx.lineWidth = width;
    ctx.strokeStyle = ink;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();
  }
}

/** A five-pointed sparkle star. */
export function star(ctx: Ctx, x: number, y: number, r: number, inner = 0.45, points = 4, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const rr = i % 2 === 0 ? r : r * inner;
    const a = rot + (i * Math.PI) / points - Math.PI / 2;
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
export const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
export const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
