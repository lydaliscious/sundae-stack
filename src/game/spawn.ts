import type { GameConfig } from "./config";
import type { Rng } from "./rng";
import type { FallingItem } from "./types";

/** Seconds until an item's contact point reaches `catchY`. */
export function arrivalTime(y: number, vy: number, radius: number, catchY: number, contactFactor: number): number {
  return (catchY - (y + radius * contactFactor)) / vy;
}

export interface SpawnCandidate {
  vy: number;
  radius: number;
}

/**
 * Picks a spawn x that keeps the game fair:
 * - the next item to arrive after the latest-arriving one is reachable at a comfortable
 *   sidestep speed (|dx| ≤ comfortableSpeed × arrival gap + reachSlack);
 * - items arriving close together in time are horizontally apart, so none hides another.
 */
export function chooseSpawnX(
  rng: Rng,
  existing: readonly FallingItem[],
  candidate: SpawnCandidate,
  lastX: number,
  catchY: number,
  config: GameConfig,
): number {
  const { minX, maxX } = config.player;
  const s = config.spawn;
  const cf = config.items.contactFactor;
  const tNew = arrivalTime(s.y, candidate.vy, candidate.radius, catchY, cf);
  const live = existing.filter((it) => !it.resolved);

  // The item the player will have to come from: the latest one arriving clearly before this one.
  // Items arriving almost together are alternatives (the player picks one), so they only need to
  // be apart, not reachable from each other.
  let anchorX = lastX;
  let anchorGap = Infinity;
  for (const it of live) {
    const gap = tNew - arrivalTime(it.y, it.vy, it.radius, catchY, cf);
    if (gap >= s.overlapWindow && gap < anchorGap) {
      anchorGap = gap;
      anchorX = it.x;
    }
  }
  const reach = Number.isFinite(anchorGap) ? s.comfortableSpeed * anchorGap + s.reachSlack : Infinity;

  const close = live.filter((it) => Math.abs(tNew - arrivalTime(it.y, it.vy, it.radius, catchY, cf)) < s.overlapWindow);

  const lo = Math.max(minX, anchorX - reach);
  const hi = Math.min(maxX, anchorX + reach);
  let best = clamp(anchorX, minX, maxX);
  let bestScore = -Infinity;
  for (let i = 0; i < s.attempts; i++) {
    const x = rng.range(lo, hi);
    const gap = close.reduce((m, it) => Math.min(m, Math.abs(it.x - x)), Infinity);
    if (gap >= s.minGapX) return x;
    if (gap > bestScore) {
      bestScore = gap;
      best = x;
    }
  }
  return best;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
