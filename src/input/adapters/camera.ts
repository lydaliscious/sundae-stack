import { can, isHosted, littleApp } from "@/little/host";

export interface CameraHandle {
  stream: MediaStream;
  /** Releases the device (and, on Little, clears the on-air indicator). Idempotent. */
  stop(): void;
  source: "little" | "browser";
}

// Widescreen keeps the laptop camera's full field of view, so side steps stay in frame.
const CONSTRAINTS = { width: 1280, height: 720, fps: 30 };
const OPEN_TIMEOUT_MS = 12_000;

/** Rejects if `p` hasn't settled in time (a camera prompt nobody answers, a host without a device). */
export function withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(message)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/** Little's governed camera when granted; plain getUserMedia otherwise (local dev, browsers). */
export async function openCamera(): Promise<CameraHandle> {
  const app = littleApp();
  if (app && isHosted() && can("media.camera")) {
    const grant = await withTimeout(app.media.camera({ facing: "user", ...CONSTRAINTS }), OPEN_TIMEOUT_MS, "The camera didn't start.");
    console.info("[sundae] Little camera:", grant.ok ? "granted" : grant.error?.code);
    if (grant.ok) {
      let stopped = false;
      return {
        stream: grant.stream,
        source: "little",
        stop() {
          if (stopped) return;
          stopped = true;
          grant.stream.getTracks().forEach((t) => t.stop());
          grant.stop();
        },
      };
    }
    if (grant.error?.code === "declined" || grant.error?.code === "denied") throw new Error("Camera permission was declined.");
  }
  if (!navigator.mediaDevices?.getUserMedia) throw new Error("This browser can't open a camera.");
  try {
    const stream = await withTimeout(navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
        width: { ideal: CONSTRAINTS.width },
        height: { ideal: CONSTRAINTS.height },
        frameRate: { ideal: CONSTRAINTS.fps },
      },
      audio: false,
    }), OPEN_TIMEOUT_MS, "The camera didn't start.");
    let stopped = false;
    return {
      stream,
      source: "browser",
      stop() {
        if (stopped) return;
        stopped = true;
        stream.getTracks().forEach((t) => t.stop());
      },
    };
  } catch (err) {
    if (err instanceof Error && !(err instanceof DOMException)) throw err;
    const name = err instanceof DOMException ? err.name : "";
    if (name === "NotAllowedError") throw new Error("Camera permission was declined.");
    if (name === "NotFoundError" || name === "OverconstrainedError") throw new Error("No camera found.");
    if (name === "NotReadableError") throw new Error("The camera is busy in another app.");
    throw new Error("Couldn't start the camera.");
  }
}
