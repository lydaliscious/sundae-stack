import type { GameConfig } from "./config";
import type { Rng } from "./rng";
import type { Speckle } from "./speckles";

export const FLAVORS = ["vanilla", "strawberry", "chocolate", "mint"] as const;
export type Flavor = (typeof FLAVORS)[number];

export const TOPPINGS = ["sprinkles", "sauce", "whip"] as const;
export type Topping = (typeof TOPPINGS)[number];

export const TOYS = ["block", "ball"] as const;
export type Toy = (typeof TOYS)[number];

export type ItemKind = "scoop" | "topping" | "cherry" | "toy";

export interface FallingItem {
  id: number;
  kind: ItemKind;
  /** Flavor / topping / toy variant; "cherry" for cherries. */
  variant: Flavor | Topping | Toy | "cherry";
  x: number;
  y: number;
  prevY: number;
  vy: number;
  radius: number;
  /** Set once the item has been caught or has passed below the catch surface. */
  resolved: boolean;
  /** Seed for cosmetic spin/wobble so rendering stays deterministic per item. */
  spin: number;
}

export interface StackScoop {
  flavor: Flavor;
  toppings: Topping[];
}

export interface Sundae {
  scoops: StackScoop[];
  /** Scoop + topping points (not yet banked). */
  points: number;
  /** The one-time Rainbow Sundae bonus is pending on this sundae. */
  rainbow: boolean;
}

/** A served sundae, kept for the results screen and the counter. */
export interface SundaeRecord {
  id: number;
  scoops: StackScoop[];
  rainbow: boolean;
  /** Everything this sundae banked: pending + rainbow + completion bonus. */
  points: number;
}

export type Phase = "idle" | "intro" | "countdown" | "playing" | "serving" | "spilling" | "over";

/** Reasons the whole game is frozen. Any hold stops every game clock. */
export type HoldReason = "paused" | "tracking" | "hidden";

export type EndReason = "time" | "spills";

export interface GameState {
  config: GameConfig;
  rng: Rng;
  phase: Phase;
  /** Seconds spent in the current phase (only advances while not held). */
  phaseTime: number;
  /** Seconds of active play: the round clock. Advances only in `playing` with no hold. */
  activeTime: number;
  holds: Set<HoldReason>;
  /** Seconds left of the post-hold countdown (0 = none). */
  resumeCountdown: number;

  playerX: number;
  items: FallingItem[];
  nextItemId: number;
  spawnTimer: number;
  lastSpawnX: number;
  /** Active time at which the next cherry is offered, or null when none is scheduled. */
  cherryAt: number | null;

  sundae: Sundae;
  banked: number;
  spills: number;
  served: SundaeRecord[];
  speckles: Speckle[];
  nextSpeckleId: number;
  endReason: EndReason | null;
  /** The last spill/serve, for renderers that join mid-animation. */
  lastSpill: { sundae: Sundae; x: number; at: number } | null;
}

export type GameEvent =
  | { type: "phase"; phase: Phase }
  | { type: "countdown"; value: number; resume: boolean }
  | { type: "spawn"; item: FallingItem }
  | { type: "scoop"; flavor: Flavor; x: number; y: number; scoops: number }
  | { type: "topping"; topping: Topping; x: number; y: number }
  | { type: "topping-wasted"; topping: Topping; x: number; y: number }
  | { type: "rainbow"; x: number; y: number }
  | { type: "cherry-offered" }
  | { type: "cherry-missed" }
  | { type: "miss"; item: FallingItem }
  | { type: "served"; record: SundaeRecord; x: number; banked: number }
  | { type: "spill"; sundae: Sundae; toy: FallingItem; x: number; spills: number; speckles: Speckle[] }
  | { type: "round-over"; reason: EndReason; score: number };

export interface StepInput {
  /** Bowl centre in world px. */
  playerX: number;
}
