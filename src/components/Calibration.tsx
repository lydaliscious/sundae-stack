"use client";

import { Check, Keyboard, RotateCcw, SkipForward } from "lucide-react";
import { useEffect, useRef } from "react";
import type { GameRunner } from "@/engine/runner";
import type { CalibrationUi, TrackingUi } from "@/engine/store";
import { COCO_EDGES } from "@/input/adapters/types";
import { cn } from "@/lib/utils";
import { TvButton } from "./TvButton";

const STEPS = [
  { id: "center", title: "Stand in the middle", body: "Face the TV and hold still for a moment." },
  { id: "left", title: "Take a comfy step left", body: "One easy step to your left, then hold still." },
  { id: "right", title: "Now a step right", body: "Step across to your right and hold still." },
  { id: "test", title: "Try it out!", body: "Step around: the toddler follows you." },
] as const;

export function Calibration({
  runner,
  calibration,
  tracking,
  onStart,
  onRedo,
  onSkip,
  onKeyboard,
}: {
  runner: GameRunner;
  calibration: CalibrationUi;
  tracking: TrackingUi;
  onStart: () => void;
  onRedo: () => void;
  onSkip: () => void;
  onKeyboard: () => void;
}) {
  const stepIndex = STEPS.findIndex((s) => s.id === calibration.step);
  const step = STEPS[stepIndex];
  const ready = calibration.step === "test";
  const statusText = tracking.error
    ? tracking.error
    : tracking.starting
      ? "Starting the camera…"
      : tracking.status === "tracking"
        ? "I can see you!"
        : tracking.problem === "multiple-people"
          ? "One player at a time, please"
          : "Step into view so I can see your hips";

  return (
    <div className="absolute inset-0" data-little="region" data-little-label="Camera setup">
      <div className="hud-card absolute top-[36px] left-[48px] w-[540px] p-5">
        <PosePreview runner={runner} />
        <div
          className={cn(
            "mt-4 flex items-center gap-3 rounded-2xl px-5 py-2 text-[28px] font-semibold",
            tracking.status === "tracking" ? "bg-[#d9f6ea] text-[#24443a]" : "bg-[#ffe4ea] text-[#6b2337]",
          )}
          data-little="readout"
          data-little-label="Camera status"
          data-little-data={JSON.stringify({ status: tracking.status, problem: tracking.problem, source: tracking.source, error: tracking.error })}
        >
          <span className={cn("size-5 rounded-full", tracking.status === "tracking" ? "bg-[#3fbf8a]" : "bg-[#ff6f91]")} />
          {statusText}
        </div>
        <p className="mt-2 text-[20px] leading-snug text-[#8a6a70]">
          {tracking.source === "little-pose"
            ? "Little sends body points only; no video reaches this app."
            : "The camera picture stays on this device; only your hip position is used."}
        </p>
      </div>

      <div
        className="hud-card absolute top-[36px] right-[48px] w-[1000px] px-10 pt-7 pb-8"
        data-little="readout"
        data-little-label="Calibration step"
        data-little-data={JSON.stringify({ step: calibration.step, progress: Math.round(calibration.progress * 100) })}
      >
        <div className="flex gap-3">
          {STEPS.map((s, i) => (
            <div key={s.id} className={cn("h-[14px] flex-1 rounded-full", i < stepIndex ? "bg-[#7fd8b4]" : i === stepIndex ? "bg-[#ff5f8f]" : "bg-[#f0d9de]")} />
          ))}
        </div>
        <div className="mt-4 text-[26px] font-semibold text-[#a8848a]">
          STEP {stepIndex + 1} OF {STEPS.length}
        </div>
        <div className="flex items-baseline gap-6">
          <div className="text-[56px] leading-tight font-bold whitespace-nowrap">{step.title}</div>
        </div>
        <div className="mt-1 text-[32px]">{step.body}</div>
        {!ready && (
          <div className="mt-5 h-[28px] overflow-hidden rounded-full border-[4px] border-[#5b3a3f] bg-white">
            <div className="h-full bg-[#ff5f8f] transition-[width] duration-100" style={{ width: `${calibration.progress * 100}%` }} />
          </div>
        )}
        {ready && <TestMeter unit={calibration.unit} usedDefault={calibration.usedDefault} />}
        <div className="mt-6 flex gap-4">
          {ready && (
            <TvButton tone="candy" size="md" data-primary="" action="confirm_calibration" littleId="confirm_calibration" label="Start game" onClick={onStart}>
              <Check strokeWidth={3} /> Start game
            </TvButton>
          )}
          <TvButton tone="cream" size="md" action="redo_calibration" littleId="redo_calibration" label="Redo setup" onClick={onRedo} data-primary={ready ? undefined : ""}>
            <RotateCcw strokeWidth={2.5} /> Redo
          </TvButton>
          {!ready && (
            <TvButton tone="cream" size="md" action="skip_calibration" littleId="skip_calibration" label="Skip setup (use a default range)" onClick={onSkip}>
              <SkipForward strokeWidth={2.5} /> Skip
            </TvButton>
          )}
          <TvButton tone="mint" size="md" action="start_game" littleId="play_keyboard" label="Play with Arrow Keys instead" littleData={{ mode: "keyboard" }} onClick={onKeyboard}>
            <Keyboard strokeWidth={2.5} /> Keys instead
          </TvButton>
        </div>
      </div>
    </div>
  );
}

