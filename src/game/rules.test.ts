import { describe, expect, it } from "vitest";
import { crossSurface, overlap1d } from "./collision";
import { makeConfig, WORLD } from "./config";
import { difficultyAt, fallSpeed } from "./difficulty";
import { createRng } from "./rng";
import { createGame, startRound, stepGame } from "./sim";
import { arrivalTime, chooseSpawnX } from "./spawn";
import { addSpeckles, FACE_RADIUS, insideEllipse, FACE, type Speckle } from "./speckles";
import { layoutStack } from "./stack";
import type { FallingItem, StackScoop } from "./types";

describe("difficulty schedule", () => {
  const cfg = makeConfig();
  it("uses the early band for the first 30 seconds and the late band after", () => {
    expect(difficultyAt(0, cfg)).toEqual({ spawnInterval: 1.2, fallSeconds: 4, toyShare: 0.15 });
    expect(difficultyAt(29.9, cfg)).toEqual({ spawnInterval: 1.2, fallSeconds: 4, toyShare: 0.15 });
    expect(difficultyAt(30, cfg)).toEqual({ spawnInterval: 0.9, fallSeconds: 3.2, toyShare: 0.25 });
    expect(difficultyAt(59, cfg)).toEqual({ spawnInterval: 0.9, fallSeconds: 3.2, toyShare: 0.25 });
  });

  it("can interpolate instead", () => {
    const lerp = makeConfig({ difficulty: { mode: "lerp", blendSeconds: 10 } });
    expect(difficultyAt(20, lerp).spawnInterval).toBeCloseTo(1.2);
    const mid = difficultyAt(30, lerp);
    expect(mid.spawnInterval).toBeCloseTo(1.05);
    expect(mid.fallSeconds).toBeCloseTo(3.6);
    expect(mid.toyShare).toBeCloseTo(0.2);
    expect(difficultyAt(40, lerp).toyShare).toBeCloseTo(0.25);
  });

  it("converts the full-height fall time into a speed", () => {
    expect(fallSpeed(4, WORLD.height)).toBe(270);
  });

  it("produces roughly the configured toy and scoop shares", () => {
    const s = createGame(11, makeConfig({ toyGraceSeconds: 0, items: { minOverlap: 10 } }));
    startRound(s, { skipIntro: true });
    const counts = { scoop: 0, topping: 0, toy: 0, cherry: 0 };
    // Nothing can be caught (impossible overlap), so the schedule stays undisturbed.
    for (let i = 0; i < 29 * 120 + 360; i++) {
      for (const e of stepGame(s, 1 / 120, { playerX: 240 })) if (e.type === "spawn") counts[e.item.kind]++;
      if (s.phase !== "playing" && s.phase !== "countdown") break;
    }
    const regular = counts.scoop + counts.topping + counts.toy;
    expect(regular).toBeGreaterThan(20);
    expect(counts.toy / regular).toBeLessThan(0.35);
    expect(counts.scoop).toBeGreaterThan(counts.topping);
  });
});

describe("collision rules", () => {
  it("measures horizontal overlap", () => {
    expect(overlap1d(0, 10, 5, 20)).toBe(5);
    expect(overlap1d(0, 10, 10, 20)).toBe(0);
    expect(overlap1d(0, 10, 30, 40)).toBe(0);
  });

  it("catches only when crossing the surface from above with enough overlap", () => {
    const surface = { x: 0, y: 500, prevY: 500, width: 100 };
    expect(crossSurface({ x: 0, prevContactY: 490, contactY: 495, radius: 50 }, surface, 0.35)).toBe("none");
    expect(crossSurface({ x: 0, prevContactY: 498, contactY: 503, radius: 50 }, surface, 0.35)).toBe("caught");
    expect(crossSurface({ x: 90, prevContactY: 498, contactY: 503, radius: 50 }, surface, 0.35)).toBe("passed");
    // Already below the surface (beside the stack): never caught later.
    expect(crossSurface({ x: 0, prevContactY: 520, contactY: 525, radius: 50 }, surface, 0.35)).toBe("passed");
  });

  it("counts a stack that grows into a falling item as a crossing", () => {
    const surface = { x: 0, y: 440, prevY: 500, width: 100 };
    expect(crossSurface({ x: 0, prevContactY: 470, contactY: 473, radius: 50 }, surface, 0.35)).toBe("caught");
  });
});

