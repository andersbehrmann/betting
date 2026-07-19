"use client";

import { useTransition } from "react";
import { Card } from "@/components/ui";
import { cn, formatMoney } from "@/lib/utils";
import { toggleGame } from "@/app/admin/actions";

export function GameToggles({
  games,
  currency,
}: {
  games: { id: string; title: string; active: boolean; stake: number; isJackpot: boolean }[];
  currency: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Card className="divide-y divide-line/60 overflow-hidden">
      {games.map((g) => (
        <div key={g.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-ink">{g.title}</div>
            <div className="text-xs text-muted">
              {formatMoney(g.stake, currency)}
              {g.isJackpot && " · jackpot"}
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={g.active}
            disabled={isPending}
            onClick={() => startTransition(() => void toggleGame(g.id, !g.active))}
            className={cn(
              "relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50",
              g.active ? "bg-grass" : "bg-line",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 h-6 w-6 rounded-full bg-chalk shadow transition-transform",
                g.active ? "translate-x-[1.375rem]" : "translate-x-0.5",
              )}
            />
          </button>
        </div>
      ))}
    </Card>
  );
}
