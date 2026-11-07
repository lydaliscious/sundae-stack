/** Length of the overlap between [aMin, aMax] and [bMin, bMax] (0 when apart). */
export function overlap1d(aMin: number, aMax: number, bMin: number, bMax: number): number {
  return Math.max(0, Math.min(aMax, bMax) - Math.max(aMin, bMin));
}

export interface CatchSurface {
  x: number;
  y: number;
  /** The surface y at the previous step (it jumps up when a scoop lands). */
  prevY: number;
  width: number;
}

export interface FallingBody {
  x: number;
  /** Contact y (the bottom of the item) at the previous and the current step. */
  prevContactY: number;
  contactY: number;
  radius: number;
}

export type CrossResult = "none" | "caught" | "passed";

/**
 * An item is caught when its contact point crosses the catch surface from above during this step
 * while overlapping it horizontally by at least `minOverlap × item width`. Crossing without that
 * overlap means it slipped past the side: it is `passed` and can never be caught afterwards.
 * Crossing is measured relative to the surface, so a stack that grows into an item counts too.
 */
export function crossSurface(body: FallingBody, surface: CatchSurface, minOverlap: number): CrossResult {
  const before = body.prevContactY - surface.prevY;
  const after = body.contactY - surface.y;
  if (before >= 0) return "passed";
  if (after < 0) return "none";
  const half = surface.width / 2;
  const ov = overlap1d(body.x - body.radius, body.x + body.radius, surface.x - half, surface.x + half);
  return ov >= minOverlap * body.radius * 2 ? "caught" : "passed";
}
