import { describe, expect, it } from "vitest";
import { makeConfig, type DeepPartial, type GameConfig } from "./config";
import { createGame, pendingValue, setHold, startRound, stepGame, timeLeft } from "./sim";
import { layoutStack } from "./stack";
import type { FallingItem, GameEvent, GameState, ItemKind } from "./types";

const DT = 1 / 120;

/** A config with regular spawns switched off, so each test drops exactly the items it needs. */
function quietConfig(overrides: DeepPartial<GameConfig> = {}): GameConfig {
  const base = makeConfig(overrides);
  base.difficulty.early.spawnInterval = 1e9;
  base.difficulty.late.spawnInterval = 1e9;
  if (overrides.difficulty?.early?.spawnInterval) base.difficulty.early.spawnInterval = overrides.difficulty.early.spawnInterval;
  if (overrides.difficulty?.late?.spawnInterval) base.difficulty.late.spawnInterval = overrides.difficulty.late.spawnInterval;
  return base;
}

function playing(config = quietConfig(), seed = 7): GameState {
  const s = createGame(seed, config);
  startRound(s, { skipIntro: true });
  run(s, config.countdownSeconds + DT);
  expect(s.phase).toBe("playing");
  return s;
}

function run(s: GameState, seconds: number, playerX = s.playerX): GameEvent[] {
  const events: GameEvent[] = [];
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) events.push(...stepGame(s, DT, { playerX }));
  return events;
}

/** Drops an item just above the current catch surface at `x`. */
function drop(s: GameState, kind: ItemKind, variant: FallingItem["variant"], x = s.playerX, above = 20): FallingItem {
  const cfg = s.config;
  const radius = cfg.items.radius[kind];
  const surfaceY = layoutStack(s.sundae.scoops, cfg).surfaceY;
  const y = surfaceY - radius * cfg.items.contactFactor - above;
  const item: FallingItem = { id: s.nextItemId++, kind, variant, x, y, prevY: y, vy: 300, radius, resolved: false, spin: 0 };
  s.items.push(item);
  return item;
}

function catchOne(s: GameState, kind: ItemKind, variant: FallingItem["variant"]): GameEvent[] {
  drop(s, kind, variant);
  return run(s, 0.2);
}

const types = (events: GameEvent[]) => events.map((e) => e.type);

describe("scoring", () => {
  it("a scoop adds one scoop and 10 pending points", () => {
    const s = playing();
    const ev = catchOne(s, "scoop", "vanilla");
    expect(types(ev)).toContain("scoop");
    expect(s.sundae.scoops).toHaveLength(1);
    expect(pendingValue(s)).toBe(10);
    expect(s.banked).toBe(0);
  });

  it("a topping decorates the top scoop for 5 points without adding a scoop", () => {
    const s = playing();
    catchOne(s, "scoop", "chocolate");
    const before = layoutStack(s.sundae.scoops, s.config).surfaceY;
    catchOne(s, "topping", "sprinkles");
    expect(s.sundae.scoops).toHaveLength(1);
    expect(s.sundae.scoops[0].toppings).toEqual(["sprinkles"]);
    expect(pendingValue(s)).toBe(15);
    expect(layoutStack(s.sundae.scoops, s.config).surfaceY).toBe(before);
  });

  it("whipped cream adds only a little height", () => {
    const s = playing();
    catchOne(s, "scoop", "chocolate");
    const before = layoutStack(s.sundae.scoops, s.config).surfaceY;
    catchOne(s, "topping", "whip");
    const after = layoutStack(s.sundae.scoops, s.config).surfaceY;
    expect(before - after).toBeCloseTo(s.config.stack.whipHeight);
    expect(before - after).toBeLessThan(s.config.stack.step / 2);
  });

  it("a topping caught before the first scoop disappears without points", () => {
    const s = playing();
    const ev = catchOne(s, "topping", "sauce");
    expect(types(ev)).toContain("topping-wasted");
    expect(pendingValue(s)).toBe(0);
    expect(s.sundae.scoops).toHaveLength(0);
    expect(s.items).toHaveLength(0);
  });

  it("missing an item has no penalty", () => {
    const s = playing();
    drop(s, "scoop", "mint", s.playerX + 500);
    const ev = run(s, 4);
    expect(types(ev)).toContain("miss");
    expect(s.banked).toBe(0);
    expect(s.spills).toBe(0);
    expect(pendingValue(s)).toBe(0);
  });
});

