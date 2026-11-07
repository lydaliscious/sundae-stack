// Self-hosts MediaPipe: copies the wasm runtime out of node_modules and tries to cache the pose
// model locally. Runs before dev and build. A model that cannot be downloaded is not an error:
// the browser falls back to Google's CDN for it.
import { copyFile, mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const wasmSrc = join(root, "node_modules/@mediapipe/tasks-vision/wasm");
const wasmDst = join(root, "public/mediapipe/wasm");
const modelDst = join(root, "public/mediapipe/models");

const MODELS = {
  "pose_landmarker_lite.task":
    "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
};

async function exists(path) {
  try {
    return (await stat(path)).size > 0;
  } catch {
    return false;
  }
}

try {
  await mkdir(wasmDst, { recursive: true });
  for (const name of await readdir(wasmSrc)) {
    const src = join(wasmSrc, name);
    const dst = join(wasmDst, name);
    if ((await exists(dst)) && (await stat(dst)).size === (await stat(src)).size) continue;
    await copyFile(src, dst);
  }
} catch (err) {
  console.warn(`mediapipe: could not copy the wasm runtime (${err.message}); the app will load it from the CDN`);
}

await mkdir(modelDst, { recursive: true });
for (const [name, url] of Object.entries(MODELS)) {
  const dst = join(modelDst, name);
  if (await exists(dst)) continue;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await writeFile(dst, Buffer.from(await res.arrayBuffer()));
    console.log(`mediapipe: cached ${name}`);
  } catch (err) {
    console.warn(`mediapipe: could not cache ${name} (${err.message}); the app will load it from the CDN`);
  }
}
