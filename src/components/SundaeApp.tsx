"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { GameRunner } from "@/engine/runner";
import { setCanvasFont } from "@/render/shapes";
import { Calibration } from "./Calibration";
import { FitStage } from "./FitStage";
import { Hud } from "./Hud";
import { LittleBridge } from "./LittleBridge";
import { Menu } from "./Menu";
import { GameOverlays } from "./Overlays";
import { PauseMenu } from "./PauseMenu";
import { Results } from "./Results";
import { useRemoteNav } from "./useRemoteNav";

declare global {
  interface Window {
    /** Debug/QA handle (browser console and headless tests). */
    __sundae?: GameRunner;
  }
}

export default function SundaeApp() {
  const [runner] = useState(() => new GameRunner());
  const ui = useSyncExternalStore(runner.store.subscribe, runner.store.get, runner.store.get);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    const family = getComputedStyle(document.documentElement).getPropertyValue("--font-fredoka");
    setCanvasFont(family);
    const canvas = canvasRef.current;
    if (!canvas) return;
    runner.attach(canvas);
    window.__sundae = runner;
    setStage(stageRef.current);
    return () => {
      runner.detach();
      delete window.__sundae;
    };
  }, [runner]);

  // Keyboard: arrows steer in a keyboard round; Escape is Back (pause / resume / menu / exit).
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (runner.key(e, true)) {
        e.preventDefault();
        return;
      }
      if (e.key !== "Escape" || e.repeat) return;
      const s = runner.store.get();
      if (s.screen === "game") {
        if (s.paused) return; // the pause dialog handles its own Escape (resume)
        runner.pause();
      } else if (s.screen === "calibrate" || s.screen === "results") {
        runner.toMenu();
      } else {
        void runner.exitApp();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (runner.key(e, false)) e.preventDefault();
    };
    // Inside Little the host reports pause/visibility itself, and its own overlays may take
    // window focus while the game is still on screen, so focus only counts in a plain browser.
    const away = (focused: boolean) =>
      runner.setAway("page", document.visibilityState !== "visible" || (!focused && !runner.store.get().hosted));
    const blur = () => away(false);
    const focus = () => away(true);
    const vis = () => away(document.hasFocus());
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", vis);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", vis);
    };
  }, [runner]);

  const navEnabled = ui.screen !== "game" || ui.paused;
  useRemoteNav(stageRef, navEnabled, `${ui.screen}:${ui.paused}:${ui.calibration.step}:${!!ui.tracking.error}`);

  return (
    <FitStage ref={stageRef}>
      <canvas ref={canvasRef} className="absolute inset-0 h-[1080px] w-[1920px]" aria-label="Sundae Stack game" role="img" />
      <div className="safe-area">
        <div className="relative h-full w-full">
          {ui.screen === "menu" && (
            <Menu
              best={ui.best}
              sound={ui.sound}
              hasResults={!!ui.results}
              onPlay={(mode) => runner.startGame(mode)}
              onSound={() => runner.toggleSound()}
              onResults={() => runner.showResults()}
            />
          )}
          {ui.screen === "calibrate" && (
            <Calibration
              runner={runner}
              calibration={ui.calibration}
              tracking={ui.tracking}
              onStart={() => runner.confirmCalibration()}
              onRedo={() => runner.redoCalibration()}
              onSkip={() => runner.skipCalibration()}
              onKeyboard={() => runner.startGame("keyboard")}
            />
          )}
          {ui.screen === "game" && (
            <div className="absolute inset-0" data-little="region" data-little-label={`Sundae Stack round (${ui.mode === "camera" ? "camera" : "arrow keys"})`}>
              <Hud hud={ui.hud} sound={ui.sound} onPause={() => runner.pause()} onSound={() => runner.toggleSound()} />
              <GameOverlays hud={ui.hud} banner={ui.banner} tracking={ui.tracking} mode={ui.mode} />
            </div>
          )}
          {ui.screen === "results" && ui.results && (
            <Results results={ui.results} onAgain={() => runner.restart()} onMenu={() => runner.toMenu()} />
          )}
        </div>
      </div>
      <PauseMenu
        open={ui.screen === "game" && ui.paused}
        container={stage}
        reason={ui.pauseReason}
        sound={ui.sound}
        camera={ui.mode === "camera"}
        onResume={() => runner.resume()}
        onRecalibrate={() => runner.recalibrate()}
        onRestart={() => runner.restart()}
        onSound={() => runner.toggleSound()}
        onMenu={() => runner.toMenu()}
      />
      <LittleBridge runner={runner} screen={ui.screen} paused={ui.paused} />
    </FitStage>
  );
}
