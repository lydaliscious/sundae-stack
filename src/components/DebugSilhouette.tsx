"use client";

import { useEffect, useRef, useState } from "react";
import type { GameRunner } from "@/engine/runner";
import { COCO_EDGES, type PreviewPoint } from "@/input/adapters/types";

const STORAGE_KEY = "sundae:debug-silhouette";
const W = 448;
const H = 252;
/** Points below this score are drawn faint and dashed: the tracker is guessing. */
const SURE = 0.5;
const NOSE = 0;
const L_SHOULDER = 5;
const R_SHOULDER = 6;
const L_HIP = 11;
const R_HIP = 12;

/**
 * A debug view of what body tracking sees: the camera picture (when the game owns the camera),
 * a filled silhouette from every keypoint, the hips the game steers by, and the tracker's status.
 * On by default in development; press D to toggle.
 */
export function DebugSilhouette({ runner }: { runner: GameRunner }) {
  // SundaeApp only renders in the browser (ssr: false), so localStorage is available here.
  const [on, setOn] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === null ? process.env.NODE_ENV !== "production" : saved === "1";
  });
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key !== "d" && e.key !== "D") return;
      const t = e.target;
      if (t instanceof HTMLElement && (t.isContentEditable || t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement)) return;
      setOn((v) => {
        localStorage.setItem(STORAGE_KEY, v ? "0" : "1");
        return !v;
      });
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  useEffect(() => {
    if (!on) return;
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let last: unknown = null;
    let frames = 0;
    let fps = 0;
    let since = performance.now();

    const draw = () => {
      raf = requestAnimationFrame(draw);
      const now = performance.now();
      const s = runner.lastSample;
      if (s && s !== last) {
        last = s;
        frames++;
      }
      if (now - since >= 1000) {
        fps = (frames * 1000) / (now - since);
        frames = 0;
        since = now;
      }

      ctx.fillStyle = "#241a22";
      ctx.fillRect(0, 0, W, H);
      const video = runner.previewVideo;
      if (video && video.readyState >= 2) {
        const vr = video.videoWidth / video.videoHeight;
        const cr = W / H;
        const sw = vr > cr ? video.videoHeight * cr : video.videoWidth;
        const sh = vr > cr ? video.videoHeight : video.videoWidth / cr;
        ctx.save();
        ctx.translate(W, 0);
        ctx.scale(-1, 1);
        ctx.globalAlpha = 0.35;
        ctx.drawImage(video, (video.videoWidth - sw) / 2, (video.videoHeight - sh) / 2, sw, sh, 0, 0, W, H);
        ctx.restore();
      }

      const kp = s?.keypoints;
      if (kp && kp.length >= 17) drawSilhouette(ctx, kp);

      // The point the game steers by.
      if (s && Number.isFinite(s.x)) {
        const sure = s.confidence >= SURE;
        ctx.strokeStyle = sure ? "rgba(255, 95, 143, 0.75)" : "rgba(255, 179, 198, 0.5)";
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 8]);
        ctx.beginPath();
        ctx.moveTo(s.x * W, 0);
        ctx.lineTo(s.x * W, H);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      const t = runner.store.get().tracking;
      const hips = s && s.people > 0 ? s.confidence.toFixed(2) : "–";
      const line1 = `${t.source ?? "no tracker"} · ${t.status}${t.problem ? ` (${t.problem})` : ""}`;
      const line2 = `hips ${hips} · people ${s?.people ?? 0} · ${fps.toFixed(0)} fps${t.error ? ` · ${t.error}` : ""}`;
      ctx.fillStyle = "rgba(20, 12, 18, 0.72)";
      ctx.fillRect(0, 0, W, 58);
      ctx.font = "600 20px ui-monospace, Menlo, monospace";
      ctx.fillStyle = t.status === "tracking" ? "#9ff0c8" : t.status === "searching" ? "#ffd27a" : "#ff9aa8";
      ctx.fillText(line1, 12, 24);
      ctx.fillStyle = "#f3e9ee";
      ctx.fillText(line2, 12, 48);
      if (!kp) {
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.font = "600 22px system-ui";
        ctx.textAlign = "center";
        ctx.fillText(t.source ? "No body points yet: step into view" : "Tracking is off (start a camera game)", W / 2, H / 2 + 20);
        ctx.textAlign = "left";
      }
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [on, runner]);

  if (!on) return null;
  return (
    <div className="pointer-events-none absolute bottom-[28px] left-[28px] z-50" aria-hidden>
      <canvas ref={ref} width={W} height={H} className="block rounded-[18px] border-[4px] border-[#5b3a3f] shadow-xl" />
      <div className="mt-1 text-center text-[18px] font-semibold text-[#5b3a3f]/70">debug silhouette · press D to hide</div>
    </div>
  );
}

function drawSilhouette(ctx: CanvasRenderingContext2D, kp: PreviewPoint[]) {
  const at = (i: number) => ({ x: kp[i].x * W, y: kp[i].y * H, score: kp[i].score });
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Torso as a filled quad between shoulders and hips.
  const quad = [at(L_SHOULDER), at(R_SHOULDER), at(R_HIP), at(L_HIP)];
  const torsoSure = Math.min(...quad.map((p) => p.score));
  ctx.fillStyle = torsoSure >= SURE ? "rgba(255, 245, 250, 0.55)" : "rgba(255, 245, 250, 0.2)";
  ctx.beginPath();
  quad.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  ctx.fill();

  // Limbs as thick capsules; guessed segments are faint and dashed.
  for (const [a, b] of COCO_EDGES) {
    const p = at(a);
    const q = at(b);
    const sure = Math.min(p.score, q.score) >= SURE;
    ctx.strokeStyle = sure ? "rgba(255, 245, 250, 0.8)" : "rgba(255, 245, 250, 0.3)";
    ctx.lineWidth = sure ? 22 : 10;
    ctx.setLineDash(sure ? [] : [8, 10]);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(q.x, q.y);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Head, sized from the shoulders.
  const ls = at(L_SHOULDER);
  const rs = at(R_SHOULDER);
  const nose = at(NOSE);
  const r = Math.max(14, Math.hypot(ls.x - rs.x, ls.y - rs.y) * 0.38);
  ctx.fillStyle = nose.score >= SURE ? "rgba(255, 245, 250, 0.8)" : "rgba(255, 245, 250, 0.3)";
  ctx.beginPath();
  ctx.arc(nose.x, nose.y, r, 0, Math.PI * 2);
  ctx.fill();

  // Hips: what the game steers by.
  for (const i of [L_HIP, R_HIP]) {
    const p = at(i);
    ctx.fillStyle = p.score >= SURE ? "#ff5f8f" : "rgba(255, 179, 198, 0.6)";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.font = "600 15px ui-monospace, Menlo, monospace";
    ctx.fillText(p.score.toFixed(2), p.x + 14, p.y + 5);
  }
}