function TestMeter({ unit, usedDefault }: { unit: number; usedDefault: boolean }) {
  return (
    <div className="mt-4">
      <div className="relative h-[40px] rounded-full border-[4px] border-[#5b3a3f] bg-gradient-to-r from-[#ffd6e3] via-white to-[#d9f6ea]">
        <div className="absolute top-1/2 left-1/2 h-[46px] w-[4px] -translate-x-1/2 -translate-y-1/2 bg-[#5b3a3f]/40" />
        <div
          className="absolute top-1/2 size-[44px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[4px] border-[#5b3a3f] bg-[#ff5f8f]"
          style={{ left: `${((unit + 1) / 2) * 100}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between text-[24px] text-[#8a6a70]">
        <span>left</span>
        <span>{usedDefault ? "default range" : "your range"}</span>
        <span>right</span>
      </div>
    </div>
  );
}

/** Mirrored camera picture (when we own the camera) plus the tracked skeleton and hip marker. */
function PosePreview({ runner }: { runner: GameRunner }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let raf = 0;
    const W = canvas.width;
    const H = canvas.height;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      ctx.fillStyle = "#3a2b33";
      ctx.fillRect(0, 0, W, H);
      const video = runner.previewVideo;
      if (video && video.readyState >= 2) {
        // Mirror so the picture moves like a mirror (step right → picture moves right).
        const vr = video.videoWidth / video.videoHeight;
        const cr = W / H;
        const sw = vr > cr ? video.videoHeight * cr : video.videoWidth;
        const sh = vr > cr ? video.videoHeight : video.videoWidth / cr;
        ctx.save();
        ctx.translate(W, 0);
        ctx.scale(-1, 1);
        ctx.globalAlpha = 0.85;
        ctx.drawImage(video, (video.videoWidth - sw) / 2, (video.videoHeight - sh) / 2, sw, sh, 0, 0, W, H);
        ctx.restore();
      } else {
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.font = "600 26px system-ui";
        ctx.textAlign = "center";
        ctx.fillText(runner.store.get().tracking.source === "little-pose" ? "Body points from Little" : "Camera preview", W / 2, H / 2);
      }
      const s = runner.lastSample;
      if (s?.keypoints) {
        ctx.lineWidth = 6;
        ctx.lineCap = "round";
        ctx.strokeStyle = "rgba(255, 245, 250, 0.9)";
        for (const [a, b] of COCO_EDGES) {
          const p = s.keypoints[a];
          const q = s.keypoints[b];
          if (!p || !q || p.score < 0.3 || q.score < 0.3) continue;
          ctx.beginPath();
          ctx.moveTo(p.x * W, p.y * H);
          ctx.lineTo(q.x * W, q.y * H);
          ctx.stroke();
        }
      }
      if (s && Number.isFinite(s.x)) {
        ctx.fillStyle = s.confidence >= 0.5 ? "#ff5f8f" : "#ffb3c6";
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(s.x * W, (Number.isFinite(s.y) ? s.y : 0.6) * H, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = "rgba(255, 95, 143, 0.6)";
        ctx.setLineDash([12, 10]);
        ctx.beginPath();
        ctx.moveTo(s.x * W, 0);
        ctx.lineTo(s.x * W, H);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [runner]);
  return <canvas ref={ref} width={492} height={300} className="block h-[300px] w-[492px] rounded-[22px] border-[4px] border-[#5b3a3f]" aria-label="Mirrored camera preview" />;
}
