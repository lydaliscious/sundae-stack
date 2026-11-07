/**
 * Every gameplay tuning constant lives here. The simulation never reads anything else, so a
 * test (or a playtest on the TV) can pass a modified copy to `createGame`.
 *
 * World units are canvas pixels on the fixed 1920×1080 stage; times are seconds of game time.
 */

export const WORLD = { width: 1920, height: 1080 } as const;

export interface DifficultyBand {
  /** Seconds between regular spawns. */
  spawnInterval: number;
  /** Seconds an item needs to fall the full screen height. */
  fallSeconds: number;
  /** Share of regular spawns that are toys (0..1). */
  toyShare: number;
}

export interface GameConfig {
  roundSeconds: number;
  maxSpills: number;
  introSeconds: number;
  countdownSeconds: number;
  /** Countdown after a pause or tracking loss before play continues. */
  resumeCountdownSeconds: number;
  servingSeconds: number;
  spillSeconds: number;

  points: { scoop: number; topping: number; completion: number; rainbow: number };
  rainbowFlavors: number;

  cherry: {
    /** Scoops needed before a cherry is offered. */
    minScoops: number;
    /** Delay between reaching `minScoops` and the first cherry. */
    firstDelay: number;
    /** Delay after a missed cherry before the next one is offered. */
    retryDelay: number;
  };

  difficulty: {
    early: DifficultyBand;
    late: DifficultyBand;
    /** Active seconds at which the late band takes over. */
    switchAt: number;
    /** `step` switches at `switchAt`; `lerp` blends linearly across `blendSeconds` centred on it. */
    mode: "step" | "lerp";
    blendSeconds: number;
  };
  /** Of the non-toy regular spawns, the share that are scoops (the rest are toppings). */
  scoopShare: number;
  /** No toys during the first seconds of a round. */
  toyGraceSeconds: number;

  spawn: {
    y: number;
    /** Items are removed once their top passes this y. */
    despawnY: number;
    /** Sidestep speed (px/s) the spacing rules assume a comfortable player can manage. */
    comfortableSpeed: number;
    /** Extra horizontal reach (px) on top of `comfortableSpeed × arrival gap`. */
    reachSlack: number;
    /** Items arriving within this many seconds of each other must be horizontally apart… */
    overlapWindow: number;
    /** …by at least this many pixels, so nothing (especially a toy) hides behind another item. */
    minGapX: number;
    attempts: number;
  };

  player: { minX: number; maxX: number; startX: number };

  /** Toddler + bowl geometry (world y of the feet and the bowl opening). */
  toddler: { feetY: number; rimY: number; bowlOpening: number };

  stack: {
    scoopRadius: number;
    /** How far the first scoop's centre sits above the rim. */
    baseOffset: number;
    /** Nominal vertical distance between scoop centres before compression. */
    step: number;
    /** The visible dome top of a scoop, as a fraction of its radius above its centre. */
    domeFactor: number;
    /** Extra height whipped cream adds on top of its scoop. */
    whipHeight: number;
    /** The stack above the rim never grows taller than this (spacing compresses instead). */
    maxHeight: number;
    /** Width of the catch surface on top of a scoop. */
    topWidth: number;
  };

  items: {
    radius: Record<"scoop" | "topping" | "cherry" | "toy", number>;
    /** The item's contact point below its centre, as a fraction of its radius. */
    contactFactor: number;
    /** Minimum horizontal overlap between item and catch surface, as a fraction of the item's width. */
    minOverlap: number;
  };

  speckles: { perSpill: number; cap: number };
}

export const DEFAULT_CONFIG: GameConfig = {
  roundSeconds: 60,
  maxSpills: 3,
  introSeconds: 3.2,
  countdownSeconds: 3,
  resumeCountdownSeconds: 3,
  servingSeconds: 1.8,
  spillSeconds: 1.15,

  points: { scoop: 10, topping: 5, completion: 25, rainbow: 30 },
  rainbowFlavors: 3,

  cherry: { minScoops: 3, firstDelay: 0.8, retryDelay: 6 },

  difficulty: {
    early: { spawnInterval: 1.2, fallSeconds: 4, toyShare: 0.15 },
    late: { spawnInterval: 0.9, fallSeconds: 3.2, toyShare: 0.25 },
    switchAt: 30,
    mode: "step",
    blendSeconds: 6,
  },
  scoopShare: 0.8,
  toyGraceSeconds: 2.5,

  spawn: {
    y: -70,
    despawnY: 1160,
    comfortableSpeed: 900,
    reachSlack: 60,
    overlapWindow: 0.55,
    minGapX: 200,
    attempts: 24,
  },

  player: { minX: 240, maxX: 1680, startX: 960 },

  toddler: { feetY: 1036, rimY: 580, bowlOpening: 216 },

  stack: {
    scoopRadius: 66,
    baseOffset: 22,
    step: 58,
    domeFactor: 0.8,
    whipHeight: 20,
    maxHeight: 352,
    topWidth: 124,
  },

  items: {
    radius: { scoop: 54, topping: 46, cherry: 40, toy: 50 },
    contactFactor: 0.7,
    minOverlap: 0.35,
  },

  speckles: { perSpill: 5, cap: 14 },
};

/** A deep-ish copy with overrides, for tests and tuning. */
export function makeConfig(overrides: DeepPartial<GameConfig> = {}): GameConfig {
  return merge(structuredClone(DEFAULT_CONFIG) as unknown as Record<string, unknown>, overrides) as unknown as GameConfig;
}

export type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

function merge(target: Record<string, unknown>, src: Record<string, unknown>): Record<string, unknown> {
  for (const [k, v] of Object.entries(src)) {
    if (v && typeof v === "object" && !Array.isArray(v) && typeof target[k] === "object") {
      merge(target[k] as Record<string, unknown>, v as Record<string, unknown>);
    } else if (v !== undefined) {
      target[k] = v;
    }
  }
  return target;
}
