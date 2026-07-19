// Tidshantering i Europe/Stockholm. Lagring sker i UTC (timestamptz);
// admin matar in och ser tider i Stockholmstid.

import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export const TZ = "Europe/Stockholm";

/** Formatera ett datum i Stockholmstid, t.ex. "19 jul 2026 21:00". */
export function formatStockholm(date: Date, pattern = "d MMM yyyy HH:mm"): string {
  return formatInTimeZone(date, TZ, pattern);
}

/** Värde för <input type="datetime-local"> i Stockholmstid ("yyyy-MM-ddTHH:mm"). */
export function toDatetimeLocal(date: Date): string {
  return formatInTimeZone(date, TZ, "yyyy-MM-dd'T'HH:mm");
}

/** Tolka en datetime-local-sträng (utan tz) som Stockholmstid → UTC-Date. */
export function fromDatetimeLocal(value: string): Date {
  return fromZonedTime(value, TZ);
}
