import type { Rng } from "./rng";
import type { Flavor } from "./types";

/**
 * Ice-cream speckles on the toddler's face, in head-local coordinates: the origin is the head
 * centre, one unit is the head radius, +y points down. The renderer draws them inside the
 * head's transform, so they move, bob and tilt with the head.
 */
export interface Speckle {
  id: number;
  x: number;
  y: number;
  /** Radius in head units. */
  r: number;
  flavor: Flavor;
  /** Cosmetic seed for the blob shape. */
  shape: number;
}

interface Ellipse {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

/** The face layout shared with the renderer, so speckles never cover the eyes or the mouth. */
export const FACE = {
  eyes: [
    { cx: -0.36, cy: -0.02, rx: 0.2, ry: 0.25 },
    { cx: 0.36, cy: -0.02, rx: 0.2, ry: 0.25 },
  ],
  mouth: { cx: 0, cy: 0.45, rx: 0.24, ry: 0.13 },
  nose: { cx: 0, cy: 0.16 },
  cheeks: [
    { cx: -0.6, cy: 0.3 },
    { cx: 0.6, cy: 0.3 },
  ],
} as const;

/** Where splashes land: cheeks, nose, forehead (and a little on the chin sides). */
export const SPECKLE_ZONES: readonly Ellipse[] = [
  { cx: -0.6, cy: 0.3, rx: 0.17, ry: 0.15 },
  { cx: 0.6, cy: 0.3, rx: 0.17, ry: 0.15 },
  { cx: 0, cy: -0.56, rx: 0.4, ry: 0.13 },
  { cx: 0, cy: 0.14, rx: 0.06, ry: 0.03 },
  { cx: -0.3, cy: 0.62, rx: 0.1, ry: 0.06 },
  { cx: 0.3, cy: 0.62, rx: 0.1, ry: 0.06 },
];

/** Keep-out zones (eyes + mouth) padded by this much, so expressions stay readable. */
export const KEEP_OUT_PAD = 0.04;
/** Speckles stay inside this radius of the head (head units). */
export const FACE_RADIUS = 0.86;

export function insideEllipse(x: number, y: number, e: Ellipse, pad = 0): boolean {
  const dx = (x - e.cx) / (e.rx + pad);
  const dy = (y - e.cy) / (e.ry + pad);
  return dx * dx + dy * dy <= 1;
}

export function isOnFeature(x: number, y: number, r: number): boolean {
  return [...FACE.eyes, FACE.mouth].some((e) => insideEllipse(x, y, e, KEEP_OUT_PAD + r));
}

/**
 * Adds `count` speckles in flavor colours, spread over the landing zones, and drops the oldest
 * beyond `cap` so later spills still show their own colours.
 */
export function addSpeckles(
  rng: Rng,
  existing: readonly Speckle[],
  flavors: readonly Flavor[],
  count: number,
  cap: number,
  firstId: number,
): Speckle[] {
  const palette: readonly Flavor[] = flavors.length ? flavors : ["vanilla"];
  const added: Speckle[] = [];
  const zoneOffset = rng.int(0, SPECKLE_ZONES.length);
  for (let i = 0; i < count; i++) {
    const r = rng.range(0.06, 0.095);
    let placed: { x: number; y: number } | null = null;
    for (let attempt = 0; attempt < 24 && !placed; attempt++) {
      const zone = SPECKLE_ZONES[(zoneOffset + i + Math.floor(attempt / 6)) % SPECKLE_ZONES.length];
      const a = rng.range(0, Math.PI * 2);
      const d = Math.sqrt(rng.next());
      const x = zone.cx + Math.cos(a) * zone.rx * d;
      const y = zone.cy + Math.sin(a) * zone.ry * d;
      if (Math.hypot(x, y) + r > FACE_RADIUS) continue;
      if (isOnFeature(x, y, r)) continue;
      placed = { x, y };
    }
    if (!placed) continue;
    added.push({ id: firstId + i, ...placed, r, flavor: palette[i % palette.length], shape: rng.next() });
  }
  const all = [...existing, ...added];
  return all.slice(Math.max(0, all.length - cap));
}
