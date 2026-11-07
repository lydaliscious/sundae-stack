"use client";

import {
  configureLittle,
  useLittleActiveTools,
  useLittleApp,
  useLittleEnter,
  useLittleTool,
  useLittleVisible,
} from "@kabletv/little-react";
import { useEffect } from "react";
import type { ActionOutcome, GameRunner } from "@/engine/runner";
import type { Mode, Screen } from "@/engine/store";
import { markEntered, setLittleApp } from "@/little/host";

configureLittle({ devScale: false });

type Args = Record<string, unknown>;

const asMode = (v: unknown): Mode | null => (v === "camera" || v === "keyboard" ? v : null);
const reply = (r: ActionOutcome) => (r.ok ? { ok: true, ...(r.say ? { say: r.say } : {}) } : { ok: false, detail: r.detail ?? "That isn't possible right now." });

const COMMON = ["toggle_sound", "get_game_status"];
function toolsFor(screen: Screen, paused: boolean, hasResults: boolean): string[] {
  switch (screen) {
    case "menu":
      return ["start_game", ...(hasResults ? ["show_results"] : []), ...COMMON];
    case "calibrate":
      return ["confirm_calibration", "redo_calibration", "skip_calibration", "start_game", "back_to_menu", ...COMMON];
    case "game":
      return paused
        ? ["resume", "restart", "recalibrate", "back_to_menu", ...COMMON]
        : ["pause", "restart", "recalibrate", "back_to_menu", ...COMMON];
    case "results":
      return ["restart", "start_game", "show_results", "back_to_menu", ...COMMON];
  }
}

/**
 * Little wiring: every manifest tool lands on the same runner action as the on-screen buttons
 * and the remote, so the agent and the viewer can never get out of step.
 */
export function LittleBridge({ runner, screen, paused }: { runner: GameRunner; screen: Screen; paused: boolean }) {
  const app = useLittleApp();
  const visible = useLittleVisible();

  useEffect(() => {
    setLittleApp(app);
    return () => setLittleApp(null);
  }, [app]);

  useEffect(() => {
    runner.setAway("little", !visible);
  }, [runner, visible]);

  useLittleEnter<{ mode?: string }>((info) => {
    markEntered(info.granted);
    console.info("[sundae] Little granted:", info.granted, "denied:", info.denied);
    runner.store.set({ hosted: true });
    const saved = (info.state ?? {}) as { sound?: unknown; mode?: unknown };
    if (typeof saved.sound === "boolean" && saved.sound !== runner.store.get().sound) runner.toggleSound(saved.sound);
    const savedMode = asMode(saved.mode);
    if (savedMode) runner.store.set({ mode: savedMode });
    const mode = asMode(info.params?.mode);
    if (mode) runner.startGame(mode);
  });

  // Saved state is "where the viewer was": their input mode and sound preference.
  useEffect(() => {
    let last = "";
    return runner.store.subscribe(() => {
      const s = runner.store.get();
      const next = JSON.stringify({ mode: s.mode, sound: s.sound });
      if (next === last || !s.hosted) return;
      last = next;
      void app.saveState({ mode: s.mode, sound: s.sound });
    });
  }, [runner, app]);

  useLittleActiveTools(toolsFor(screen, paused, !!runner.store.get().results));

  useLittleTool<Args>("start_game", (a) => reply(runner.startGame(asMode(a.mode) ?? runner.store.get().mode)));
  useLittleTool("pause", () => reply(runner.pause()));
  useLittleTool("resume", () => reply(runner.resume()));
  useLittleTool("restart", () => reply(runner.restart()));
  useLittleTool("recalibrate", () => reply(runner.recalibrate()));
  useLittleTool("confirm_calibration", () => reply(runner.confirmCalibration()));
  useLittleTool("redo_calibration", () => reply(runner.redoCalibration()));
  useLittleTool("skip_calibration", () => reply(runner.skipCalibration()));
  useLittleTool("back_to_menu", () => reply(runner.toMenu()));
  useLittleTool("show_results", () => reply(runner.showResults()));
  useLittleTool<Args>("toggle_sound", (a) => reply(runner.toggleSound(typeof a.on === "boolean" ? a.on : undefined)));
  useLittleTool("get_game_status", () => ({ ok: true, detail: JSON.stringify(runner.status()) }));

  return null;
}
