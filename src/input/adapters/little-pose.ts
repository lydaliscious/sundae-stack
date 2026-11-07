import type { PoseFrame } from "@kabletv/little-sdk";
import { littleApp } from "@/little/host";
import { hipMidpoint, mirrorX } from "../mapping";
import type { PoseInputAdapter, PoseSample } from "./types";

/** COCO-17 hip indices. */
const LEFT_HIP = 11;
const RIGHT_HIP = 12;
/** Below this overall frame score we treat the frame as "nobody there". */
const MIN_BODY_SCORE = 0.25;

/** Pure conversion from a Little pose frame to a viewer-space hip sample. */
export function sampleFromPoseFrame(frame: PoseFrame, t: number): PoseSample {
  const l = frame.keypoints[LEFT_HIP];
  const r = frame.keypoints[RIGHT_HIP];
  if (!l || !r || frame.score < MIN_BODY_SCORE) return { t, x: NaN, y: NaN, confidence: 0, people: 0 };
  return {
    t,
    x: mirrorX(hipMidpoint(l, r)),
    y: (l.y + r.y) / 2,
    confidence: Math.min(l.score, r.score),
    // Little streams one body; switching bodies shows up as a jump, which the monitor catches.
    people: 1,
    keypoints: frame.keypoints.map((k) => ({ x: mirrorX(k.x), y: k.y, score: k.score })),
  };
}

/**
 * Little's host-owned pose stream: the TV runs the model on its own camera and sends COCO-17
 * keypoints only, never pixels.
 */
export class LittlePoseAdapter implements PoseInputAdapter {
  readonly kind = "little-pose" as const;
  readonly video = null;
  private unsubscribe: (() => void) | null = null;

  async start(onSample: (sample: PoseSample) => void): Promise<void> {
    const app = littleApp();
    if (!app) throw new Error("Little isn't connected.");
    this.stop();
    this.unsubscribe = app.sense.pose((frame) => onSample(sampleFromPoseFrame(frame, performance.now() / 1000)), { fps: 24 });
  }

  stop() {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }
}
