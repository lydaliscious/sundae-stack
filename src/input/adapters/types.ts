import type { HipSample } from "../tracking";

/** A body keypoint in viewer space (mirrored, 0..1), for the calibration preview. */
export interface PreviewPoint {
  x: number;
  y: number;
  score: number;
}

export interface PoseSample extends HipSample {
  /** Viewer-space hip midpoint height (0 top … 1 bottom). */
  y: number;
  /** All keypoints of the tracked body (viewer space) for drawing a skeleton; optional. */
  keypoints?: PreviewPoint[];
}

export type AdapterKind = "little-pose" | "mediapipe";

/**
 * The replaceable body-tracking source. Implementations stream hip midpoints (already mirrored
 * into viewer space) with a confidence and a body count; they never decide gameplay.
 */
export interface PoseInputAdapter {
  readonly kind: AdapterKind;
  /** A live, un-mirrored camera element when the adapter owns one (for the preview). */
  readonly video: HTMLVideoElement | null;
  start(onSample: (sample: PoseSample) => void): Promise<void>;
  /** Stops tracking and releases the camera. Idempotent. */
  stop(): void;
}

/** COCO-17 skeleton edges (Little `sense.pose` order), used by the preview. */
export const COCO_EDGES: [number, number][] = [
  [5, 6],
  [5, 7],
  [7, 9],
  [6, 8],
  [8, 10],
  [5, 11],
  [6, 12],
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
];
