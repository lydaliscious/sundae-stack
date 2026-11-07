import { DEFAULT_CONFIG, WORLD, type GameConfig } from "./config";
import { crossSurface } from "./collision";
import { difficultyAt, fallSpeed } from "./difficulty";
import { createRng } from "./rng";
import { chooseSpawnX } from "./spawn";
import { addSpeckles } from "./speckles";
import { layoutStack } from "./stack";
import {
  FLAVORS,
  TOPPINGS,
  TOYS,
  type FallingItem,
  type Flavor,
  type GameEvent,
  type GameState,
  type HoldReason,
  type ItemKind,
  type Phase,
  type StepInput,
  type Sundae,
  type SundaeRecord,
  type Topping,
} from "./types";

/**
 * The pure gameplay core. `stepGame` advances one fixed timestep and returns what happened; it
 * never touches the DOM, the clock or Math.random, so a seed + an input sequence always replays
 * the same round.
 */

const emptySundae = (): Sundae => ({ scoops: [], points: 0, rainbow: false });

export function createGame(seed = 1, config: GameConfig = DEFAULT_CONFIG): GameState {
  return {
    config,
    rng: createRng(seed),
    phase: "idle",
    phaseTime: 0,
    activeTime: 0,
    holds: new Set(),
    resumeCountdown: 0,
    playerX: config.player.startX,
    items: [],
    nextItemId: 1,
    spawnTimer: 0,
    lastSpawnX: config.player.startX,
    cherryAt: null,
    sundae: emptySundae(),
    banked: 0,
    spills: 0,
    served: [],
    speckles: [],
    nextSpeckleId: 1,
    endReason: null,
    lastSpill: null,
  };
}

/** Starts (or restarts) a round: everything resets, including the face and the bowl. */
export function startRound(state: GameState, opts: { seed?: number; skipIntro?: boolean } = {}): GameEvent[] {
  const fresh = createGame(opts.seed ?? state.rng.seed, state.config);
  Object.assign(state, fresh, { playerX: state.playerX });
  return setPhase(state, opts.skipIntro ? "countdown" : "intro");
}

export function pendingValue(s: GameState): number {
  return s.sundae.points + (s.sundae.rainbow ? s.config.points.rainbow : 0);
}

export function timeLeft(s: GameState): number {
  return Math.max(0, s.config.roundSeconds - s.activeTime);
}

export function spillsLeft(s: GameState): number {
  return Math.max(0, s.config.maxSpills - s.spills);
}

export function distinctFlavors(sundae: Sundae): Flavor[] {
  return [...new Set(sundae.scoops.map((sc) => sc.flavor))];
}

export function isFrozen(s: GameState): boolean {
  return s.holds.size > 0 || s.resumeCountdown > 0;
}

const ACTIVE: readonly Phase[] = ["intro", "countdown", "playing", "serving", "spilling"];

export function isRoundActive(s: GameState): boolean {
  return ACTIVE.includes(s.phase);
}

/**
 * Freezes (or releases) the whole game for a reason: user pause, tracking loss, app hidden.
 * When the last hold is released mid-round, play continues only after a resume countdown.
 */
export function setHold(s: GameState, reason: HoldReason, on: boolean): GameEvent[] {
  const had = s.holds.has(reason);
  if (on === had) return [];
  if (on) {
    s.holds.add(reason);
    return [];
  }
  s.holds.delete(reason);
  if (s.holds.size > 0 || !isRoundActive(s)) return [];
  if (s.phase === "intro") return [];
  if (s.phase === "countdown") {
    s.phaseTime = 0;
    return [{ type: "countdown", value: s.config.countdownSeconds, resume: false }];
  }
  s.resumeCountdown = s.config.resumeCountdownSeconds;
  return [{ type: "countdown", value: Math.ceil(s.resumeCountdown), resume: true }];
}

