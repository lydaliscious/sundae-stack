"use client";

import { useEffect, type RefObject } from "react";

type Dir = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight";

function focusables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>("[data-nav]")].filter((el) => {
    if (el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true") return false;
    if (el.closest("[inert]")) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
}

/** Picks the nearest focusable in the pressed direction (remote D-pad spatial navigation). */
export function nextInDirection(from: DOMRect, candidates: { el: HTMLElement; rect: DOMRect }[], dir: Dir) {
  const cx = from.left + from.width / 2;
  const cy = from.top + from.height / 2;
  let best: HTMLElement | null = null;
  let bestScore = Infinity;
  for (const { el, rect } of candidates) {
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const dx = x - cx;
    const dy = y - cy;
    const along = dir === "ArrowRight" ? dx : dir === "ArrowLeft" ? -dx : dir === "ArrowDown" ? dy : -dy;
    const across = dir === "ArrowRight" || dir === "ArrowLeft" ? Math.abs(dy) : Math.abs(dx);
    if (along <= 4) continue;
    const score = along + across * 2.2;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }
  return best;
}

/**
 * Arrow keys move focus between `[data-nav]` controls inside `root`; Enter activates the focused
 * button natively. Disabled while `enabled` is false (e.g. during gameplay, where arrows steer).
 */
export function useRemoteNav(root: RefObject<HTMLElement | null>, enabled: boolean, focusKey: string) {
  useEffect(() => {
    if (!enabled) return;
    const el = root.current;
    if (!el) return;
    // Land focus on the screen's primary control when the screen changes.
    const t = setTimeout(() => {
      const items = focusables(el);
      const primary = items.find((i) => i.dataset.primary !== undefined) ?? items[0];
      if (primary && !el.contains(document.activeElement)) primary.focus({ preventScroll: true });
      else if (primary && document.activeElement && !items.includes(document.activeElement as HTMLElement)) primary.focus({ preventScroll: true });
    }, 30);
    const onKey = (e: KeyboardEvent) => {
      if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) return;
      const items = focusables(el);
      if (!items.length) return;
      const current = document.activeElement as HTMLElement | null;
      e.preventDefault();
      if (!current || !items.includes(current)) {
        items[0].focus({ preventScroll: true });
        return;
      }
      const next = nextInDirection(
        current.getBoundingClientRect(),
        items.filter((i) => i !== current).map((i) => ({ el: i, rect: i.getBoundingClientRect() })),
        e.key as Dir,
      );
      next?.focus({ preventScroll: true });
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [root, enabled, focusKey]);
}
