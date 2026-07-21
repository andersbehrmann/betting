import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formaterar ett belopp som kronor med 2 decimaler, t.ex. "25,00 kr". */
export function formatMoney(amount: number, currency = "SEK"): string {
  const suffix = currency === "SEK" ? "kr" : currency;
  return `${amount.toLocaleString("sv-SE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${suffix}`;
}

/**
 * Formaterar ett belopp i hela kronor, t.ex. "−17 kr". Resultattavlan och
 * swishlistan visar aldrig ören: ingen swishar 16,67 kr, och två vyer som
 * avrundar olika ser ut som ett räknefel. `|| 0` städar bort −0.
 */
export function formatKronor(amount: number, currency = "SEK"): string {
  const suffix = currency === "SEK" ? "kr" : currency;
  return `${(Math.round(amount) || 0).toLocaleString("sv-SE")} ${suffix}`;
}

/** Formaterar minor units (öre/cents) som belopp, t.ex. 2500 → "25,00 kr". Gratis → "Gratis". */
export function formatCents(cents: number, currency = "SEK"): string {
  if (cents <= 0) return "Gratis";
  return formatMoney(cents / 100, currency);
}