export function stepGame(s: GameState, dt: number, input: StepInput): GameEvent[] {
  const events: GameEvent[] = [];
  const cfg = s.config;
  if (s.holds.size > 0 || !isRoundActive(s)) return events;

  if (s.resumeCountdown > 0) {
    const before = Math.ceil(s.resumeCountdown);
    s.resumeCountdown = Math.max(0, s.resumeCountdown - dt);
    const after = Math.ceil(s.resumeCountdown);
    if (after !== before && after > 0) events.push({ type: "countdown", value: after, resume: true });
    if (s.resumeCountdown === 0) events.push({ type: "countdown", value: 0, resume: true });
    return events;
  }

  s.playerX = clamp(input.playerX, cfg.player.minX, cfg.player.maxX);
  s.phaseTime += dt;

  switch (s.phase) {
    case "intro":
      if (s.phaseTime >= cfg.introSeconds) events.push(...setPhase(s, "countdown"));
      break;
    case "countdown": {
      const before = Math.ceil(cfg.countdownSeconds - (s.phaseTime - dt));
      const after = Math.ceil(cfg.countdownSeconds - s.phaseTime);
      if (after !== before && after > 0) events.push({ type: "countdown", value: after, resume: false });
      if (s.phaseTime >= cfg.countdownSeconds) events.push(...setPhase(s, "playing"));
      break;
    }
    case "playing":
      stepPlaying(s, dt, events);
      break;
    case "serving":
      if (s.phaseTime >= cfg.servingSeconds) events.push(...setPhase(s, "playing"));
      break;
    case "spilling":
      if (s.phaseTime >= cfg.spillSeconds) {
        if (s.spills >= cfg.maxSpills) events.push(...endRound(s, "spills"));
        else events.push(...setPhase(s, "playing"));
      }
      break;
  }
  return events;
}

function stepPlaying(s: GameState, dt: number, events: GameEvent[]) {
  const cfg = s.config;
  s.activeTime += dt;
  const band = difficultyAt(s.activeTime, cfg);
  const prevSurface = layoutStack(s.sundae.scoops, cfg).surfaceY;

  // Move first, then resolve crossings against the surface (which may rise as scoops land).
  for (const it of s.items) {
    it.prevY = it.y;
    it.y += it.vy * dt;
  }

  let surfacePrevY = prevSurface;
  const caught = new Set<number>();
  for (const it of s.items) {
    if (it.resolved) continue;
    const layout = layoutStack(s.sundae.scoops, cfg);
    const result = crossSurface(
      {
        x: it.x,
        prevContactY: it.prevY + it.radius * cfg.items.contactFactor,
        contactY: it.y + it.radius * cfg.items.contactFactor,
        radius: it.radius,
      },
      { x: s.playerX, y: layout.surfaceY, prevY: surfacePrevY, width: layout.surfaceWidth },
      cfg.items.minOverlap,
    );
    if (result === "none") continue;
    it.resolved = true;
    if (result === "passed") {
      // A cherry that slips past can never be caught, so the next one is scheduled right away.
      if (it.kind === "cherry") {
        s.cherryAt = s.activeTime + cfg.cherry.retryDelay;
        events.push({ type: "cherry-missed" });
      }
      continue;
    }
    caught.add(it.id);
    const outcome = catchItem(s, it, layout.surfaceY, events);
    if (outcome === "spill" || outcome === "served") return;
    surfacePrevY = layoutStack(s.sundae.scoops, cfg).surfaceY;
  }

  // Caught items join the sundae; missed ones fall off the bottom with no penalty.
  const remaining: FallingItem[] = [];
  for (const it of s.items) {
    if (caught.has(it.id)) continue;
    if (it.y - it.radius > cfg.spawn.despawnY) {
      if (it.kind !== "toy") events.push({ type: "miss", item: it });
      continue;
    }
    remaining.push(it);
  }
  s.items = remaining;

  // Regular spawns.
  s.spawnTimer += dt;
  if (s.spawnTimer >= band.spawnInterval) {
    s.spawnTimer -= band.spawnInterval;
    events.push(spawnRegular(s, band.toyShare, fallSpeed(band.fallSeconds, WORLD.height)));
  }

  // Cherries are scheduled separately, once the sundae is tall enough.
  const cherryFalling = s.items.some((it) => it.kind === "cherry" && !it.resolved);
  if (!cherryFalling && s.sundae.scoops.length >= cfg.cherry.minScoops) {
    s.cherryAt ??= s.activeTime + cfg.cherry.firstDelay;
    if (s.activeTime >= s.cherryAt) {
      s.cherryAt = null;
      events.push(spawnItem(s, "cherry", "cherry", fallSpeed(band.fallSeconds, WORLD.height)));
      events.push({ type: "cherry-offered" });
    }
  }

  if (s.activeTime >= cfg.roundSeconds) {
    s.activeTime = cfg.roundSeconds;
    events.push(...endRound(s, "time"));
  }
}

