"use client";

import { useTransition } from "react";
import { Card } from "@/components/ui";
import { cn } from "@/lib/utils";
import { setBettingOpen, toggleEventFlag } from "@/app/admin/actions";

function Toggle({
  label,
  hint,
  on,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  on: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div>
        <div className="text-sm font-medium text-ink">{label}</div>
        {hint && <div className="text-xs text-muted">{hint}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        disabled={disabled}
        onClick={() => onChange(!on)}
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50",
          on ? "bg-grass" : "bg-line",
        )}
      >
        <span
          className={cn(
            // left-0.5 pinnar basläget (annars ärvs elementets static position ~24px).
            "absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-chalk shadow transition-transform",
            on ? "translate-x-5" : "translate-x-0",
          )}
        />
      </button>
    </div>
  );
}

export function AdminControls({
  bettingOpen,
  deadlinePassed,
  leaderboardVisible,
  betsPublic,
}: {
  bettingOpen: boolean;
  deadlinePassed: boolean;
  leaderboardVisible: boolean;
  betsPublic: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Card className="px-4 py-2">
      <Toggle
        label="Bettingen öppen"
        hint={deadlinePassed ? "Deadline har passerat – tips är låsta oavsett." : "Stäng för att låsa tips tidigare."}
        on={bettingOpen && !deadlinePassed}
        disabled={isPending || deadlinePassed}
        onChange={(v) => startTransition(() => void setBettingOpen(v))}
      />
      <div className="border-t border-line/60" />
      <Toggle
        label="Visa resultattavla"
        hint="Gör /leaderboard synlig för deltagarna."
        on={leaderboardVisible}
        disabled={isPending}
        onChange={(v) => startTransition(() => void toggleEventFlag("leaderboard_visible", v))}
      />
      <div className="border-t border-line/60" />
      <Toggle
        label="Offentliggör allas tips"
        hint="Låt deltagarna se varandras tips efter spelstopp."
        on={betsPublic}
        disabled={isPending}
        onChange={(v) => startTransition(() => void toggleEventFlag("bets_public", v))}
      />
    </Card>
  );
}
