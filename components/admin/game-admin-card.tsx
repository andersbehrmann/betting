"use client";

import { useState, useTransition } from "react";
import { Button, Card, Badge, GameStatusBadge } from "@/components/ui";
import { AnswerInput } from "@/components/games/answer-input";
import {
  saveFacit,
  settlePackage,
  reopenGame,
  clearFacit,
  setManualWinners,
  toggleGameBetting,
} from "@/app/admin/actions";
import { formatMoney, cn } from "@/lib/utils";
import type { GameView } from "@/lib/view";
import type { GameStatus } from "@/lib/types";

interface Props {
  eventId: string;
  view: GameView;
  status: GameStatus;
  bettingOpen: boolean;
  result: unknown;
  betCount: number;
  pot: number;
  currency: string;
  distribution: { label: string; count: number }[];
  winners: { name: string; payout: number; isManual: boolean }[];
  bettors: { id: string; name: string }[];
  teams: { one: string; two: string };
  isPackage: boolean;
}

export function GameAdminCard(props: Props) {
  const { eventId, view, status, bettingOpen, result, betCount, pot, currency, distribution, winners, bettors, teams, isPackage } = props;
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [facit, setFacit] = useState<unknown>(result ?? undefined);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualSel, setManualSel] = useState<Set<string>>(() => new Set<string>());

  const settled = status === "settled";

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Något gick fel.");
    });
  }

  return (
    <Card className={cn("overflow-hidden", isPackage && "border-gold/40")}>
      <div className="flex items-start justify-between gap-3 px-4 py-3.5">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-ink">{view.title}</span>
            {isPackage && <Badge tone="gold">Jackpot</Badge>}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            <span>{betCount} deltar</span>
            <span>
              Pott: <span className="font-semibold text-ink">{formatMoney(pot, currency)}</span>
            </span>
          </div>
        </div>
        <GameStatusBadge status={status} />
      </div>

      {/* Öppna/stänga betting för det här spelet */}
      {status !== "settled" && (
        <div className="flex items-center justify-between gap-3 border-t border-line/70 px-4 py-2.5">
          <span className="flex items-center gap-1.5 text-sm">
            <span aria-hidden>{bettingOpen ? "🟢" : "🔒"}</span>
            <span className={bettingOpen ? "text-grass" : "text-muted"}>
              {bettingOpen ? "Tar emot tips" : "Stängt för tips"}
            </span>
          </span>
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(() => toggleGameBetting(view.id, !bettingOpen))}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50",
              bettingOpen ? "border-line text-muted hover:border-lose hover:text-lose" : "border-grass text-grass hover:bg-grass/10",
            )}
          >
            {bettingOpen ? "Stäng spelet" : "Öppna spelet"}
          </button>
        </div>
      )}

      {/* Svarsfördelning */}
      {distribution.length > 0 && (
        <div className="border-t border-line/70 px-4 py-3">
          <div className="mb-1.5 text-[0.7rem] font-semibold uppercase tracking-wide text-muted">Fördelning</div>
          <div className="space-y-1">
            {distribution.map((d) => (
              <div key={d.label} className="flex items-center gap-2 text-sm">
                <span className="w-8 shrink-0 tabular-nums text-muted">{d.count}×</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-cream-deep">
                  <div
                    className="h-full rounded-full bg-grass/60"
                    style={{ width: `${betCount ? (d.count / betCount) * 100 : 0}%` }}
                  />
                </div>
                <span className="max-w-[45%] truncate text-ink">{d.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Facit */}
      <div className="border-t border-line/70 px-4 py-3.5">
        {isPackage ? (
          <div>
            <p className="mb-2 text-sm text-muted">
              Matchpaketets facit byggs automatiskt från de ordinarie spelens facit
              (världsmästare, resultat, första målskytt, förlängning).
            </p>
            <Button
              size="sm"
              variant="gold"
              disabled={isPending}
              onClick={() => run(() => settlePackage(eventId))}
            >
              Bygg facit & räkna vinnare
            </Button>
          </div>
        ) : (
          <div>
            <div className="mb-2 text-[0.7rem] font-semibold uppercase tracking-wide text-muted">Sätt facit</div>
            <AnswerInput view={view} teams={teams} value={facit} onChange={setFacit} disabled={isPending} />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" disabled={isPending} onClick={() => run(() => saveFacit(view.id, facit))}>
                {settled ? "Uppdatera facit" : "Spara facit & räkna"}
              </Button>
              {settled && (
                <Button size="sm" variant="outline" disabled={isPending} onClick={() => run(() => reopenGame(view.id))}>
                  Återöppna
                </Button>
              )}
              {(settled || result != null) && (
                <Button size="sm" variant="ghost" disabled={isPending} onClick={() => run(() => clearFacit(view.id))}>
                  Rensa
                </Button>
              )}
            </div>
          </div>
        )}
        {error && <p className="mt-2 text-sm text-lose">{error}</p>}
      </div>

      {/* Vinnare */}
      {winners.length > 0 && (
        <div className="border-t border-line/70 bg-grass/5 px-4 py-3">
          <div className="mb-1 text-[0.7rem] font-semibold uppercase tracking-wide text-grass">
            Vinnare {winners.some((w) => w.isManual) && <Badge tone="gold" className="ml-1">Manuellt justerad</Badge>}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {winners.map((w, i) => (
              <span key={i} className="rounded-full bg-chalk px-2.5 py-1 text-sm text-ink">
                {w.name} · <span className="font-semibold text-win">{formatMoney(w.payout, currency)}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Manuell justering */}
      <div className="border-t border-line/70 px-4 py-2.5">
        <button
          type="button"
          onClick={() => setManualOpen((o) => !o)}
          className="text-sm font-medium text-muted hover:text-pitch"
        >
          {manualOpen ? "− Dölj manuell justering" : "+ Manuell justering av vinnare"}
        </button>
        {manualOpen && (
          <div className="mt-2">
            {bettors.length === 0 ? (
              <p className="text-sm text-muted">Inga deltagare i det här spelet.</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-1.5">
                  {bettors.map((b) => {
                    const on = manualSel.has(b.id);
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() =>
                          setManualSel((prev) => {
                            const n = new Set(prev);
                            if (n.has(b.id)) n.delete(b.id);
                            else n.add(b.id);
                            return n;
                          })
                        }
                        className={cn(
                          "rounded-lg border px-2.5 py-1.5 text-sm",
                          on ? "border-grass bg-grass text-chalk" : "border-line bg-cream text-ink",
                        )}
                      >
                        {b.name}
                      </button>
                    );
                  })}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  disabled={isPending}
                  onClick={() => run(() => setManualWinners(view.id, [...manualSel]))}
                >
                  Spara manuella vinnare ({manualSel.size})
                </Button>
                <p className="mt-1 text-xs text-muted">Potten delas lika mellan valda och markeras som manuell.</p>
              </>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
