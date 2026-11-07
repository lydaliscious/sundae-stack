/**
 * Pure maths for turning a hip position into the toddler's position.
 *
 * Coordinate spaces:
 * - camera space: x in 0..1 across the camera frame as the sensor sees it (the player's right
 *   hip appears on the left of the frame);
 * - viewer space: camera space mirrored, so a physical step to the player's right increases x;
 * - unit space: −1 (calibrated left) … 0 (calibrated centre) … +1 (calibrated right);
 * - world space: the bowl's x on the 1920-wide stage.
 */

/** Camera → viewer space. A front camera sees the player mirrored, so flip x. */
export function mirrorX(x: number): number {
  return 1 - x;
}

/** The horizontal midpoint between the hips; only hips steer (never arms or head). */
export function hipMidpoint(left: { x: number }, right: { x: number }): number {
  return (left.x + right.x) / 2;
}

export interface Calibration {
  /** Viewer-space x of the calibrated centre, left and right positions. */
  center: number;
  left: number;
  right: number;
  /** True when the recorded left/right came out reversed (a camera that already mirrors). */
  flipped: boolean;
}

export const CALIBRATION_LIMITS = {
  /** Smallest half-range accepted on either side: tiny steps would make the game twitchy. */
  minHalfRange: 0.04,
  /** Half-range used when calibration is skipped. */
  defaultHalfRange: 0.14,
};

/**
 * Builds a calibration from the three recorded positions. Handles a reversed camera (left/right
 * swapped) and enforces a minimum range on each side so a timid step still works.
 */
export function makeCalibration(center: number, left: number, right: number): Calibration {
  let flipped = false;
  let l = left;
  let r = right;
  if (l > r) {
    [l, r] = [r, l];
    flipped = true;
  }
  let c = center;
  if (!(c > l && c < r)) c = (l + r) / 2;
  const min = CALIBRATION_LIMITS.minHalfRange;
  if (c - l < min) l = c - min;
  if (r - c < min) r = c + min;
  return { center: c, left: l, right: r, flipped };
}

export function defaultCalibration(center = 0.5): Calibration {
  const h = CALIBRATION_LIMITS.defaultHalfRange;
  return { center, left: center - h, right: center + h, flipped: false };
}

/**
 * Absolute mapping: centre → 0, recorded left → −1, recorded right → +1, linear on each side
 * (so an asymmetric room still reaches both edges), clamped beyond.
 */
export function toUnit(x: number, cal: Calibration): number {
  const u = x >= cal.center ? (x - cal.center) / (cal.right - cal.center) : (x - cal.center) / (cal.center - cal.left);
  return clamp(cal.flipped ? -u : u, -1, 1) + 0;
}

/** Unit space → world x across the playable width. */
export function unitToWorld(u: number, minX: number, maxX: number): number {
  return minX + ((clamp(u, -1, 1) + 1) / 2) * (maxX - minX);
}

export function worldToUnit(x: number, minX: number, maxX: number): number {
  return clamp(((x - minX) / (maxX - minX)) * 2 - 1, -1, 1);
}

/**
 * Deadband: the held target only moves when a new reading leaves a small band around it, so a
 * player standing still doesn't make the toddler shimmer. Once it moves it jumps to the reading
 * (smoothing hides the jump), so returning to the centre lands exactly on the centre.
 */
export function applyDeadband(reading: number, held: number, band: number): number {
  return Math.abs(reading - held) <= band ? held : reading;
}

/** Frame-rate independent exponential smoothing toward `target` with time constant `tau`. */
export function smoothToward(current: number, target: number, dt: number, tau: number): number {
  if (tau <= 0) return target;
  const a = 1 - Math.exp(-dt / tau);
  return current + (target - current) * a;
}

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