describe("stack layout", () => {
  const cfg = makeConfig();
  const scoops = (n: number): StackScoop[] => Array.from({ length: n }, () => ({ flavor: "vanilla", toppings: [] }));

  it("uses the bowl opening when empty", () => {
    const l = layoutStack([], cfg);
    expect(l.surfaceY).toBe(cfg.toddler.rimY);
    expect(l.surfaceWidth).toBe(cfg.toddler.bowlOpening);
  });

  it("compresses spacing so the stack never exceeds its max height", () => {
    let prevTop = Infinity;
    for (let n = 1; n <= 30; n++) {
      const l = layoutStack(scoops(n), cfg);
      expect(l.height).toBeLessThanOrEqual(cfg.stack.maxHeight + 1e-9);
      expect(l.surfaceY).toBeLessThanOrEqual(prevTop);
      prevTop = l.surfaceY;
      // The catch surface is the visible top of the (compressed) top scoop.
      expect(l.surfaceY).toBeCloseTo(l.scoopY[n - 1] - cfg.stack.scoopRadius * cfg.stack.domeFactor);
    }
    expect(layoutStack(scoops(3), cfg).step).toBe(cfg.stack.step);
    expect(layoutStack(scoops(12), cfg).step).toBeLessThan(cfg.stack.step);
  });

  it("keeps the sundae within about 40% of the screen height", () => {
    const l = layoutStack(scoops(20), cfg);
    const bowlDepth = 90;
    expect(l.height + bowlDepth).toBeLessThanOrEqual(WORLD.height * 0.42);
  });
});

describe("spawn spacing", () => {
  const cfg = makeConfig();
  const item = (id: number, x: number, y: number, vy: number): FallingItem => ({
    id,
    kind: "scoop",
    variant: "vanilla",
    x,
    y,
    prevY: y,
    vy,
    radius: cfg.items.radius.scoop,
    resolved: false,
    spin: 0,
  });

  it("keeps the next item within comfortable sidestep reach of the previous one", () => {
    const rng = createRng(5);
    const catchY = cfg.toddler.rimY;
    for (let trial = 0; trial < 300; trial++) {
      const vy = fallSpeed(trial % 2 ? 4 : 3.2, WORLD.height);
      const prevX = rng.range(cfg.player.minX, cfg.player.maxX);
      const gapSeconds = rng.range(0.6, 1.2);
      const prev = item(1, prevX, cfg.spawn.y + vy * gapSeconds, vy);
      const x = chooseSpawnX(rng, [prev], { vy, radius: cfg.items.radius.scoop }, prevX, catchY, cfg);
      const gap =
        arrivalTime(cfg.spawn.y, vy, cfg.items.radius.scoop, catchY, cfg.items.contactFactor) -
        arrivalTime(prev.y, vy, prev.radius, catchY, cfg.items.contactFactor);
      expect(Math.abs(x - prevX)).toBeLessThanOrEqual(cfg.spawn.comfortableSpeed * gap + cfg.spawn.reachSlack + 1e-6);
      expect(x).toBeGreaterThanOrEqual(cfg.player.minX);
      expect(x).toBeLessThanOrEqual(cfg.player.maxX);
    }
  });

  it("keeps items that arrive together horizontally apart", () => {
    const rng = createRng(9);
    const vy = 270;
    for (let trial = 0; trial < 200; trial++) {
      const other = item(1, rng.range(500, 1400), cfg.spawn.y + 20, vy);
      const x = chooseSpawnX(rng, [other], { vy, radius: cfg.items.radius.toy }, other.x, cfg.toddler.rimY, cfg);
      expect(Math.abs(x - other.x)).toBeGreaterThanOrEqual(cfg.spawn.minGapX);
    }
  });

  it("holds over a whole simulated round", () => {
    const s = createGame(21, makeConfig({ items: { minOverlap: 10 } }));
    startRound(s, { skipIntro: true });
    const cf = s.config.items.contactFactor;
    const catchY = s.config.toddler.rimY;
    const arrivals: { x: number; at: number }[] = [];
    // Nothing can be caught (impossible overlap), so the board is never cleared.
    for (let i = 0; i < 64 * 120 && s.phase !== "over"; i++) {
      for (const e of stepGame(s, 1 / 120, { playerX: 240 })) {
        if (e.type === "spawn") {
          arrivals.push({ x: e.item.x, at: s.activeTime + arrivalTime(e.item.y, e.item.vy, e.item.radius, catchY, cf) });
        }
      }
    }
    expect(arrivals.length).toBeGreaterThan(40);
    arrivals.sort((a, b) => a.at - b.at);
    for (let i = 1; i < arrivals.length; i++) {
      const gap = arrivals[i].at - arrivals[i - 1].at;
      expect(Math.abs(arrivals[i].x - arrivals[i - 1].x)).toBeLessThanOrEqual(
        s.config.spawn.comfortableSpeed * gap + s.config.spawn.reachSlack + 1,
      );
    }
  });
});