describe("cherries", () => {
  it("are not offered before three scoops", () => {
    const s = playing();
    catchOne(s, "scoop", "vanilla");
    catchOne(s, "scoop", "vanilla");
    const ev = run(s, 3);
    expect(types(ev)).not.toContain("cherry-offered");
  });

  it("are offered once the sundae has three scoops", () => {
    const s = playing();
    for (let i = 0; i < 3; i++) catchOne(s, "scoop", "vanilla");
    const ev = run(s, s.config.cherry.firstDelay + 0.1);
    expect(types(ev)).toContain("cherry-offered");
    expect(s.items.filter((it) => it.kind === "cherry")).toHaveLength(1);
  });

  it("are offered again about six seconds after a miss", () => {
    const s = playing();
    for (let i = 0; i < 3; i++) catchOne(s, "scoop", "vanilla");
    run(s, s.config.cherry.firstDelay + 0.1);
    const cherry = s.items.find((it) => it.kind === "cherry")!;
    // Stand far away from it.
    const away = cherry.x < 960 ? s.config.player.maxX : s.config.player.minX;
    let missedAt = -1;
    let offeredAgainAt = -1;
    for (let i = 0; i < 20 / DT; i++) {
      const ev = stepGame(s, DT, { playerX: away });
      if (missedAt < 0 && types(ev).includes("cherry-missed")) missedAt = s.activeTime;
      else if (missedAt >= 0 && types(ev).includes("cherry-offered")) {
        offeredAgainAt = s.activeTime;
        break;
      }
    }
    expect(missedAt).toBeGreaterThan(0);
    expect(offeredAgainAt - missedAt).toBeCloseTo(s.config.cherry.retryDelay, 1);
  });

  it("serve the sundae: banks pending + 25, saves it and starts a fresh bowl", () => {
    const s = playing();
    catchOne(s, "scoop", "vanilla");
    catchOne(s, "scoop", "vanilla");
    catchOne(s, "topping", "sprinkles");
    catchOne(s, "scoop", "chocolate");
    expect(pendingValue(s)).toBe(35);
    drop(s, "toy", "ball", s.config.player.minX); // far away, must be cleared by the serve
    const ev = catchOne(s, "cherry", "cherry");
    const served = ev.find((e) => e.type === "served");
    expect(served).toBeTruthy();
    expect(s.banked).toBe(35 + 25);
    expect(s.served).toHaveLength(1);
    expect(s.served[0].scoops.map((sc) => sc.flavor)).toEqual(["vanilla", "vanilla", "chocolate"]);
    expect(s.served[0].scoops[1].toppings).toEqual(["sprinkles"]);
    expect(s.served[0].points).toBe(60);
    expect(s.phase).toBe("serving");
    expect(s.items).toHaveLength(0);
    expect(s.sundae.scoops).toHaveLength(0);
    expect(pendingValue(s)).toBe(0);
  });

  it("the round clock is paused while serving", () => {
    const s = playing();
    for (let i = 0; i < 3; i++) catchOne(s, "scoop", "vanilla");
    catchOne(s, "cherry", "cherry");
    const t = s.activeTime;
    run(s, s.config.servingSeconds - 0.3);
    expect(s.phase).toBe("serving");
    expect(s.activeTime).toBe(t);
    run(s, 0.5);
    expect(s.phase).toBe("playing");
  });
});

describe("rainbow sundae", () => {
  it("activates once at three different flavors and stays pending until served", () => {
    const s = playing();
    catchOne(s, "scoop", "vanilla");
    catchOne(s, "scoop", "vanilla");
    expect(s.sundae.rainbow).toBe(false);
    catchOne(s, "topping", "sprinkles"); // toppings don't count
    expect(s.sundae.rainbow).toBe(false);
    catchOne(s, "scoop", "mint");
    const ev = catchOne(s, "scoop", "strawberry");
    expect(types(ev)).toContain("rainbow");
    expect(pendingValue(s)).toBe(45 + 30);
    const again = catchOne(s, "scoop", "chocolate");
    expect(types(again)).not.toContain("rainbow");
    expect(pendingValue(s)).toBe(55 + 30);
    expect(s.banked).toBe(0);
    catchOne(s, "cherry", "cherry");
    expect(s.banked).toBe(55 + 30 + 25);
    expect(s.served[0].rainbow).toBe(true);
  });

  it("is lost on a spill", () => {
    const s = playing();
    catchOne(s, "scoop", "vanilla");
    catchOne(s, "scoop", "mint");
    catchOne(s, "scoop", "chocolate");
    expect(s.sundae.rainbow).toBe(true);
    catchOne(s, "toy", "block");
    expect(pendingValue(s)).toBe(0);
    expect(s.sundae.rainbow).toBe(false);
    run(s, s.config.spillSeconds + 0.1);
    catchOne(s, "scoop", "vanilla");
    catchOne(s, "scoop", "vanilla");
    catchOne(s, "scoop", "vanilla");
    catchOne(s, "cherry", "cherry");
    expect(s.served[0].rainbow).toBe(false);
    expect(s.banked).toBe(30 + 25);
  });
});

