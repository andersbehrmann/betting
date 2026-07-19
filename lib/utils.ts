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

/** Formaterar minor units (öre/cents) som belopp, t.ex. 2500 → "25,00 kr". Gratis → "Gratis". */
export function formatCents(cents: number, currency = "SEK"): string {
  if (cents <= 0) return "Gratis";
  return formatMoney(cents / 100, currency);
}
