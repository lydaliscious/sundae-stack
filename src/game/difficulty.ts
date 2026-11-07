import type { DifficultyBand, GameConfig } from "./config";

/** The spawn rhythm at a given number of active seconds into the round. */
export function difficultyAt(activeTime: number, config: GameConfig): DifficultyBand {
  const { early, late, switchAt, mode, blendSeconds } = config.difficulty;
  if (mode === "step" || blendSeconds <= 0) return activeTime < switchAt ? { ...early } : { ...late };
  const t = clamp01((activeTime - (switchAt - blendSeconds / 2)) / blendSeconds);
  return {
    spawnInterval: lerp(early.spawnInterval, late.spawnInterval, t),
    fallSeconds: lerp(early.fallSeconds, late.fallSeconds, t),
    toyShare: lerp(early.toyShare, late.toyShare, t),
  };
}

/** Fall speed in px/s for a full-screen fall time. */
export function fallSpeed(fallSeconds: number, worldHeight: number): number {
  return worldHeight / fallSeconds;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