function catchItem(s: GameState, it: FallingItem, surfaceY: number, events: GameEvent[]): "ok" | "spill" | "served" {
  const cfg = s.config;
  const sundae = s.sundae;
  switch (it.kind) {
    case "scoop": {
      const flavor = it.variant as Flavor;
      sundae.scoops.push({ flavor, toppings: [] });
      sundae.points += cfg.points.scoop;
      events.push({ type: "scoop", flavor, x: it.x, y: surfaceY, scoops: sundae.scoops.length });
      if (!sundae.rainbow && distinctFlavors(sundae).length >= cfg.rainbowFlavors) {
        sundae.rainbow = true;
        events.push({ type: "rainbow", x: s.playerX, y: surfaceY });
      }
      return "ok";
    }
    case "topping": {
      const topping = it.variant as Topping;
      const top = sundae.scoops[sundae.scoops.length - 1];
      if (!top) {
        events.push({ type: "topping-wasted", topping, x: it.x, y: surfaceY });
        return "ok";
      }
      top.toppings.push(topping);
      sundae.points += cfg.points.topping;
      events.push({ type: "topping", topping, x: it.x, y: surfaceY });
      return "ok";
    }
    case "cherry": {
      const points = sundae.points + (sundae.rainbow ? cfg.points.rainbow : 0) + cfg.points.completion;
      const record: SundaeRecord = {
        id: s.served.length + 1,
        scoops: sundae.scoops.map((sc) => ({ flavor: sc.flavor, toppings: [...sc.toppings] })),
        rainbow: sundae.rainbow,
        points,
      };
      s.banked += points;
      s.served.push(record);
      events.push({ type: "served", record, x: s.playerX, banked: s.banked });
      events.push(...setPhase(s, "serving"));
      return "served";
    }
    case "toy": {
      const spilled: Sundae = {
        scoops: sundae.scoops.map((sc) => ({ flavor: sc.flavor, toppings: [...sc.toppings] })),
        points: sundae.points,
        rainbow: sundae.rainbow,
      };
      s.spills += 1;
      const before = s.speckles.map((sp) => sp.id);
      s.speckles = addSpeckles(
        s.rng,
        s.speckles,
        spilled.scoops.map((sc) => sc.flavor),
        cfg.speckles.perSpill,
        cfg.speckles.cap,
        s.nextSpeckleId,
      );
      s.nextSpeckleId += cfg.speckles.perSpill;
      s.lastSpill = { sundae: spilled, x: s.playerX, at: s.activeTime };
      events.push({
        type: "spill",
        sundae: spilled,
        toy: { ...it },
        x: s.playerX,
        spills: s.spills,
        speckles: s.speckles.filter((sp) => !before.includes(sp.id)),
      });
      events.push(...setPhase(s, "spilling"));
      return "spill";
    }
  }
}

function spawnRegular(s: GameState, toyShare: number, vy: number): GameEvent {
  const cfg = s.config;
  const toysAllowed = s.activeTime >= cfg.toyGraceSeconds;
  let kind: ItemKind;
  if (toysAllowed && s.rng.chance(toyShare)) kind = "toy";
  else kind = s.rng.chance(cfg.scoopShare) ? "scoop" : "topping";
  const variant = kind === "toy" ? s.rng.pick(TOYS) : kind === "scoop" ? s.rng.pick(FLAVORS) : s.rng.pick(TOPPINGS);
  return spawnItem(s, kind, variant, vy);
}

function spawnItem(s: GameState, kind: ItemKind, variant: FallingItem["variant"], vy: number): GameEvent {
  const cfg = s.config;
  const radius = cfg.items.radius[kind];
  const catchY = layoutStack(s.sundae.scoops, cfg).surfaceY;
  const x = chooseSpawnX(s.rng, s.items, { vy, radius }, s.lastSpawnX, catchY, cfg);
  const item: FallingItem = {
    id: s.nextItemId++,
    kind,
    variant,
    x,
    y: cfg.spawn.y,
    prevY: cfg.spawn.y,
    vy,
    radius,
    resolved: false,
    spin: s.rng.next(),
  };
  s.lastSpawnX = x;
  s.items.push(item);
  return { type: "spawn", item };
}

function setPhase(s: GameState, phase: Phase): GameEvent[] {
  const cfg = s.config;
  s.phase = phase;
  s.phaseTime = 0;
  const events: GameEvent[] = [{ type: "phase", phase }];
  if (phase === "countdown") events.push({ type: "countdown", value: cfg.countdownSeconds, resume: false });
  if (phase === "serving" || phase === "spilling") {
    // Both reactions clear the board and start a fresh bowl; the timer is paused meanwhile.
    s.items = [];
    s.sundae = emptySundae();
    s.cherryAt = null;
  }
  if (phase === "playing") {
    // A breath of space after the start, a serve or a spill.
    s.spawnTimer = Math.min(s.spawnTimer, 0);
    if (s.activeTime > 0) s.spawnTimer = -0.35;
  }
  return events;
}

function endRound(s: GameState, reason: "time" | "spills"): GameEvent[] {
  s.endReason = reason;
  s.items = [];
  const events = setPhase(s, "over");
  events.push({ type: "round-over", reason, score: s.banked });
  return events;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
