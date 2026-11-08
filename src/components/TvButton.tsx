"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";

type Tone = "candy" | "mint" | "cream" | "ghost";

const TONES: Record<Tone, string> = {
  candy: "bg-[#e5323f] text-[#fffaf0] hover:bg-[#d8293c] shadow-[0_8px_0_#a31a2a]",
  mint: "bg-[#7fd8b4] text-[#2f4a40] hover:bg-[#6fd0a9] shadow-[0_8px_0_#4fa984]",
  cream: "bg-[#fff8f1] text-[#5b3a3f] hover:bg-white shadow-[0_8px_0_rgba(91,58,63,0.25)]",
  ghost: "bg-white/70 text-[#5b3a3f] hover:bg-white shadow-[0_6px_0_rgba(91,58,63,0.2)]",
};

type Props = Omit<ComponentProps<typeof Button>, "size" | "variant"> & {
  tone?: Tone;
  size?: "lg" | "md" | "icon";
  /** Little perception: the tool this control triggers and how the agent should call it. */
  action?: string;
  label?: string;
  littleId?: string;
  littleData?: Record<string, unknown>;
};

/** A big, remote-friendly button annotated for Little. */
export function TvButton({ tone = "cream", size = "md", action, label, littleId, littleData, className, children, ...rest }: Props) {
  return (
    <Button
      data-nav=""
      data-little="control"
      data-little-action={action}
      data-little-label={label}
      data-little-id={littleId}
      data-little-data={littleData ? JSON.stringify(littleData) : undefined}
      className={cn(
        "border-[5px] border-[#5b3a3f] font-sans font-semibold transition-transform active:translate-y-1 [&_svg:not([class*='size-'])]:size-10",
        size === "lg" && "h-[104px] gap-5 rounded-[36px] px-12 text-[44px]",
        size === "md" && "h-[84px] gap-4 rounded-[30px] px-9 text-[34px]",
        size === "icon" && "size-[96px] rounded-full p-0",
        TONES[tone],
        className,
      )}
      {...rest}
    >
      {children}
    </Button>
  );
}
