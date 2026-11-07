import { can, isHosted, littleApp } from "@/little/host";

export interface CameraHandle {
  stream: MediaStream;
  /** Releases the device (and, on Little, clears the on-air indicator). Idempotent. */
  stop(): void;
  source: "little" | "browser";
}

const CONSTRAINTS = { width: 640, height: 480, fps: 30 };

/** Little's governed camera when granted; plain getUserMedia otherwise (local dev, browsers). */
export async function openCamera(): Promise<CameraHandle> {
  const app = littleApp();
  if (app && isHosted() && can("media.camera")) {
    const grant = await app.media.camera({ facing: "user", ...CONSTRAINTS });
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
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
        width: { ideal: CONSTRAINTS.width },
        height: { ideal: CONSTRAINTS.height },
        frameRate: { ideal: CONSTRAINTS.fps },
      },
      audio: false,
    });
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
    const name = err instanceof DOMException ? err.name : "";
    if (name === "NotAllowedError") throw new Error("Camera permission was declined.");
    if (name === "NotFoundError" || name === "OverconstrainedError") throw new Error("No camera found.");
    if (name === "NotReadableError") throw new Error("The camera is busy in another app.");
    throw new Error("Couldn't start the camera.");
  }
}
