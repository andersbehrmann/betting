"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Badge } from "@/components/ui";
import { AnswerInput, OptionButtons, ScoreInput, ScorerSelect } from "@/components/games/answer-input";
import { submitBets, type SubmitSelection } from "@/app/actions";
import { formatMoney, cn } from "@/lib/utils";
import type { GameView } from "@/lib/view";
import type { PackageAnswer, ScoreAnswer } from "@/lib/scoring/types";

interface LockedItem {
  title: string;
  stake: number;
  isJackpot: boolean;
  answerText: string;
  settled: boolean;
}

interface Props {
  currency: string;
  teams: { one: string; two: string };
  views: GameView[];
  initial: { gameId: string; answer: unknown }[];
  locked?: LockedItem[];
}

function answerComplete(view: GameView, answer: unknown): boolean {
  if (answer == null) return false;
  if (view.inputKind === "score") {
    const s = answer as ScoreAnswer;
    return typeof s.home === "number" && typeof s.away === "number";
  }
  if (view.inputKind === "package") {
    const p = answer as PackageAnswer;
    return Boolean(p.world_champion || p.result_90 || p.first_scorer || p.extra_time);
  }
  return Boolean((answer as { value?: string }).value);
}

export function BettingBoard({ currency, teams, views, initial, locked = [] }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const ordinary = views.filter((v) => !v.isJackpot);
  const packageView = views.find((v) => v.isJackpot);

  const initialSelected = new Set(initial.map((b) => b.gameId));
  const initialAnswers: Record<string, unknown> = {};
  for (const b of initial) initialAnswers[b.gameId] = b.answer;

  const [selected, setSelected] = useState<Set<string>>(initialSelected);
  const [answers, setAnswers] = useState<Record<string, unknown>>(initialAnswers);

  const byId = useMemo(() => new Map(views.map((v) => [v.id, v])), [views]);

  function toggle(view: GameView) {
    setError(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(view.id)) {
        next.delete(view.id);
      } else {
        next.add(view.id);
        if (view.inputKind === "score" && answers[view.id] == null) {
          setAnswers((a) => ({ ...a, [view.id]: { home: 0, away: 0 } }));
        }
      }
      return next;
    });
  }

  function setAnswer(id: string, answer: unknown) {
    setError(null);
    setAnswers((a) => ({ ...a, [id]: answer }));
  }

  const selectedViews = views.filter((v) => selected.has(v.id));
  const total = selectedViews.reduce((sum, v) => sum + v.stake, 0);
  const count = selectedViews.length;

  const lockedTotal = locked.reduce((sum, l) => sum + l.stake, 0);
  const committedTotal = total + lockedTotal;

  const incomplete = selectedViews.filter((v) => !answerComplete(v, answers[v.id]));

  function ordinaryAnswerValue(gameKey: string): string | undefined {
    const v = ordinary.find((o) => o.gameKey === gameKey);
    if (!v) return undefined;
    return (answers[v.id] as { value?: string } | undefined)?.value;
  }
  function ordinaryScore(gameKey: string): ScoreAnswer | undefined {
    const v = ordinary.find((o) => o.gameKey === gameKey);
    if (!v) return undefined;
    return answers[v.id] as ScoreAnswer | undefined;
  }

  function copyToPackage() {
    if (!packageView) return;
    const pkg: PackageAnswer = {
      world_champion: ordinaryAnswerValue("world_champion"),
      result_90: ordinaryScore("result_90"),
      first_scorer: ordinaryAnswerValue("first_scorer"),
      extra_time: ordinaryAnswerValue("extra_time"),
    };
    setAnswer(packageView.id, pkg);
    if (!selected.has(packageView.id)) toggle(packageView);
  }

  function openConfirm() {
    setError(null);
    if (count === 0) {
      setError("Välj minst ett spel att delta i.");
      return;
    }
    if (incomplete.length > 0) {
      setError(`Fyll i tips för: ${incomplete.map((v) => v.title).join(", ")}.`);
      return;
    }
    setConfirmOpen(true);
  }

  function doSubmit() {
    const selections: SubmitSelection[] = selectedViews.map((v) => ({
      gameId: v.id,
      answer: answers[v.id],
    }));
    startTransition(async () => {
      const res = await submitBets(selections);
      if (!res.ok) {
        setConfirmOpen(false);
        setError(res.error);
        return;
      }
      router.push("/my-bets?submitted=1");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 pb-40">
      <div className="flex items-center justify-between px-1">
        <h2 className="font-display text-lg font-bold text-pitch">Välj dina spel</h2>
        <span className="text-sm text-muted">{count} valda</span>
      </div>

      {ordinary.map((view) => {
        const isOn = selected.has(view.id);
        return (
          <GameCard
            key={view.id}
            view={view}
            teams={teams}
            currency={currency}
            selected={isOn}
            answer={answers[view.id]}
            onToggle={() => toggle(view)}
            onAnswer={(a) => setAnswer(view.id, a)}
          />
        );
      })}

      {packageView && (
        <PackageCard
          view={packageView}
          teams={teams}
          currency={currency}
          selected={selected.has(packageView.id)}
          answer={(answers[packageView.id] as PackageAnswer) ?? {}}
          ordinaryViews={ordinary}
          onToggle={() => toggle(packageView)}
          onAnswer={(a) => setAnswer(packageView.id, a)}
          onCopy={copyToPackage}
        />
      )}

      {locked.length > 0 && (
        <div className="pt-2">
          <h2 className="px-1 pb-1 font-display text-base font-bold text-muted">Låsta spel</h2>
          <p className="px-1 pb-2 text-xs text-muted">
            Redan inskickade tips på spel som stängts. De räknas med i din totala insats.
          </p>
          <div className="space-y-2">
            {locked.map((l, i) => (
              <Card key={i} className="flex items-center justify-between gap-3 px-4 py-3 opacity-90">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-ink">{l.title}</span>
                    {l.isJackpot && <Badge tone="gold">Jackpot</Badge>}
                  </div>
                  <p className="mt-0.5 truncate text-sm text-muted">Ditt tips: {l.answerText}</p>
                </div>
                <Badge tone={l.settled ? "gold" : "neutral"}>{l.settled ? "Avgjord" : "Stängd"}</Badge>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Sticky summering + skicka in */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-cream/95 backdrop-blur-md">
        <div className="mx-auto max-w-xl px-4 py-3">
          {error && (
            <p className="mb-2 rounded-lg bg-lose/12 px-3 py-2 text-sm text-lose">{error}</p>
          )}
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted">Din totala insats</div>
              <div className="font-display text-2xl font-bold text-pitch">{formatMoney(committedTotal, currency)}</div>
            </div>
            <Button size="md" className="px-7" onClick={openConfirm} disabled={isPending}>
              Skicka in
            </Button>
          </div>
        </div>
      </div>

      {confirmOpen && (
        <ConfirmSheet
          total={committedTotal}
          count={count}
          lockedCount={locked.length}
          currency={currency}
          items={selectedViews.map((v) => ({ title: v.title, stake: v.stake, jackpot: v.isJackpot }))}
          pending={isPending}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={doSubmit}
        />
      )}
    </div>
  );
}

function GameCard({
  view,
  teams,
  currency,
  selected,
  answer,
  onToggle,
  onAnswer,
}: {
  view: GameView;
  teams: { one: string; two: string };
  currency: string;
  selected: boolean;
  answer: unknown;
  onToggle: () => void;
  onAnswer: (a: unknown) => void;
}) {
  return (
    <Card className={cn("overflow-hidden transition-colors", selected && "ring-1 ring-grass/40")}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
      >
        <span
          className={cn(
            "grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 transition-colors",
            selected ? "border-grass bg-grass text-chalk" : "border-line bg-cream",
          )}
          aria-hidden
        >
          {selected && "✓"}
        </span>
        <span className="flex-1">
          <span className="block font-medium leading-tight text-ink">{view.title}</span>
          {view.description && (
            <span className="mt-0.5 block text-xs leading-snug text-muted">{view.description}</span>
          )}
        </span>
        <Badge tone="muted">{formatMoney(view.stake, currency)}</Badge>
      </button>
      {selected && (
        <div className="border-t border-line/70 px-4 py-3.5">
          <AnswerInput view={view} teams={teams} value={answer} onChange={onAnswer} />
        </div>
      )}
    </Card>
  );
}

function PackageCard({
  view,
  teams,
  currency,
  selected,
  answer,
  ordinaryViews,
  onToggle,
  onAnswer,
  onCopy,
}: {
  view: GameView;
  teams: { one: string; two: string };
  currency: string;
  selected: boolean;
  answer: PackageAnswer;
  ordinaryViews: GameView[];
  onToggle: () => void;
  onAnswer: (a: PackageAnswer) => void;
  onCopy: () => void;
}) {
  const wcView = ordinaryViews.find((o) => o.gameKey === "world_champion");
  const fsView = ordinaryViews.find((o) => o.gameKey === "first_scorer");
  const etView = ordinaryViews.find((o) => o.gameKey === "extra_time");

  return (
    <Card className={cn("overflow-hidden border-gold/40 bg-gold-soft/40", selected && "ring-1 ring-gold/60")}>
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
        <span
          className={cn(
            "grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 transition-colors",
            selected ? "border-gold bg-gold text-pitch-deep" : "border-gold/50 bg-cream",
          )}
          aria-hidden
        >
          {selected && "✓"}
        </span>
        <span className="flex-1">
          <span className="flex items-center gap-2">
            <span className="font-display font-bold text-[#8a5f00]">{view.title}</span>
            <Badge tone="gold">Jackpot</Badge>
          </span>
          <span className="mt-0.5 block text-xs leading-snug text-[#8a5f00]/80">{view.description}</span>
        </span>
        <Badge tone="gold">{formatMoney(view.stake, currency)}</Badge>
      </button>

      {selected && (
        <div className="space-y-4 border-t border-gold/30 px-4 py-4">
          <button
            type="button"
            onClick={onCopy}
            className="w-full rounded-xl border border-dashed border-gold/60 bg-cream/60 px-3 py-2.5 text-sm font-medium text-[#8a5f00] hover:bg-cream"
          >
            ⟳ Kopiera mina ordinarie svar hit
          </button>

          <PackagePart label="Världsmästare">
            {wcView && (
              <OptionButtons
                options={wcView.options}
                value={answer.world_champion}
                onChange={(v) => onAnswer({ ...answer, world_champion: v })}
              />
            )}
          </PackagePart>

          <PackagePart label="Resultat efter 90 min">
            <ScoreInput
              teams={teams}
              value={answer.result_90}
              onChange={(v) => onAnswer({ ...answer, result_90: v })}
            />
          </PackagePart>

          <PackagePart label="Första målskytt">
            {fsView && (
              <ScorerSelect
                options={fsView.options}
                value={answer.first_scorer}
                onChange={(v) => onAnswer({ ...answer, first_scorer: v })}
              />
            )}
          </PackagePart>

          <PackagePart label="Blir det förlängning?">
            {etView && (
              <OptionButtons
                options={etView.options}
                value={answer.extra_time}
                onChange={(v) => onAnswer({ ...answer, extra_time: v })}
              />
            )}
          </PackagePart>
        </div>
      )}
    </Card>
  );
}

function PackagePart({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-[#8a5f00]">{label}</div>
      {children}
    </div>
  );
}

function ConfirmSheet({
  total,
  count,
  lockedCount = 0,
  currency,
  items,
  pending,
  onCancel,
  onConfirm,
}: {
  total: number;
  count: number;
  lockedCount?: number;
  currency: string;
  items: { title: string; stake: number; jackpot: boolean }[];
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-pitch-deep/50 p-0 sm:items-center sm:p-4" onClick={onCancel}>
      <Card
        className="w-full max-w-xl rounded-b-none rounded-t-3xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-5">
          <h3 className="font-display text-xl font-bold text-pitch">Bekräfta dina tips</h3>
          <p className="mt-1 text-sm text-muted">
            Du skickar in {count} spel
            {lockedCount > 0 && ` (plus ${lockedCount} redan låsta)`}. Kontrollera din totala insats.
          </p>

          <div className="my-4 max-h-56 space-y-1.5 overflow-y-auto">
            {items.map((it) => (
              <div key={it.title} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-ink">
                  {it.jackpot && <span aria-hidden>⭐</span>}
                  {it.title}
                </span>
                <span className="tabular-nums text-muted">{formatMoney(it.stake, currency)}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between rounded-xl bg-pitch px-4 py-3 text-chalk">
            <span className="font-medium">Total insats</span>
            <span className="font-display text-xl font-bold">{formatMoney(total, currency)}</span>
          </div>

          <div className="mt-4 flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={onCancel} disabled={pending}>
              Avbryt
            </Button>
            <Button className="flex-1" onClick={onConfirm} disabled={pending}>
              {pending ? "Skickar…" : "Bekräfta & skicka"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
