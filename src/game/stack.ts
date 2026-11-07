import type { GameConfig } from "./config";
import type { StackScoop } from "./types";

export interface StackLayout {
  /** World y of each scoop centre, bottom first. */
  scoopY: number[];
  /** Vertical distance between scoop centres after compression. */
  step: number;
  /** World y of the catch surface: the visible top of the stack, or the bowl opening. */
  surfaceY: number;
  /** Width of the catch surface. */
  surfaceWidth: number;
  /** Total height above the rim. */
  height: number;
}

/**
 * Lays out the scoop stack in world coordinates. Spacing compresses once the stack would grow
 * past `maxHeight`, and the catch surface always follows the compressed visual top.
 */
export function layoutStack(scoops: readonly StackScoop[], config: GameConfig): StackLayout {
  const { rimY, bowlOpening } = config.toddler;
  const s = config.stack;
  const n = scoops.length;
  if (n === 0) return { scoopY: [], step: s.step, surfaceY: rimY, surfaceWidth: bowlOpening, height: 0 };

  const top = scoops[n - 1];
  const whip = top.toppings.includes("whip") ? s.whipHeight : 0;
  const crown = s.scoopRadius * s.domeFactor + whip;
  let step = s.step;
  if (n > 1) {
    const room = s.maxHeight - s.baseOffset - crown;
    step = Math.max(0, Math.min(s.step, room / (n - 1)));
  }
  const scoopY = scoops.map((_, i) => rimY - s.baseOffset - i * step);
  const surfaceY = scoopY[n - 1] - crown;
  return { scoopY, step, surfaceY, surfaceWidth: s.topWidth, height: rimY - surfaceY };
}
