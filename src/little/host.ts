import type { LittleApp } from "@kabletv/little-sdk";

/**
 * The Little connection, set once the React hooks connect. `hosted` turns true when a real host
 * (the TV or `little dev`) has entered the app; in a plain browser it stays false.
 */
let app: LittleApp | null = null;
let hosted = false;
let granted = new Set<string>();

export function setLittleApp(next: LittleApp | null): void {
  app = next;
}

export function markEntered(grants: string[] | undefined): void {
  hosted = true;
  granted = new Set(grants ?? []);
}

export function littleApp(): LittleApp | null {
  return app;
}

export function isHosted(): boolean {
  return hosted;
}

/** A capability the host granted for this launch (gate every capability call on this). */
export function can(capability: string): boolean {
  if (!app) return false;
  try {
    return app.can(capability) || granted.has(capability);
  } catch {
    return false;
  }
}

export function emit(name: string, data?: Record<string, unknown>): void {
  if (!app || !hosted) return;
  try {
    app.emit(name, data);
  } catch {
    // Events are best-effort narration hints.
  }
}
