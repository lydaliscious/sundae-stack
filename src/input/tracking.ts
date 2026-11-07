/** One reading from a pose adapter, already in viewer space (mirrored). */
export interface HipSample {
  /** Seconds (monotonic). */
  t: number;
  /** Viewer-space hip midpoint x, 0..1. */
  x: number;
  /** The weaker of the two hip confidences, 0..1. */
  confidence: number;
  /** Bodies the adapter sees. More than one is ambiguous: we can't tell who is playing. */
  people: number;
}

export interface TrackingConfig {
  minConfidence: number;
  /** Seconds of consistently good samples before tracking counts as (re)acquired. */
  stableSeconds: number;
  /** Seconds of bad (or missing) samples before tracking counts as lost. */
  lossSeconds: number;
  /** A hip midpoint can't move faster than this (frame widths per second)… */
  maxSpeed: number;
  /** …plus this much slack, or the reading is treated as a different body or a glitch. */
  jumpSlack: number;
  /** No samples for this long counts as lost (the stream stalled). */
  staleSeconds: number;
}

export const DEFAULT_TRACKING: TrackingConfig = {
  minConfidence: 0.5,
  stableSeconds: 0.5,
  lossSeconds: 0.2,
  maxSpeed: 2.5,
  jumpSlack: 0.06,
  staleSeconds: 0.6,
};

export type TrackingStatus = "searching" | "tracking" | "lost";
export type TrackingProblem = "no-body" | "low-confidence" | "multiple-people" | "jump" | "stale" | null;

/**
 * Decides whether hip tracking is trustworthy. Gameplay freezes the moment this reports `lost`
 * and only resumes after it has been `tracking` again for `stableSeconds`.
 */
export class TrackingMonitor {
  status: TrackingStatus = "searching";
  problem: TrackingProblem = "no-body";
  /** The last trusted hip x (viewer space). */
  x: number | null = null;
  private goodSince: number | null = null;
  private badSince: number | null = null;
  private lastT: number | null = null;
  private lastGoodX: number | null = null;
  private lastGoodT: number | null = null;

  constructor(private config: TrackingConfig = DEFAULT_TRACKING) {}

  reset() {
    this.status = "searching";
    this.problem = "no-body";
    this.x = null;
    this.goodSince = this.badSince = this.lastT = this.lastGoodX = this.lastGoodT = null;
  }

  /** Feed one sample; returns the status after it. */
  update(sample: HipSample): TrackingStatus {
    const c = this.config;
    this.lastT = sample.t;
    const problem = this.classify(sample);
    if (problem) {
      this.goodSince = null;
      this.badSince ??= sample.t;
      this.problem = problem;
      if (this.status === "tracking" && sample.t - this.badSince >= c.lossSeconds) this.status = "lost";
      // A body that keeps reappearing elsewhere is a new candidate once it holds still.
      if (problem === "jump") {
        this.lastGoodX = sample.x;
        this.lastGoodT = sample.t;
      }
      return this.status;
    }
    this.badSince = null;
    this.goodSince ??= sample.t;
    this.lastGoodX = sample.x;
    this.lastGoodT = sample.t;
    if (this.status !== "tracking") {
      if (sample.t - this.goodSince >= c.stableSeconds) {
        this.status = "tracking";
        this.problem = null;
      }
    } else {
      this.problem = null;
    }
    if (this.status === "tracking") this.x = sample.x;
    return this.status;
  }

  /** Call every frame: a stalled stream counts as lost even without samples. */
  tick(now: number): TrackingStatus {
    if (this.lastT !== null && now - this.lastT >= this.config.staleSeconds) {
      this.goodSince = null;
      this.problem = "stale";
      if (this.status === "tracking") this.status = "lost";
    }
    return this.status;
  }

  private classify(s: HipSample): TrackingProblem {
    const c = this.config;
    if (s.people === 0) return "no-body";
    if (s.people > 1) return "multiple-people";
    if (!(s.confidence >= c.minConfidence) || !Number.isFinite(s.x)) return "low-confidence";
    if (this.lastGoodX !== null && this.lastGoodT !== null) {
      const dt = Math.max(0, s.t - this.lastGoodT);
      if (Math.abs(s.x - this.lastGoodX) > c.maxSpeed * dt + c.jumpSlack) return "jump";
    }
    return null;
  }
}