describe("face speckles", () => {
  const rng = createRng(3);

  it("land in head-local coordinates, inside the face and off the eyes and mouth", () => {
    let speckles: Speckle[] = [];
    for (let i = 0; i < 40; i++) {
      speckles = addSpeckles(rng, speckles, ["strawberry", "mint"], 5, 1000, i * 5);
    }
    expect(speckles.length).toBeGreaterThan(150);
    for (const sp of speckles) {
      expect(Math.hypot(sp.x, sp.y) + sp.r).toBeLessThanOrEqual(FACE_RADIUS + 1e-9);
      for (const e of [...FACE.eyes, FACE.mouth]) expect(insideEllipse(sp.x, sp.y, e)).toBe(false);
      expect(Math.abs(sp.x)).toBeLessThan(1);
      expect(Math.abs(sp.y)).toBeLessThan(1);
    }
  });

  it("use the spilled flavors (vanilla when the bowl was empty)", () => {
    const a = addSpeckles(rng, [], ["chocolate"], 5, 14, 1);
    expect(a.every((sp) => sp.flavor === "chocolate")).toBe(true);
    const b = addSpeckles(rng, [], [], 3, 14, 1);
    expect(b.every((sp) => sp.flavor === "vanilla")).toBe(true);
  });

  it("accumulate across spills within a fixed cap, keeping the newest", () => {
    let speckles: Speckle[] = [];
    speckles = addSpeckles(rng, speckles, ["vanilla"], 5, 12, 1);
    expect(speckles).toHaveLength(5);
    speckles = addSpeckles(rng, speckles, ["mint"], 5, 12, 6);
    expect(speckles).toHaveLength(10);
    speckles = addSpeckles(rng, speckles, ["chocolate"], 5, 12, 11);
    expect(speckles).toHaveLength(12);
    expect(speckles.filter((sp) => sp.flavor === "chocolate")).toHaveLength(5);
    expect(speckles.filter((sp) => sp.flavor === "vanilla")).toHaveLength(2);
  });

  it("are stored relative to the head, so moving the toddler never changes them", () => {
    const s = createGame(4, makeConfig());
    startRound(s, { skipIntro: true });
    s.phase = "playing";
    s.items.push({
      id: 99,
      kind: "toy",
      variant: "ball",
      x: s.playerX,
      y: s.config.toddler.rimY - 60,
      prevY: s.config.toddler.rimY - 60,
      vy: 300,
      radius: 50,
      resolved: false,
      spin: 0,
    });
    for (let i = 0; i < 30; i++) stepGame(s, 1 / 120, { playerX: s.playerX });
    const snapshot = JSON.stringify(s.speckles);
    expect(s.speckles.length).toBeGreaterThan(0);
    for (let i = 0; i < 400; i++) stepGame(s, 1 / 120, { playerX: 240 + (i % 100) * 14 });
    expect(JSON.stringify(s.speckles)).toBe(snapshot);
  });
});
