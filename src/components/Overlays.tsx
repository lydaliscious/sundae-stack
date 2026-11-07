"use client";

import type { Banner, Hud, TrackingUi } from "@/engine/store";
import { cn } from "@/lib/utils";
import { ItemIcon } from "./ItemIcon";

/** "Catch ice cream. Dodge toys. Add a cherry to finish!" before the first countdown. */
export function IntroCard() {
  return (
    <div
      className="hud-card pop-in absolute top-[230px] left-1/2 w-[1180px] -translate-x-1/2 px-14 py-10 text-center"
      data-little="readout"
      data-little-label="Instructions"
      data-little-data={JSON.stringify({ text: "Catch ice cream. Dodge toys. Add a cherry to finish!" })}
    >
      <div className="text-[64px] leading-tight font-bold">
        Catch ice cream. <span className="text-[#e8457a]">Dodge toys.</span> Add a cherry to finish!
      </div>
      <div className="mt-6 flex items-end justify-center gap-10 text-[28px] font-medium">
        <Legend label="Scoops +10">
          <ItemIcon kind="scoop" variant="strawberry" label="Strawberry scoop" />
        </Legend>
        <Legend label="Toppings +5">
          <ItemIcon kind="topping" variant="sprinkles" label="Sprinkles" />
        </Legend>
        <Legend label="Cherry serves it">
          <ItemIcon kind="cherry" variant="cherry" label="Cherry" />
        </Legend>
        <Legend label="Toys spill it!">
          <ItemIcon kind="toy" variant="ball" label="Toy ball" />
        </Legend>
      </div>
    </div>
  );
}

function Legend({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1">
      {children}
      <span>{label}</span>
    </div>
  );
}

export function Countdown({ value, resume }: { value: number; resume: boolean }) {
  return (
    <div
      className="absolute top-[250px] left-1/2 flex -translate-x-1/2 flex-col items-center"
      data-little="readout"
      data-little-label={resume ? "Resuming in" : "Starting in"}
      data-little-data={JSON.stringify({ seconds: value })}
    >
      <div
        key={value}
        className="count-pulse flex size-[260px] items-center justify-center rounded-full border-[8px] border-[#5b3a3f] bg-white text-[170px] leading-none font-bold text-[#ff5f8f] shadow-[0_12px_0_rgba(91,58,63,0.25)]"
      >
        {value}
      </div>
      <div className="hud-card mt-6 px-8 py-3 text-[38px] font-semibold">{resume ? "Get ready…" : "Here we go!"}</div>
    </div>
  );
}

export function BannerPill({ banner }: { banner: Banner }) {
  return (
    <div
      key={banner.id}
      className={cn(
        "pop-in absolute top-[230px] -translate-x-1/2 rounded-full border-[5px] border-[#5b3a3f] px-10 py-4 text-[50px] font-bold whitespace-nowrap shadow-[0_8px_0_rgba(91,58,63,0.25)]",
        banner.side === "left" ? "left-[560px]" : "left-[1360px]",
        banner.tone === "good" && "bg-[#7fd8b4] text-[#24443a]",
        banner.tone === "bad" && "bg-[#ffb3c6] text-[#6b2337]",
        banner.tone === "info" && "bg-white text-[#5b3a3f]",
        banner.tone === "rainbow" && "rainbow-bg text-white [text-shadow:0_3px_0_rgba(91,58,63,0.5)]",
      )}
      data-little="readout"
      data-little-label="Announcement"
      data-little-data={JSON.stringify({ text: banner.text })}
    >
      {banner.text}
    </div>
  );
}

const PROBLEM_TEXT: Record<string, string> = {
  "no-body": "We can't see you. Step back in front of the TV.",
  "low-confidence": "Step back a little so your hips are in view.",
  "multiple-people": "Just one player at a time, please!",
  jump: "Hold still for a moment…",
  stale: "Waiting for the camera…",
};

/** Shown whenever tracking freezes a camera round. */
export function TrackingLost({ tracking }: { tracking: TrackingUi }) {
  const text = tracking.error ?? PROBLEM_TEXT[tracking.problem ?? "no-body"] ?? PROBLEM_TEXT["no-body"];
  return (
    <div
      className="hud-card pop-in absolute top-[260px] left-1/2 w-[980px] -translate-x-1/2 px-12 py-9 text-center"
      data-little="readout"
      data-little-label="Tracking paused"
      data-little-data={JSON.stringify({ problem: tracking.problem, status: tracking.status })}
    >
      <div className="text-[34px] font-semibold tracking-wide text-[#a8848a]">GAME FROZEN</div>
      <div className="mt-2 text-[56px] leading-tight font-bold">{text}</div>
      <div className="mt-4 text-[32px] text-[#8a6a70]">Nothing is lost: the timer and your bowls wait for you.</div>
    </div>
  );
}

export function GameOverlays({ hud, banner, tracking, mode }: { hud: Hud; banner: Banner | null; tracking: TrackingUi; mode: "camera" | "keyboard" }) {
  const trackingFrozen = mode === "camera" && hud.frozen && tracking.status !== "tracking";
  return (
    <>
      {hud.phase === "intro" && !trackingFrozen && <IntroCard />}
      {hud.countdown > 0 && !hud.frozen && <Countdown value={hud.countdown} resume={hud.phase !== "countdown"} />}
      {trackingFrozen && <TrackingLost tracking={tracking} />}
      {banner && !trackingFrozen && hud.countdown === 0 && <BannerPill banner={banner} />}
    </>
  );
}
