import type { NormalizedLandmark, PoseLandmarker } from "@mediapipe/tasks-vision";
import { hipMidpoint, mirrorX } from "../mapping";
import { openCamera, withTimeout, type CameraHandle } from "./camera";
import type { PoseInputAdapter, PoseSample, PreviewPoint } from "./types";

const VERSION = "1.2.2";
const LOCAL_WASM = "/mediapipe/wasm";
const CDN_WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`;
const MODEL = {
  local: "/mediapipe/models/pose_landmarker_lite.task",
  cdn: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
};

/** BlazePose (33 landmarks) → COCO-17 order, so both adapters share one skeleton. */
const BLAZE_TO_COCO = [0, 2, 5, 7, 8, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
const LEFT_HIP = 23;
const RIGHT_HIP = 24;
/** A detected body only counts as a person when its torso is reasonably visible. */
const PERSON_VISIBILITY = 0.5;

async function reachable(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD", cache: "force-cache" });
    return res.ok;
  } catch {
    return false;
  }
}

/** The wasm runtime reports routine "INFO: …" lines through console.error. */
let quieted = false;
function quietRuntimeInfo() {
  if (quieted) return;
  quieted = true;
  const original = console.error;
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === "string" && args[0].startsWith("INFO: ")) return;
    original(...args);
  };
}

let landmarkerPromise: Promise<PoseLandmarker> | null = null;

/** Self-hosted wasm + model (scripts/copy-mediapipe.mjs) first, Google's CDN as a fallback. */
function loadLandmarker(): Promise<PoseLandmarker> {
  landmarkerPromise ??= (async () => {
    quietRuntimeInfo();
    const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
    const [wasmBase, model] = await Promise.all([
      reachable(`${LOCAL_WASM}/vision_wasm_internal.js`).then((ok) => (ok ? LOCAL_WASM : CDN_WASM)),
      reachable(MODEL.local).then((ok) => (ok ? MODEL.local : MODEL.cdn)),
    ]);
    const files = await FilesetResolver.forVisionTasks(wasmBase);
    const create = (delegate: "GPU" | "CPU") =>
      PoseLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: model, delegate },
        runningMode: "VIDEO",
        numPoses: 2,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
    try {
      return await create("GPU");
    } catch {
      return await create("CPU");
    }
  })();
  landmarkerPromise.catch(() => {
    landmarkerPromise = null;
  });
  return landmarkerPromise;
}

const vis = (l: NormalizedLandmark | undefined) => (l ? (l.visibility ?? 0) : 0);

/** Pure conversion from MediaPipe pose landmarks to a viewer-space hip sample. */
export function sampleFromLandmarks(poses: NormalizedLandmark[][], t: number): PoseSample {
  const people = poses.filter((p) => Math.max(vis(p[11]), vis(p[12]), vis(p[LEFT_HIP]), vis(p[RIGHT_HIP])) >= PERSON_VISIBILITY).length;
  const body = poses[0];
  if (!body || people === 0) return { t, x: NaN, y: NaN, confidence: 0, people: 0 };
  const l = body[LEFT_HIP];
  const r = body[RIGHT_HIP];
  const keypoints: PreviewPoint[] = BLAZE_TO_COCO.map((i) => ({ x: mirrorX(body[i].x), y: body[i].y, score: vis(body[i]) }));
  return {
    t,
    x: mirrorX(hipMidpoint(l, r)),
    y: (l.y + r.y) / 2,
    confidence: Math.min(vis(l), vis(r)),
    people,
    keypoints,
  };
}

/**
 * Browser fallback: MediaPipe Pose Landmarker on a local camera stream. Frames are processed in
 * this page only and never leave the device.
 */
export class MediaPipePoseAdapter implements PoseInputAdapter {
  readonly kind = "mediapipe" as const;
  video: HTMLVideoElement | null = null;
  private camera: CameraHandle | null = null;
  private raf = 0;
  private running = false;
  private lastTs = -1;

  async start(onSample: (sample: PoseSample) => void): Promise<void> {
    this.stop();
    this.running = true;
    const [cam, lm] = await Promise.allSettled([openCamera(), loadLandmarker()]);
    if (cam.status === "rejected" || lm.status === "rejected") {
      if (cam.status === "fulfilled") cam.value.stop();
      throw cam.status === "rejected" ? cam.reason : lm.status === "rejected" ? lm.reason : new Error("Body tracking failed.");
    }
    const camera = cam.value;
    const landmarker = lm.value;
    console.info("[sundae] MediaPipe ready, camera from", camera.source);
    if (!this.running) {
      camera.stop();
      return;
    }
    this.camera = camera;
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.srcObject = camera.stream;
    await withTimeout(video.play(), 8000, "The camera picture didn't start.");
    this.video = video;

    let lastFrameTime = -1;
    const loop = () => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      if (video.readyState < 2 || video.currentTime === lastFrameTime) return;
      lastFrameTime = video.currentTime;
      const now = performance.now();
      const ts = Math.max(now, this.lastTs + 1);
      this.lastTs = ts;
      try {
        const result = landmarker.detectForVideo(video, ts);
        onSample(sampleFromLandmarks(result.landmarks, now / 1000));
      } catch {
        onSample({ t: now / 1000, x: NaN, y: NaN, confidence: 0, people: 0 });
      }
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.camera?.stop();
    this.camera = null;
    if (this.video) {
      this.video.pause();
      this.video.srcObject = null;
    }
    this.video = null;
  }
}
