// Delad logik för om ett spel tar emot tips just nu. Ren funktion (klient + server).

import type { EventRow, GameRow } from "./types";

/** Är eventets betting öppen globalt (master-switch + deadline)? Null deadline = ingen tidsgräns. */
export function isGloballyOpen(event: EventRow, now: number = Date.now()): boolean {
  if (!event.bettingOpen) return false;
  if (!event.bettingDeadline) return true;
  return now < event.bettingDeadline.getTime();
}

/**
 * Kan deltagare lägga/ändra tips på det här spelet just nu?
 * Kräver att spelet är aktivt, inte avgjort, har egen betting öppen,
 * OCH att eventet är globalt öppet (deadline ej passerad).
 */
export function isGameBettable(
  game: Pick<GameRow, "active" | "status" | "bettingOpen">,
  event: EventRow,
  now: number = Date.now(),
): boolean {
  return (
    game.active &&
    game.status !== "settled" &&
    game.bettingOpen &&
    isGloballyOpen(event, now)
  );
}
