import { makeCalibration, type Calibration } from "./mapping";

export type CalibrationStep = "center" | "left" | "right" | "test";

export interface CaptureConfig {
  /** Seconds the player must hold a position for it to be recorded. */
  holdSeconds: number;
  /** Max spread (viewer-space x) of the readings during the hold. */
  tolerance: number;
  /** A left/right position must be at least this far from the centre. */
  minStep: number;
}

export const DEFAULT_CAPTURE: CaptureConfig = { holdSeconds: 1.1, tolerance: 0.025, minStep: 0.035 };

/** Detects "held still for a moment" in a stream of hip readings and reports where. */
export class StillnessDetector {
  private buf: { t: number; x: number }[] = [];
  constructor(private config: CaptureConfig = DEFAULT_CAPTURE) {}

  reset() {
    this.buf = [];
  }

  /** Feeds one trusted reading; returns hold progress 0..1 and, when complete, the mean x. */
  push(t: number, x: number, accept: (x: number) => boolean = () => true): { progress: number; value: number | null } {
    const c = this.config;
    if (!accept(x)) {
      this.buf = [];
      return { progress: 0, value: null };
    }
    this.buf.push({ t, x });
    // Drop readings older than the hold window.
    while (this.buf.length > 1 && t - this.buf[1].t >= c.holdSeconds) this.buf.shift();
    // Any reading too far from the newest restarts the hold from there.
    let start = 0;
    for (let i = this.buf.length - 1; i >= 0; i--) {
      if (Math.abs(this.buf[i].x - x) > c.tolerance) {
        start = i + 1;
        break;
      }
    }
    if (start > 0) this.buf = this.buf.slice(start);
    const span = this.buf.length ? t - this.buf[0].t : 0;
    const progress = Math.min(1, span / c.holdSeconds);
    if (progress < 1 || this.buf.length < 3) return { progress, value: null };
    const value = this.buf.reduce((sum, r) => sum + r.x, 0) / this.buf.length;
    return { progress: 1, value };
  }
}

/**
 * The calibration walk-through: stand in the middle, take a comfortable step left, then right.
 * Each position is recorded once the player holds still there.
 */
export class CalibrationFlow {
  step: CalibrationStep = "center";
  progress = 0;
  center: number | null = null;
  left: number | null = null;
  right: number | null = null;
  calibration: Calibration | null = null;
  private detector: StillnessDetector;

  constructor(private config: CaptureConfig = DEFAULT_CAPTURE) {
    this.detector = new StillnessDetector(config);
  }

  restart() {
    this.step = "center";
    this.progress = 0;
    this.center = this.left = this.right = null;
    this.calibration = null;
    this.detector.reset();
  }

  /** Readings must come from trusted tracking. Returns true when a step was just recorded. */
  push(t: number, x: number): boolean {
    if (this.step === "test") return false;
    const minStep = this.config.minStep;
    const center = this.center;
    const accept =
      this.step === "center" || center === null
        ? () => true
        : this.step === "left"
          ? (v: number) => Math.abs(v - center) >= minStep
          : (v: number) => Math.abs(v - center) >= minStep && (this.left === null || Math.sign(v - center) !== Math.sign(this.left - center));
    const { progress, value } = this.detector.push(t, x, accept);
    this.progress = progress;
    if (value === null) return false;
    this.detector.reset();
    this.progress = 0;
    if (this.step === "center") {
      this.center = value;
      this.step = "left";
    } else if (this.step === "left") {
      this.left = value;
      this.step = "right";
    } else {
      this.right = value;
      this.calibration = makeCalibration(this.center!, this.left!, value);
      this.step = "test";
    }
    return true;
  }

  /** Lost tracking mid-step: the hold starts over. */
  interrupt() {
    this.detector.reset();
    this.progress = 0;
  }
}
