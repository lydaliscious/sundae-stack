"use client";

import { Camera, Keyboard, Volume2, VolumeX, Trophy } from "lucide-react";
import { ItemIcon } from "./ItemIcon";
import { TvButton } from "./TvButton";

export function Menu({
  best,
  sound,
  hasResults,
  onPlay,
  onSound,
  onResults,
}: {
  best: number;
  sound: boolean;
  hasResults: boolean;
  onPlay: (mode: "camera" | "keyboard") => void;
  onSound: () => void;
  onResults: () => void;
}) {
  return (
    <div className="absolute inset-0" data-little="region" data-little-label="Main menu">
      <div className="absolute top-[86px] left-1/2 -translate-x-1/2 text-center">
        <h1 className="candy-title text-[150px] leading-none font-bold">Sundae Stack</h1>
        <p className="mt-6 text-[40px] font-medium">Step left and right to build the tallest sundae!</p>
      </div>

      <div className="absolute top-[400px] left-[90px] flex w-[600px] flex-col gap-7">
        <TvButton
          tone="candy"
          size="lg"
          data-primary=""
          action="start_game"
          littleId="play_camera"
          label="Play with Camera"
          littleData={{ mode: "camera" }}
          onClick={() => onPlay("camera")}
        >
          <Camera strokeWidth={2.5} className="size-12" /> Play with Camera
        </TvButton>
        <TvButton
          tone="mint"
          size="md"
          action="start_game"
          littleId="play_keyboard"
          label="Play with Arrow Keys"
          littleData={{ mode: "keyboard" }}
          onClick={() => onPlay("keyboard")}
        >
          <Keyboard strokeWidth={2.5} /> Play with Arrow Keys
        </TvButton>
        <div className="flex gap-6">
          <TvButton
            tone="cream"
            size="md"
            className="flex-1"
            action="toggle_sound"
            label={sound ? "Sound on (turn off)" : "Sound off (turn on)"}
            littleData={{ on: sound }}
            onClick={onSound}
          >
            {sound ? <Volume2 strokeWidth={2.5} /> : <VolumeX strokeWidth={2.5} />} Sound {sound ? "on" : "off"}
          </TvButton>
          {hasResults && (
            <TvButton tone="cream" size="md" action="show_results" label="Last results" onClick={onResults}>
              <Trophy strokeWidth={2.5} /> Results
            </TvButton>
          )}
        </div>
      </div>

      <div className="hud-card absolute top-[400px] right-[90px] w-[600px] px-10 py-8" data-little="region" data-little-label="How to play">
        <div className="text-[40px] font-bold">How to play</div>
        <ul className="mt-3 space-y-2 text-[30px] leading-snug">
          <li className="flex items-center gap-4">
            <ItemIcon kind="scoop" variant="mint" size={74} label="Scoop" /> Catch scoops and toppings
          </li>
          <li className="flex items-center gap-4">
            <ItemIcon kind="toy" variant="block" size={74} label="Toy block" /> Dodge falling toys
          </li>
          <li className="flex items-center gap-4">
            <ItemIcon kind="cherry" variant="cherry" size={74} label="Cherry" /> Cherry on top serves it
          </li>
        </ul>
        <div
          className="mt-5 flex items-baseline gap-4 border-t-4 border-dashed border-[#f0d9de] pt-4"
          data-little="readout"
          data-little-label="Best score"
          data-little-data={JSON.stringify({ best })}
        >
          <span className="text-[30px] font-semibold text-[#a8848a]">BEST</span>
          <span className="tabular text-[56px] font-bold text-[#ff5f8f]">{best}</span>
        </div>
      </div>
    </div>
  );
}
