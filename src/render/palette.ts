import type { Flavor, Topping } from "@/game/types";

export interface FlavorColors {
  base: string;
  light: string;
  dark: string;
  /** Speckle / splatter colour. */
  splat: string;
  label: string;
}

export const FLAVOR: Record<Flavor, FlavorColors> = {
  vanilla: { base: "#fff1cf", light: "#fffaf0", dark: "#eccf94", splat: "#fbe8b8", label: "Vanilla" },
  strawberry: { base: "#ffaec8", light: "#ffd6e3", dark: "#e9789c", splat: "#ff8fb3", label: "Strawberry" },
  chocolate: { base: "#9a603f", light: "#c48a64", dark: "#6c3d26", splat: "#7b4a2f", label: "Chocolate" },
  mint: { base: "#b4f0d6", light: "#dcfbec", dark: "#79cfab", splat: "#8ee3bf", label: "Mint" },
};

export const TOPPING_LABEL: Record<Topping, string> = {
  sprinkles: "Sprinkles",
  sauce: "Chocolate sauce",
  whip: "Whipped cream",
};

export const SPRINKLE_COLORS = ["#ff6f91", "#ffc75f", "#57c7ff", "#8be08b", "#b388ff", "#ff9671"];

export const INK = "#5b3a3f";
export const INK_SOFT = "rgba(91, 58, 63, 0.55)";

export const SKIN = { base: "#ffd9c0", light: "#ffe9da", shade: "#f4b99c", blush: "rgba(255, 122, 146, 0.38)" };
export const HAIR = { base: "#9a6242", light: "#c08458" };
export const ROMPER = { base: "#b9a4f2", light: "#d9ccff", dark: "#8f78d8", pocket: "#ffd4e2" };
export const SHOE = { base: "#ff8fa8", light: "#ffc2cf", sole: "#fff4f6" };
export const BOWL = { glass: "#bfe7ff", glassLight: "#e9f7ff", glassDark: "#8fcdf2", band: "#ff9ec2", bandDark: "#f2759f" };

export const CHERRY = { base: "#f0304f", light: "#ff7a8c", dark: "#a8132f", stem: "#5b8a3a", leaf: "#7cc35a" };
export const SAUCE = { base: "#5c3220", light: "#8b5436" };
export const WHIP = { base: "#ffffff", shade: "#e3eefa" };

export const TOY_COLORS = ["#ff5d6c", "#3fa7ff", "#ffc23d", "#52c788"];
