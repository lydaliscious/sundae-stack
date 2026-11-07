import type { GameConfig } from "@/game/config";
import type { SundaeRecord } from "@/game/types";
import { FLAVOR, TOPPING_LABEL } from "./palette";
import { drawSundaeRecord, sundaeExtent } from "./sundae";

/** Renders a served sundae as a small transparent PNG for the results screen. */
export function sundaeThumbnail(record: SundaeRecord, config: GameConfig, width = 220, height = 280): string {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const { above, below } = sundaeExtent(record.scoops, config);
  const bowlWidth = 260;
  const scale = Math.min((height - 16) / (above + below), (width - 12) / bowlWidth);
  ctx.translate(width / 2, height - 8 - below * scale);
  ctx.scale(scale, scale);
  drawSundaeRecord(ctx, 0, 0, record.scoops, config, true);
  return canvas.toDataURL("image/png");
}

/** A spoken description of a sundae, for `data-little-caption`. */
export function describeSundae(record: Pick<SundaeRecord, "scoops" | "rainbow">): string {
  const counts = new Map<string, number>();
  for (const sc of record.scoops) counts.set(FLAVOR[sc.flavor].label.toLowerCase(), (counts.get(FLAVOR[sc.flavor].label.toLowerCase()) ?? 0) + 1);
  const scoops = [...counts].map(([f, n]) => `${n} ${f}`).join(", ");
  const toppings = [...new Set(record.scoops.flatMap((sc) => sc.toppings))].map((t) => TOPPING_LABEL[t].toLowerCase());
  const parts = [`${record.scoops.length}-scoop sundae (${scoops})`];
  if (toppings.length) parts.push(`with ${toppings.join(" and ")}`);
  parts.push("and a cherry on top");
  return parts.join(" ") + (record.rainbow ? " — a Rainbow Sundae" : "");
}
