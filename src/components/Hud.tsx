"use client";

import { Pause, Volume2, VolumeX } from "lucide-react";
import { FLAVORS, type Flavor } from "@/game/types";
import type { Hud as HudState } from "@/engine/store";
import { FLAVOR } from "@/render/palette";
import { cn } from "@/lib/utils";
import { TvButton } from "./TvButton";

export function Hud({ hud, sound, onPause, onSound }: { hud: HudState; sound: boolean; onPause: () => void; onSound: () => void }) {
  const secs = Math.ceil(hud.timeLeft);
  const timeText = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
  const low = secs <= 10 && hud.phase === "playing";
  return (
    <>
      {/* Banked score + the current sundae's pending value. */}
      <div
        className="hud-card absolute top-[26px] left-[36px] min-w-[500px] px-8 pt-4 pb-5"
        data-little="region"
        data-little-label="Score"
      >
        <div
          className="flex items-baseline gap-4"
          data-little="readout"
          data-little-label="Banked score"
          data-little-data={JSON.stringify({ score: hud.banked, sundaesServed: hud.served })}
        >
          <span className="text-[30px] font-semibold tracking-wide text-[#a8848a]">SCORE</span>
          <span className="tabular text-[76px] leading-none font-bold text-[#ff5f8f]">{hud.banked}</span>
        </div>
        <div
          className="mt-2 flex items-center gap-4"
          data-little="readout"
          data-little-label="This sundae"
          data-little-data={JSON.stringify({
            pending: hud.pending,
            scoops: hud.scoops,
            toppings: hud.toppings,
            flavors: hud.flavors,
            rainbow: hud.rainbow,
            cherryFalling: hud.cherryFalling,
          })}
        >
          <span className="text-[30px] font-medium whitespace-nowrap">This sundae</span>
          <span className="tabular text-[40px] font-bold text-[#7a55d8]">+{hud.pending}</span>
          <FlavorDots flavors={hud.flavors} />
          {hud.rainbow && <span className="rainbow-bg rounded-full px-3 py-1 text-[22px] font-bold text-white">Rainbow</span>}
        </div>
      </div>

      {/* Round clock. */}
      <div
        className={cn("hud-card absolute top-[26px] left-1/2 w-[260px] -translate-x-1/2 px-6 py-3 text-center", low && "bg-[#ffe4ea]")}
        data-little="readout"
        data-little-label="Time left"
        data-little-data={JSON.stringify({ secondsLeft: secs })}
      >
        <div className={cn("tabular text-[78px] leading-none font-bold", low ? "text-[#e8457a]" : "text-[#5b3a3f]")}>{timeText}</div>
        <div className="mt-2 h-[12px] overflow-hidden rounded-full bg-[#f3dfe3]">
          <div className="h-full rounded-full bg-[#7fd8b4]" style={{ width: `${(hud.timeLeft / 60) * 100}%` }} />
        </div>
      </div>

      {/* Spills left, then the big pause and sound controls. */}
      <div className="absolute top-[26px] right-[36px] flex flex-col items-end gap-5">
        <div
          className="hud-card flex items-center gap-3 px-6 py-4"
          data-little="readout"
          data-little-label="Spills left"
          data-little-data={JSON.stringify({ spillsLeft: hud.spillsLeft, spills: hud.spills })}
        >
          {[0, 1, 2].map((i) => (
            <BowlIcon key={i} crossed={i >= hud.spillsLeft} />
          ))}
        </div>
        <div className="flex gap-4">
          <TvButton size="icon" tone="cream" action="pause" label="Pause" aria-label="Pause" onClick={onPause}>
            <Pause className="size-12" strokeWidth={3} />
          </TvButton>
          <TvButton
            size="icon"
            tone="cream"
            action="toggle_sound"
            label={sound ? "Sound on (turn off)" : "Sound off (turn on)"}
            littleData={{ on: !sound }}
            aria-label={sound ? "Turn sound off" : "Turn sound on"}
            onClick={onSound}
          >
            {sound ? <Volume2 className="size-12" strokeWidth={3} /> : <VolumeX className="size-12" strokeWidth={3} />}
          </TvButton>
        </div>
      </div>
    </>
  );
}

export function FlavorDots({ flavors, size = 30 }: { flavors: readonly Flavor[]; size?: number }) {
  return (
    <span className="flex items-center gap-[6px]" aria-label={`Flavors: ${flavors.join(", ") || "none"}`}>
      {FLAVORS.map((f) => {
        const on = flavors.includes(f);
        return (
          <span
            key={f}
            title={FLAVOR[f].label}
            className="inline-block rounded-full border-[4px]"
            style={{
              width: size,
              height: size,
              background: on ? FLAVOR[f].base : "transparent",
              borderColor: on ? "#5b3a3f" : "#e4cfd3",
            }}
          />
        );
      })}
    </span>
  );
}

function BowlIcon({ crossed }: { crossed: boolean }) {
  return (
    <svg width="78" height="62" viewBox="0 0 78 62" aria-hidden className={crossed ? "opacity-45" : ""}>
      <ellipse cx="39" cy="18" rx="34" ry="8" fill="#8fcdf2" stroke="#5b3a3f" strokeWidth="4" />
      <path d="M5 18 C5 40 22 48 39 48 C56 48 73 40 73 18 Z" fill="#bfe7ff" stroke="#5b3a3f" strokeWidth="4" strokeLinejoin="round" />
      <path d="M8 28 C20 36 58 36 70 28" stroke="#ff9ec2" strokeWidth="7" fill="none" />
      <ellipse cx="39" cy="54" rx="14" ry="5" fill="#f2759f" stroke="#5b3a3f" strokeWidth="3" />
      {crossed && (
        <g stroke="#e8457a" strokeWidth="8" strokeLinecap="round">
          <line x1="12" y1="6" x2="66" y2="56" />
          <line x1="66" y1="6" x2="12" y2="56" />
        </g>
      )}
    </svg>
  );
}
