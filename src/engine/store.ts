import type { EndReason, Flavor, Phase } from "@/game/types";
import type { AdapterKind } from "@/input/adapters/types";
import type { CalibrationStep } from "@/input/calibration";
import type { TrackingProblem, TrackingStatus } from "@/input/tracking";

export type Screen = "menu" | "calibrate" | "game" | "results";
export type Mode = "camera" | "keyboard";

export interface Hud {
  banked: number;
  pending: number;
  timeLeft: number;
  spills: number;
  spillsLeft: number;
  scoops: number;
  toppings: number;
  flavors: Flavor[];
  rainbow: boolean;
  cherryFalling: boolean;
  phase: Phase;
  /** Seconds left on the start or resume countdown (0 when none). */
  countdown: number;
  /** The game is frozen (pause, tracking loss, hidden). */
  frozen: boolean;
  served: number;
}

export interface Banner {
  id: number;
  text: string;
  tone: "info" | "good" | "bad" | "rainbow";
  /** Which half of the screen to use, so the banner never covers the sundae. */
  side: "left" | "right";
}

export interface TrackingUi {
  status: TrackingStatus | "off";
  problem: TrackingProblem;
  source: AdapterKind | null;
  starting: boolean;
  error: string | null;
}

export interface CalibrationUi {
  step: CalibrationStep;
  progress: number;
  /** Live position in unit space during the test step. */
  unit: number;
  usedDefault: boolean;
}

export interface ResultCard {
  id: number;
  points: number;
  rainbow: boolean;
  caption: string;
  image: string;
  scoops: number;
}

export interface Results {
  score: number;
  best: number;
  newBest: boolean;
  reason: EndReason;
  sundaes: ResultCard[];
}

export interface UiState {
  screen: Screen;
  mode: Mode;
  sound: boolean;
  /** The pause menu is open. */
  paused: boolean;
  pauseReason: "user" | "away" | null;
  hud: Hud;
  banner: Banner | null;
  tracking: TrackingUi;
  calibration: CalibrationUi;
  results: Results | null;
  best: number;
  hosted: boolean;
}

export const initialHud: Hud = {
  banked: 0,
  pending: 0,
  timeLeft: 60,
  spills: 0,
  spillsLeft: 3,
  scoops: 0,
  toppings: 0,
  flavors: [],
  rainbow: false,
  cherryFalling: false,
  phase: "idle",
  countdown: 0,
  frozen: false,
  served: 0,
};

/** A tiny external store for useSyncExternalStore. */
export class Store<T> {
  private listeners = new Set<() => void>();
  constructor(private state: T) {}

  get = () => this.state;

  set(patch: Partial<T> | ((s: T) => Partial<T>)) {
    const next = typeof patch === "function" ? patch(this.state) : patch;
    let changed = false;
    for (const k of Object.keys(next) as (keyof T)[]) {
      if (!Object.is(this.state[k], next[k])) {
        changed = true;
        break;
      }
    }
    if (!changed) return;
    this.state = { ...this.state, ...next };
    for (const l of this.listeners) l();
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
}

export function sameHud(a: Hud, b: Hud): boolean {
  return (Object.keys(a) as (keyof Hud)[]).every((k) =>
    Array.isArray(a[k]) ? (a[k] as unknown[]).join() === (b[k] as unknown[]).join() : a[k] === b[k],
  );
}