describe("collisions", () => {
  it("each item triggers at most once", () => {
    const s = playing();
    drop(s, "scoop", "vanilla");
    const ev = run(s, 2);
    expect(ev.filter((e) => e.type === "scoop")).toHaveLength(1);
  });

  it("a toy collision triggers exactly one spill, even with two toys landing together", () => {
    const s = playing();
    catchOne(s, "scoop", "vanilla");
    drop(s, "toy", "block");
    drop(s, "toy", "ball", s.playerX + 10);
    const ev = run(s, 1);
    expect(ev.filter((e) => e.type === "spill")).toHaveLength(1);
    expect(s.spills).toBe(1);
  });

  it("catches only with enough horizontal overlap with the catch surface", () => {
    const s = playing();
    const cfg = s.config;
    const r = cfg.items.radius.scoop;
    const half = cfg.toddler.bowlOpening / 2;
    const minOv = cfg.items.minOverlap * r * 2;
    // Overlap just above the threshold → caught.
    drop(s, "scoop", "vanilla", s.playerX + half + r - minOv - 2);
    expect(types(run(s, 0.3))).toContain("scoop");
    // On top of a scoop the surface is narrower.
    const top = cfg.stack.topWidth / 2;
    drop(s, "scoop", "vanilla", s.playerX + top + r - minOv + 2);
    expect(types(run(s, 0.3))).not.toContain("scoop");
    expect(s.sundae.scoops).toHaveLength(1);
  });

  it("items that pass the stack's side can't be caught afterwards", () => {
    const s = playing();
    catchOne(s, "scoop", "vanilla");
    const item = drop(s, "toy", "ball", s.playerX + 300);
    run(s, 0.3);
    expect(item.resolved).toBe(true);
    // Moving under it now (it is below the surface) must not count.
    const ev = run(s, 0.5, item.x);
    expect(types(ev)).not.toContain("spill");
    expect(s.spills).toBe(0);
  });

  it("the catch surface follows the top of the stack", () => {
    const s = playing();
    const surfaces: number[] = [];
    for (let i = 0; i < 4; i++) {
      surfaces.push(layoutStack(s.sundae.scoops, s.config).surfaceY);
      catchOne(s, "scoop", "vanilla");
    }
    for (let i = 1; i < surfaces.length; i++) expect(surfaces[i]).toBeLessThan(surfaces[i - 1]);
    expect(surfaces[0]).toBe(s.config.toddler.rimY);
  });
});

describe("spills", () => {
  it("clear the sundae and pending points but keep banked points", () => {
    const s = playing();
    for (let i = 0; i < 3; i++) catchOne(s, "scoop", "vanilla");
    catchOne(s, "cherry", "cherry");
    run(s, s.config.servingSeconds + 0.1);
    const banked = s.banked;
    catchOne(s, "scoop", "strawberry");
    catchOne(s, "scoop", "chocolate");
    drop(s, "scoop", "mint", s.config.player.minX, 400); // falling elsewhere: cleared by the spill
    const ev = catchOne(s, "toy", "block");
    const spill = ev.find((e) => e.type === "spill");
    expect(spill && spill.type === "spill" && spill.sundae.scoops.map((sc) => sc.flavor)).toEqual(["strawberry", "chocolate"]);
    expect(s.banked).toBe(banked);
    expect(pendingValue(s)).toBe(0);
    expect(s.sundae.scoops).toHaveLength(0);
    expect(s.items).toHaveLength(0);
    expect(s.spills).toBe(1);
    expect(s.phase).toBe("spilling");
  });

  it("splatter speckles use the spilled flavors", () => {
    const s = playing();
    catchOne(s, "scoop", "strawberry");
    catchOne(s, "scoop", "chocolate");
    const ev = catchOne(s, "toy", "ball");
    const spill = ev.find((e) => e.type === "spill");
    if (spill?.type !== "spill") throw new Error("no spill");
    expect(spill.speckles.length).toBeGreaterThan(0);
    for (const sp of spill.speckles) expect(["strawberry", "chocolate"]).toContain(sp.flavor);
    expect(s.speckles).toHaveLength(spill.speckles.length);
  });

  it("pause the round clock during the reaction", () => {
    const s = playing();
    catchOne(s, "toy", "ball");
    const t = s.activeTime;
    run(s, s.config.spillSeconds - 0.2);
    expect(s.activeTime).toBe(t);
  });

  it("the third spill ends the round after its animation", () => {
    const s = playing();
    for (let i = 0; i < 2; i++) {
      catchOne(s, "toy", "ball");
      run(s, s.config.spillSeconds + 0.1);
      expect(s.phase).toBe("playing");
    }
    catchOne(s, "toy", "ball");
    expect(s.phase).toBe("spilling");
    run(s, s.config.spillSeconds - 0.3);
    expect(s.phase).toBe("spilling");
    const ev = run(s, 0.5);
    expect(s.phase).toBe("over");
    expect(s.endReason).toBe("spills");
    expect(ev.find((e) => e.type === "round-over")).toMatchObject({ reason: "spills" });
  });
});

