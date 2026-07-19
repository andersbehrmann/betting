import * as React from "react";
import { cn } from "@/lib/utils";
import type { GameStatus, PaymentStatus } from "@/lib/types";

// --- Button ---

type ButtonVariant = "primary" | "gold" | "outline" | "ghost" | "danger";
type ButtonSize = "md" | "lg" | "sm";

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-[var(--radius-pill)] font-medium transition-[transform,background-color,box-shadow] duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-2";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-grass text-chalk shadow-[0_6px_18px_-6px_rgba(26,138,84,0.7)] hover:bg-grass-bright",
  gold: "bg-gold text-pitch-deep shadow-[0_6px_18px_-6px_rgba(230,164,23,0.7)] hover:brightness-105",
  outline: "border border-line bg-chalk text-ink hover:border-grass hover:text-grass",
  ghost: "text-ink hover:bg-cream-deep",
  danger: "bg-lose text-chalk hover:brightness-110",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-[0.95rem]",
  lg: "h-14 px-6 text-base w-full",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <button className={cn(buttonBase, buttonVariants[variant], buttonSizes[size], className)} {...props} />
  );
}

// --- Card ---

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-card)] border border-line bg-chalk shadow-[0_1px_2px_rgba(20,35,27,0.04),0_12px_28px_-20px_rgba(20,35,27,0.25)]",
        className,
      )}
      {...props}
    />
  );
}

// --- Badge / status ---

export function Badge({
  className,
  tone = "neutral",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "green" | "gold" | "red" | "muted";
}) {
  const tones: Record<string, string> = {
    neutral: "bg-cream-deep text-ink",
    green: "bg-grass/15 text-grass",
    gold: "bg-gold/20 text-[#8a5f00]",
    red: "bg-lose/15 text-lose",
    muted: "bg-cream-deep text-muted",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[var(--radius-pill)] px-2.5 py-1 text-xs font-medium",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

const GAME_STATUS_META: Record<GameStatus, { label: string; tone: "green" | "gold" | "muted" | "neutral" }> = {
  open: { label: "Öppen", tone: "green" },
  closed: { label: "Stängd", tone: "neutral" },
  awaiting_result: { label: "Väntar på facit", tone: "muted" },
  settled: { label: "Avgjord", tone: "gold" },
};

export function GameStatusBadge({ status }: { status: GameStatus }) {
  const m = GAME_STATUS_META[status];
  return <Badge tone={m.tone}>{m.label}</Badge>;
}

const PAYMENT_META: Record<PaymentStatus, { label: string; tone: "red" | "green" | "muted" }> = {
  unpaid: { label: "Ej betalat", tone: "red" },
  paid: { label: "Betalat", tone: "green" },
  settled: { label: "Slutreglerat", tone: "muted" },
};

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  const m = PAYMENT_META[status];
  return <Badge tone={m.tone}>{m.label}</Badge>;
}

// --- Form fields ---

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-muted", className)}
      {...props}
    />
  );
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "h-12 w-full rounded-xl border border-line bg-cream px-4 text-base text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-grass focus:bg-chalk",
          className,
        )}
        {...props}
      />
    );
  },
);

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-xl border border-line bg-cream px-4 py-3 text-base text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-grass focus:bg-chalk",
        className,
      )}
      {...props}
    />
  );
}

// --- Small helpers ---

export function StatPill({ label, value, tone = "neutral" }: { label: string; value: React.ReactNode; tone?: "neutral" | "gold" | "green" }) {
  const tones = {
    neutral: "bg-cream-deep",
    gold: "bg-gold/15",
    green: "bg-grass/12",
  };
  return (
    <div className={cn("rounded-xl px-3 py-2 text-center", tones[tone])}>
      <div className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className="font-display text-lg text-ink">{value}</div>
    </div>
  );
}
