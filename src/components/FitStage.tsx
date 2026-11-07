"use client";

import { forwardRef, useLayoutEffect, useState, type ReactNode } from "react";

export const STAGE_WIDTH = 1920;
export const STAGE_HEIGHT = 1080;

/**
 * Lays the app out once at 1920×1080 and scales it to the window, letterboxed. On a Little TV the
 * host already renders at 1920×1080, so the scale is 1 there.
 */
export const FitStage = forwardRef<HTMLDivElement, { children: ReactNode }>(function FitStage({ children }, ref) {
  const [fit, setFit] = useState({ scale: 1, x: 0, y: 0 });

  useLayoutEffect(() => {
    const update = () => {
      const scale = Math.min(window.innerWidth / STAGE_WIDTH, window.innerHeight / STAGE_HEIGHT);
      setFit({ scale, x: (window.innerWidth - STAGE_WIDTH * scale) / 2, y: (window.innerHeight - STAGE_HEIGHT * scale) / 2 });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return (
    <div ref={ref} className="stage-root" style={{ transform: `translate(${fit.x}px, ${fit.y}px) scale(${fit.scale})` }}>
      {children}
    </div>
  );
});