describe("round clock", () => {
  it("ends the round after 60 seconds of active play", () => {
    const s = playing();
    run(s, 59.9);
    expect(s.phase).toBe("playing");
    const ev = run(s, 0.2);
    expect(s.phase).toBe("over");
    expect(s.endReason).toBe("time");
    expect(types(ev)).toContain("round-over");
    expect(timeLeft(s)).toBe(0);
  });

  it("does not count the intro, countdown, pauses, tracking loss or the resume countdown", () => {
    const s = createGame(3, quietConfig());
    startRound(s);
    run(s, s.config.introSeconds + s.config.countdownSeconds + 0.05);
    expect(s.phase).toBe("playing");
    const start = s.activeTime;
    expect(start).toBeLessThan(0.1);
    run(s, 10);
    setHold(s, "paused", true);
    run(s, 30);
    setHold(s, "paused", false);
    run(s, s.config.resumeCountdownSeconds - 0.05);
    expect(s.activeTime).toBeCloseTo(start + 10, 5);
    run(s, 0.05 + DT);
    setHold(s, "tracking", true);
    setHold(s, "hidden", true);
    run(s, 100);
    setHold(s, "tracking", false);
    run(s, 10); // still hidden
    setHold(s, "hidden", false);
    run(s, s.config.resumeCountdownSeconds + DT);
    expect(s.activeTime).toBeCloseTo(start + 10, 1);
    expect(s.phase).toBe("playing");
  });

  it("tracking loss never consumes time or spill chances", () => {
    const s = playing();
    drop(s, "toy", "ball", s.playerX, 60);
    setHold(s, "tracking", true);
    const ev = run(s, 20);
    expect(ev).toEqual([]);
    expect(s.spills).toBe(0);
    expect(s.items).toHaveLength(1);
    const t = s.activeTime;
    // When tracking returns the player has a countdown to get out of the way.
    setHold(s, "tracking", false);
    const countdown = run(s, s.config.resumeCountdownSeconds, s.config.player.maxX);
    expect(countdown.every((e) => e.type === "countdown")).toBe(true);
    expect(s.activeTime).toBe(t);
    run(s, 1, s.config.player.maxX);
    expect(s.spills).toBe(0);
  });
});

describe("restart", () => {
  it("resets bowl, face, timer and score", () => {
    const s = playing();
    for (let i = 0; i < 3; i++) catchOne(s, "scoop", "mint");
    catchOne(s, "cherry", "cherry");
    run(s, s.config.servingSeconds + 0.1);
    catchOne(s, "scoop", "chocolate");
    catchOne(s, "toy", "ball");
    run(s, 5);
    expect(s.banked).toBeGreaterThan(0);
    expect(s.speckles.length).toBeGreaterThan(0);
    setHold(s, "paused", true);
    startRound(s, { skipIntro: true });
    expect(s.banked).toBe(0);
    expect(s.spills).toBe(0);
    expect(s.served).toEqual([]);
    expect(s.speckles).toEqual([]);
    expect(s.sundae.scoops).toEqual([]);
    expect(s.items).toEqual([]);
    expect(s.activeTime).toBe(0);
    expect(s.holds.size).toBe(0);
    expect(s.phase).toBe("countdown");
    expect(s.endReason).toBeNull();
  });
});

describe("determinism", () => {
  it("the same seed and inputs replay the same round", () => {
    const play = () => {
      const s = createGame(42, makeConfig());
      startRound(s, { skipIntro: true });
      const log: string[] = [];
      for (let i = 0; i < 40 / DT; i++) {
        const x = 960 + Math.sin(i / 90) * 600;
        for (const e of stepGame(s, DT, { playerX: x })) log.push(e.type);
      }
      return { log, banked: s.banked, spills: s.spills };
    };
    expect(play()).toEqual(play());
  });
});
