"use client";

import { Crosshair, Home, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { TvButton } from "./TvButton";

export function PauseMenu({
  open,
  container,
  reason,
  sound,
  camera,
  onResume,
  onRecalibrate,
  onRestart,
  onSound,
  onMenu,
}: {
  open: boolean;
  container: HTMLElement | null;
  reason: "user" | "away" | null;
  sound: boolean;
  camera: boolean;
  onResume: () => void;
  onRecalibrate: () => void;
  onRestart: () => void;
  onSound: () => void;
  onMenu: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onResume()}>
      <DialogContent
        container={container}
        showCloseButton={false}
        className="hud-card w-[760px] max-w-none gap-0 rounded-[40px] bg-[#fffaf5] px-12 py-10 text-[#5b3a3f] ring-0 sm:max-w-none"
        data-little="region"
        data-little-label="Pause menu"
      >
        <DialogTitle className="font-sans text-[72px] leading-none font-bold">Paused</DialogTitle>
        <DialogDescription className="mt-3 text-[32px] text-[#8a6a70]">
          {reason === "away" ? "We paused while you were away. The timer is frozen." : "The timer is frozen. Take your time!"}
        </DialogDescription>
        <div className="mt-8 grid grid-cols-2 gap-5">
          <TvButton tone="candy" size="lg" className="col-span-2" data-primary="" action="resume" label="Resume" onClick={onResume} autoFocus>
            <Play strokeWidth={2.5} className="size-11" /> Resume
          </TvButton>
          {camera && (
            <TvButton tone="mint" size="md" className="col-span-2" action="recalibrate" label="Recalibrate camera" onClick={onRecalibrate}>
              <Crosshair strokeWidth={2.5} /> Recalibrate camera
            </TvButton>
          )}
          <TvButton tone="cream" size="md" action="restart" label="Restart round" onClick={onRestart}>
            <RotateCcw strokeWidth={2.5} /> Restart
          </TvButton>
          <TvButton tone="cream" size="md" action="toggle_sound" label={sound ? "Sound on (turn off)" : "Sound off (turn on)"} littleData={{ on: !sound }} onClick={onSound}>
            {sound ? <Volume2 strokeWidth={2.5} /> : <VolumeX strokeWidth={2.5} />} Sound {sound ? "on" : "off"}
          </TvButton>
          <TvButton tone="cream" size="md" className="col-span-2" action="back_to_menu" label="Quit to menu" onClick={onMenu}>
            <Home strokeWidth={2.5} /> Quit to menu
          </TvButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}
