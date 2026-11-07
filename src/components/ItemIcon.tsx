"use client";

import { useEffect, useRef } from "react";
import type { FallingItem } from "@/game/types";
import { drawFallingItem } from "@/render/items";

/** A falling item drawn with the game's own art, for instructions and legends. */
export function ItemIcon({ kind, variant, size = 120, label }: { kind: FallingItem["kind"]; variant: FallingItem["variant"]; size?: number; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.clearRect(0, 0, size, size);
    const radius = size * 0.3;
    const item: FallingItem = { id: 0, kind, variant, x: 0, y: 0, prevY: 0, vy: 0, radius, resolved: false, spin: 0.37 };
    drawFallingItem(ctx, item, size / 2, size / 2 + (kind === "cherry" ? size * 0.06 : 0), 0.4);
  }, [kind, variant, size]);
  return <canvas ref={ref} role="img" aria-label={label} style={{ width: size, height: size }} />;
}
