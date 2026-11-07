import { applyDeadband, clamp, smoothToward, unitToWorld } from "./mapping";

export interface MovementConfig {
  /** Deadband in unit space (−1..1). */
  deadband: number;
  /** Smoothing time constant (seconds). */
  tau: number;
  /** How fast held arrow keys move the target (unit space per second). */
  keySpeed: number;
  minX: number;
  maxX: number;
}

export const DEFAULT_MOVEMENT: MovementConfig = { deadband: 0.025, tau: 0.085, keySpeed: 2.1, minX: 240, maxX: 1680 };

/**
 * The single movement path for every input: a target position in unit space (absolute, from a
 * calibrated hip reading or from arrow keys) → deadband → smoothing → world x.
 */
export class Movement {
  /** Latest absolute target, unit space. */
  target = 0;
  private held = 0;
  /** Smoothed position, unit space. */
  position = 0;
  private keys = { left: false, right: false };

  constructor(public config: MovementConfig = DEFAULT_MOVEMENT) {}

  reset(u = 0) {
    this.target = this.held = this.position = u;
    this.keys = { left: false, right: false };
  }

  /** Absolute target from a calibrated pose reading. */
  setTarget(u: number) {
    this.target = clamp(u, -1, 1);
  }

  setKey(dir: "left" | "right", down: boolean) {
    this.keys[dir] = down;
  }

  releaseKeys() {
    this.keys = { left: false, right: false };
  }

  /** Advances one step and returns the bowl's world x. */
  update(dt: number): number {
    const dir = (this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0);
    if (dir !== 0) this.target = clamp(this.target + dir * this.config.keySpeed * dt, -1, 1);
    this.held = applyDeadband(this.target, this.held, this.config.deadband);
    if (dir !== 0) this.held = this.target;
    this.position = smoothToward(this.position, this.held, dt, this.config.tau);
    return this.worldX;
  }

  get worldX(): number {
    return unitToWorld(this.position, this.config.minX, this.config.maxX);
  }
}
