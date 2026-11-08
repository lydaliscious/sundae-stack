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

export const SKIN = { base: "#ffd9c0", light: "#ffe9da", shade: "#f4b99c", blush: "rgba(255, 112, 138, 0.42)" };
export const HAIR = { base: "#3d2a22", light: "#62463a", dark: "#2a1c17" };
export const IRIS = { light: "#6e4a36", dark: "#21140e" };
/** Blue long-sleeve top with a white star. */
export const ROMPER = { base: "#3f63c9", light: "#6d8de4", dark: "#2c49a1", star: "#f4f7ff" };
export const PANTS = { base: "#3a3d72", light: "#555a99" };
export const SHOE = { base: "#ffffff", light: "#ffffff", sole: "#dfe2ee" };
export const BOWL = { glass: "#bfe7ff", glassLight: "#e9f7ff", glassDark: "#8fcdf2", band: "#ff9ec2", bandDark: "#f2759f" };

export const CHERRY = { base: "#f0304f", light: "#ff7a8c", dark: "#a8132f", stem: "#5b8a3a", leaf: "#7cc35a" };
export const SAUCE = { base: "#5c3220", light: "#8b5436" };
export const WHIP = { base: "#ffffff", shade: "#e3eefa" };

export const TOY_COLORS = ["#ff5d6c", "#3fa7ff", "#ffc23d", "#52c788"];
