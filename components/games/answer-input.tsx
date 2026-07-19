"use client";

import { cn } from "@/lib/utils";
import type { GameView } from "@/lib/view";
import type { ScoreAnswer } from "@/lib/scoring/types";

// --- Optionsknappar (radio-liknande, stora klickytor) ---

export function OptionButtons({
  options,
  value,
  onChange,
  disabled,
}: {
  options: { value: string; label: string }[];
  value: string | undefined;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(o.value)}
            aria-pressed={active}
            className={cn(
              "min-h-12 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "border-grass bg-grass text-chalk shadow-[0_4px_14px_-6px_rgba(26,138,84,0.8)]"
                : "border-line bg-cream text-ink hover:border-grass/60",
              disabled && "opacity-60",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// --- Målskytt (dropdown, många alternativ) ---

export function ScorerSelect({
  options,
  value,
  onChange,
  disabled,
}: {
  options: { value: string; label: string }[];
  value: string | undefined;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <select
      value={value ?? ""}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="h-12 w-full rounded-xl border border-line bg-cream px-3 text-base text-ink outline-none focus:border-grass focus:bg-chalk disabled:opacity-60"
    >
      <option value="" disabled>
        Välj målskytt…
      </option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// --- Resultat (två stegare) ---

function Stepper({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex-1 rounded-xl border border-line bg-cream p-2 text-center">
      <div className="mb-1 truncate text-xs font-semibold text-muted">{label}</div>
      <div className="flex items-center justify-center gap-2">
        <button
          type="button"
          disabled={disabled || value <= 0}
          onClick={() => onChange(Math.max(0, value - 1))}
          className="grid h-9 w-9 place-items-center rounded-full bg-cream-deep text-lg font-bold text-ink disabled:opacity-40"
          aria-label={`Minska ${label}`}
        >
          −
        </button>
        <span className="w-8 font-display text-2xl tabular-nums">{value}</span>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(Math.min(30, value + 1))}
          className="grid h-9 w-9 place-items-center rounded-full bg-grass text-lg font-bold text-chalk disabled:opacity-40"
          aria-label={`Öka ${label}`}
        >
          +
        </button>
      </div>
    </div>
  );
}

export function ScoreInput({
  teams,
  value,
  onChange,
  disabled,
}: {
  teams: { one: string; two: string };
  value: ScoreAnswer | undefined;
  onChange: (v: ScoreAnswer) => void;
  disabled?: boolean;
}) {
  const v = value ?? { home: 0, away: 0 };
  return (
    <div className="flex items-stretch gap-2">
      <Stepper label={teams.one} value={v.home} disabled={disabled} onChange={(h) => onChange({ ...v, home: h })} />
      <Stepper label={teams.two} value={v.away} disabled={disabled} onChange={(a) => onChange({ ...v, away: a })} />
    </div>
  );
}

/** Väljer rätt kontroll utifrån spelets inputKind (ej package). */
export function AnswerInput({
  view,
  teams,
  value,
  onChange,
  disabled,
}: {
  view: GameView;
  teams: { one: string; two: string };
  value: unknown;
  onChange: (answer: unknown) => void;
  disabled?: boolean;
}) {
  if (view.inputKind === "score") {
    return <ScoreInput teams={teams} value={value as ScoreAnswer | undefined} onChange={onChange} disabled={disabled} />;
  }
  if (view.inputKind === "scorer") {
    const val = (value as { value?: string } | undefined)?.value;
    return (
      <ScorerSelect
        options={view.options}
        value={val}
        onChange={(v) => onChange({ value: v })}
        disabled={disabled}
      />
    );
  }
  // option
  const val = (value as { value?: string } | undefined)?.value;
  return (
    <OptionButtons
      options={view.options}
      value={val}
      onChange={(v) => onChange({ value: v })}
      disabled={disabled}
    />
  );
}
