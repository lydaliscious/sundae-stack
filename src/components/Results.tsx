"use client";

import { Home, RotateCcw } from "lucide-react";
import type { Results as ResultsState } from "@/engine/store";
import { TvButton } from "./TvButton";

export function Results({ results, onAgain, onMenu }: { results: ResultsState; onAgain: () => void; onMenu: () => void }) {
  const shown = results.sundaes.slice(-12);
  return (
    <div className="absolute inset-0" data-little="region" data-little-label="Results">
      <div className="hud-card pop-in absolute top-[60px] left-[60px] w-[620px] px-10 py-9">
        <div className="text-[34px] font-semibold tracking-wide text-[#a8848a]">{results.reason === "time" ? "TIME'S UP!" : "THREE SPILLS!"}</div>
        <div
          className="mt-1 flex items-baseline gap-4"
          data-little="readout"
          data-little-label="Final score"
          data-little-data={JSON.stringify({ score: results.score, best: results.best, newBest: results.newBest, sundaes: results.sundaes.length })}
        >
          <span className="tabular text-[120px] leading-none font-bold text-[#ff5f8f]">{results.score}</span>
          <span className="text-[36px] font-semibold">points</span>
        </div>
        {results.newBest ? (
          <div className="rainbow-bg mt-4 inline-block rounded-full px-6 py-2 text-[34px] font-bold text-white [text-shadow:0_3px_0_rgba(91,58,63,0.45)]">
            New best score!
          </div>
        ) : (
          <div className="mt-4 text-[34px]">
            Best: <span className="font-bold">{results.best}</span>
          </div>
        )}
        <div className="mt-4 text-[36px]">
          {results.sundaes.length === 0
            ? "No sundaes served this time. Catch a cherry once the sundae has three scoops!"
            : `${results.sundaes.length} sundae${results.sundaes.length === 1 ? "" : "s"} served`}
        </div>
        <div className="mt-8 flex flex-col gap-5">
          <TvButton tone="candy" size="lg" data-primary="" action="restart" label="Play again" onClick={onAgain}>
            <RotateCcw strokeWidth={2.5} className="size-11" /> Play again
          </TvButton>
          <TvButton tone="cream" size="md" action="back_to_menu" label="Main menu" onClick={onMenu}>
            <Home strokeWidth={2.5} /> Menu
          </TvButton>
        </div>
      </div>

      <div className="hud-card absolute top-[60px] right-[60px] w-[700px] px-8 py-7" data-little="region" data-little-label="Sundaes served">
        <div className="text-[40px] font-bold">Your sundaes</div>
        {shown.length === 0 ? (
          <div className="mt-6 text-[30px] text-[#8a6a70]">Your finished sundaes will line up here.</div>
        ) : (
          <div className="mt-4 grid grid-cols-4 gap-x-3 gap-y-4">
            {shown.map((s) => (
              <figure
                key={s.id}
                className="flex flex-col items-center rounded-[22px] bg-[#fff1f4] px-1 pt-2 pb-2"
                data-little="item"
                data-little-id={`sundae_${s.id}`}
                data-little-label={`Sundae ${s.id}`}
                data-little-caption={s.caption}
                data-little-data={JSON.stringify({ points: s.points, scoops: s.scoops, rainbow: s.rainbow })}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- generated data URL */}
                <img src={s.image} alt={s.caption} width={150} height={190} className="h-[190px] w-[150px] object-contain" />
                <figcaption className="text-[28px] font-bold text-[#ff5f8f]">
                  +{s.points}
                  {s.rainbow && <span className="rainbow-bg ml-2 rounded-full px-2 text-[18px] text-white">R</span>}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
