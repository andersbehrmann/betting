"use client";

import { useState, useTransition } from "react";
import { Card, Input } from "@/components/ui";
import { cn, formatMoney } from "@/lib/utils";
import { setPaymentStatus, setAdminNote } from "@/app/admin/actions";
import type { PaymentStatus } from "@/lib/types";
import type { ParticipantStanding } from "@/lib/standings";

const STATUSES: { value: PaymentStatus; label: string }[] = [
  { value: "unpaid", label: "Ej betalat" },
  { value: "paid", label: "Betalat" },
  { value: "settled", label: "Klart" },
];

function PaymentControl({ id, status }: { id: string; status: PaymentStatus }) {
  const [isPending, startTransition] = useTransition();
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-line">
      {STATUSES.map((s) => (
        <button
          key={s.value}
          type="button"
          disabled={isPending}
          onClick={() => startTransition(() => void setPaymentStatus(id, s.value))}
          className={cn(
            "px-2.5 py-1 text-xs font-medium transition-colors",
            status === s.value
              ? s.value === "unpaid"
                ? "bg-lose text-chalk"
                : "bg-grass text-chalk"
              : "bg-cream text-muted hover:bg-cream-deep",
          )}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

function NoteInput({ id, initial }: { id: string; initial: string }) {
  const [note, setNote] = useState(initial);
  const [, startTransition] = useTransition();
  const [savedTick, setSavedTick] = useState(false);

  function save() {
    if (note === initial) return;
    startTransition(async () => {
      await setAdminNote(id, note);
      setSavedTick(true);
      setTimeout(() => setSavedTick(false), 1200);
    });
  }

  return (
    <div className="relative">
      <Input
        className="h-9 text-sm"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        placeholder="Kommentar…"
      />
      {savedTick && <span className="absolute right-2 top-2 text-xs text-grass">✓</span>}
    </div>
  );
}

export function ResultsTable({
  participants,
  currency,
}: {
  participants: ParticipantStanding[];
  currency: string;
}) {
  if (participants.length === 0) {
    return <Card className="p-6 text-center text-sm text-muted">Inga deltagare ännu.</Card>;
  }

  const totals = participants.reduce(
    (acc, p) => ({
      stake: acc.stake + p.totalStake,
      winnings: acc.winnings + p.totalWinnings,
      net: acc.net + p.net,
    }),
    { stake: 0, winnings: 0, net: 0 },
  );

  return (
    <Card className="divide-y divide-line/60 overflow-hidden">
      {participants.map((p) => (
        <div key={p.id} className="px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-ink">{p.name}</span>
            <PaymentControl id={p.id} status={p.paymentStatus} />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <span className="text-muted">
              Insats: <span className="text-ink">{formatMoney(p.totalStake, currency)}</span>
            </span>
            <span className="text-muted">
              Vinst: <span className="text-win">{formatMoney(p.totalWinnings, currency)}</span>
            </span>
            <span className="text-muted">
              Netto:{" "}
              <span className={cn("font-semibold", p.net > 0 ? "text-win" : p.net < 0 ? "text-lose" : "text-ink")}>
                {p.net > 0 ? "+" : ""}
                {formatMoney(p.net, currency)}
              </span>
            </span>
            <span className="text-muted">Vinster: {p.wins}</span>
          </div>
          <div className="mt-2">
            <NoteInput id={p.id} initial={p.adminNote ?? ""} />
          </div>
        </div>
      ))}
      <div className="flex flex-wrap gap-x-4 bg-cream-deep/50 px-4 py-3 text-sm font-medium">
        <span>Totalt insatt: {formatMoney(totals.stake, currency)}</span>
        <span>Totalt utbetalt: {formatMoney(totals.winnings, currency)}</span>
      </div>
    </Card>
  );
}
